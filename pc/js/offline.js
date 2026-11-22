// SmartPOS · Modo offline (IndexedDB + cola de ventas + sincronización)
const Offline = (() => {
    const DB_NOMBRE = 'smartpos-offline';
    const DB_VERSION = 1;

    let dbPromise = null;
    let sincronizando = false;

    function abrir() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolver, rechazar) => {
            if (!('indexedDB' in window)) return rechazar(new Error('Sin IndexedDB'));

            const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION);

            peticion.onupgradeneeded = () => {
                const db = peticion.result;
                if (!db.objectStoreNames.contains('productos')) db.createObjectStore('productos', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('pendientes')) db.createObjectStore('pendientes', { keyPath: 'localId', autoIncrement: true });
                if (!db.objectStoreNames.contains('datos')) db.createObjectStore('datos', { keyPath: 'clave' });
            };

            peticion.onsuccess = () => resolver(peticion.result);
            peticion.onerror = () => rechazar(peticion.error);
        });

        return dbPromise;
    }

    function pedir(peticion) {
        return new Promise((resolver, rechazar) => {
            peticion.onsuccess = () => resolver(peticion.result);
            peticion.onerror = () => rechazar(peticion.error);
        });
    }

    async function almacen(nombre, modo) {
        const db = await abrir();
        return db.transaction(nombre, modo).objectStore(nombre);
    }

    async function guardar(nombre, valor) { return pedir((await almacen(nombre, 'readwrite')).put(valor)); }
    async function leer(nombre, clave) { return pedir((await almacen(nombre, 'readonly')).get(clave)); }
    async function todos(nombre) { return pedir((await almacen(nombre, 'readonly')).getAll()); }
    async function borrar(nombre, clave) { return pedir((await almacen(nombre, 'readwrite')).delete(clave)); }

    // ---------- Catálogo ----------
    async function guardarProductos(productos) {
        try {
            const store = await almacen('productos', 'readwrite');
            (productos || []).forEach(producto => store.put(producto));
        } catch (err) {
            console.warn('Offline: no se guardaron los productos', err);
        }
    }

    async function productoPorCodigo(codigo) {
        try {
            const lista = await todos('productos');
            return lista.find(p => String(p.codigo) === String(codigo)) || null;
        } catch (err) {
            return null;
        }
    }

    async function productosCache() {
        try { return await todos('productos'); } catch (err) { return []; }
    }

    async function guardarDatos(clave, valor) {
        try { await guardar('datos', { clave, valor }); } catch (err) { /* sin cache */ }
    }

    async function obtenerDatos(clave) {
        try {
            const fila = await leer('datos', clave);
            return fila ? fila.valor : null;
        } catch (err) {
            return null;
        }
    }

    async function descontarStock(items) {
        try {
            for (const item of items || []) {
                const producto = await leer('productos', item.id);
                if (producto) {
                    producto.stock = Number(producto.stock || 0) - Number(item.cantidad || 0);
                    await guardar('productos', producto);
                }
            }
        } catch (err) {
            console.warn('Offline: no se pudo descontar stock', err);
        }
    }

    // ---------- Cola de ventas ----------
    async function encolarVenta(venta) {
        try {
            const store = await almacen('pendientes', 'readwrite');
            return await pedir(store.add(venta));
        } catch (err) {
            console.warn('Offline: no se pudo encolar la venta', err);
            return null;
        }
    }

    async function pendientes() {
        try { return await todos('pendientes'); } catch (err) { return []; }
    }

    async function contarPendientes() {
        try { return (await pendientes()).length; } catch (err) { return 0; }
    }

    // ---------- Sincronización ----------
    async function enviarVenta(venta) {
        const { data, error } = await supabaseClient.rpc('realizar_venta', {
            p_usuario: venta.usuario || 'Vendedor Demo',
            p_items: (venta.items || []).map(item => ({ id: item.id, cantidad: item.cantidad }))
        });
        if (error) throw error;

        const ventaId = data.venta_id;

        const cobro = await supabaseClient.rpc('registrar_cobro', {
            p_venta_id: ventaId,
            p_metodo: venta.metodo_pago,
            p_recibido: venta.monto_recibido,
            p_vuelto: venta.vuelto,
            p_total: venta.total
        });
        if (cobro.error) console.warn('Offline: pago no guardado', cobro.error.message);

        if (Number(venta.descuento) > 0) {
            const descuento = await supabaseClient.rpc('registrar_descuento', {
                p_venta_id: ventaId,
                p_descuento: venta.descuento
            });
            if (descuento.error) console.warn('Offline: descuento no guardado', descuento.error.message);
        }

        if (venta.cliente_id) {
            const cliente = await supabaseClient.rpc('registrar_cliente', {
                p_venta_id: ventaId,
                p_cliente_id: venta.cliente_id,
                p_nombre: venta.cliente_nombre
            });
            if (cliente.error) console.warn('Offline: cliente no guardado', cliente.error.message);
        }

        if (venta.precios && venta.precios.length) {
            const precios = await supabaseClient.rpc('actualizar_precios_venta', {
                p_venta_id: ventaId,
                p_items: venta.precios
            });
            if (precios.error) console.warn('Offline: precios no actualizados', precios.error.message);
        }

        return ventaId;
    }

    async function sincronizar() {
        if (sincronizando || !navigator.onLine || typeof supabaseClient === 'undefined') {
            return { enviadas: 0, fallidas: 0 };
        }

        sincronizando = true;
        let enviadas = 0;
        let fallidas = 0;

        try {
            const cola = await pendientes();

            for (const venta of cola) {
                try {
                    const id = await enviarVenta(venta);
                    await borrar('pendientes', venta.localId);
                    enviadas++;
                    console.log('Offline: venta enviada', venta.localId, '->', id);
                } catch (error) {
                    console.warn('Offline: no se pudo enviar la venta', venta.localId, error);
                    fallidas++;
                    break;
                }
            }
        } finally {
            sincronizando = false;
            actualizarBadge();
        }

        if (enviadas > 0 && typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion(`${enviadas} venta(s) sincronizada(s)`, 'success');
        }

        return { enviadas, fallidas };
    }

    // ---------- Indicador ----------
    async function actualizarBadge() {
        const badge = document.getElementById('offline-badge');
        if (!badge) return;

        const n = await contarPendientes();

        if (!navigator.onLine) {
            badge.textContent = n > 0 ? `Sin conexión · ${n} por enviar` : 'Sin conexión';
            badge.className = 'status offline';
        } else if (n > 0) {
            badge.textContent = `${n} por sincronizar`;
            badge.className = 'status pendiente';
        } else {
            badge.className = 'status offline hidden';
        }
    }

    // ---------- Arranque ----------
    function registrarSW() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW:', err));
    }

    async function iniciar() {
        registrarSW();
        await actualizarBadge();

        window.addEventListener('online', () => {
            actualizarBadge();
            sincronizar();
        });
        window.addEventListener('offline', actualizarBadge);

        if (navigator.onLine) sincronizar();
    }

    return {
        iniciar,
        sincronizar,
        actualizarBadge,
        guardarProductos,
        productoPorCodigo,
        productosCache,
        guardarDatos,
        obtenerDatos,
        descontarStock,
        encolarVenta,
        pendientes,
        contarPendientes
    };
})();
