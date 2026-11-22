document.addEventListener('DOMContentLoaded', () => {
    
    // ==================== VARIABLES GLOBALES ====================
    let carrito = [];
    let IVA_RATE = (typeof SMARTPOS_CONFIG !== 'undefined' && SMARTPOS_CONFIG.IVA_RATE) ? SMARTPOS_CONFIG.IVA_RATE : 0.18;
    let turnoActual = null; // Variable global para saber si hay caja abierta
    
    let listaCategorias = [], listaProveedores = [], listaUbicaciones = [], listaUMedidas = [], listaTiposDoc = [];
    let todosLosProductos = [], productosFiltrados = [], paginaActual = 1, itemsPorPagina = 10;
    let mostrarOcultos = false;
    let listaPromociones = [];
    let listaClientesVenta = [];

    const inputCode = document.getElementById('posCode');
    const cartBody = document.getElementById('cartBody');

    // ==================== INICIALIZACIÓN ====================
    cargarDatosIniciales();
    verificarEstadoCaja(); 
    cargarConfiguracion();
    cargarPromociones();
    cargarClientesVenta();

    // Datos del negocio para el ticket (se guardan en smartpos_config)
    const NEGOCIO = { nombre: 'SmartPOS', documento: '', direccion: '', telefono: '', logo: '' };
    window.SMARTPOS_NEGOCIO = NEGOCIO;

    // IVA y datos del negocio guardados en la base (editables desde Ajustes)
    async function cargarConfiguracion() {
        try {
            const { data, error } = await supabaseClient
                .from('smartpos_config')
                .select('*');

            if (error || !data) return;

            const valores = {};
            data.forEach(fila => { valores[fila.clave] = fila.valor; });

            const rate = parseFloat(valores.iva_rate);
            if (!isNaN(rate) && rate >= 0 && rate <= 1) {
                IVA_RATE = rate;
                if (typeof SMARTPOS_CONFIG !== 'undefined') SMARTPOS_CONFIG.IVA_RATE = rate;

                const input = document.getElementById('ivaPorcentaje');
                if (input) input.value = String(Number((rate * 100).toFixed(2)));
            }

            NEGOCIO.nombre = valores.negocio_nombre || 'SmartPOS';
            NEGOCIO.documento = valores.negocio_documento || '';
            NEGOCIO.direccion = valores.negocio_direccion || '';
            NEGOCIO.telefono = valores.negocio_telefono || '';
            NEGOCIO.logo = valores.negocio_logo || '';

            llenarFormularioNegocio();
            if (todosLosProductos.length) filtrarProductos();
        } catch (err) {
            console.warn('No se pudo cargar la configuración:', err);
        }
    }

    function llenarFormularioNegocio() {
        const campos = {
            negocioNombre: NEGOCIO.nombre,
            negocioDocumento: NEGOCIO.documento,
            negocioDireccion: NEGOCIO.direccion,
            negocioTelefono: NEGOCIO.telefono
        };

        Object.keys(campos).forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.value = campos[id] || '';
        });
    }

    window.guardarNegocio = async function () {
        const nombre = document.getElementById('negocioNombre').value.trim() || 'SmartPOS';
        const documento = document.getElementById('negocioDocumento').value.trim();
        const direccion = document.getElementById('negocioDireccion').value.trim();
        const telefono = document.getElementById('negocioTelefono').value.trim();
        const archivo = document.getElementById('negocioLogo').files[0];

        try {
            let logo = NEGOCIO.logo || '';

            if (archivo) {
                const extension = archivo.name.split('.').pop();
                const nombreArchivo = `logo-${Date.now()}.${extension}`;

                const { error: errorSubida } = await supabaseClient.storage
                    .from('productos-imagenes')
                    .upload(nombreArchivo, archivo);
                if (errorSubida) throw errorSubida;

                const { data: url } = supabaseClient.storage
                    .from('productos-imagenes')
                    .getPublicUrl(nombreArchivo);
                logo = url.publicUrl;
            }

            const filas = [
                { clave: 'negocio_nombre', valor: nombre },
                { clave: 'negocio_documento', valor: documento },
                { clave: 'negocio_direccion', valor: direccion },
                { clave: 'negocio_telefono', valor: telefono },
                { clave: 'negocio_logo', valor: logo }
            ];

            const { error } = await supabaseClient
                .from('smartpos_config')
                .upsert(filas, { onConflict: 'clave' });
            if (error) throw error;

            NEGOCIO.nombre = nombre;
            NEGOCIO.documento = documento;
            NEGOCIO.direccion = direccion;
            NEGOCIO.telefono = telefono;
            NEGOCIO.logo = logo;

            const inputLogo = document.getElementById('negocioLogo');
            if (inputLogo) inputLogo.value = '';

            mostrarNotificacion('Datos del negocio guardados', 'success');
        } catch (err) {
            mostrarNotificacion('No se pudo guardar. ' + mensajeError(err), 'error');
        }
    };

    window.guardarIva = async function () {
        const valor = parseFloat(document.getElementById('ivaPorcentaje').value);

        if (isNaN(valor) || valor < 0 || valor > 100) {
            return mostrarNotificacion('Escribe un porcentaje entre 0 y 100', 'error');
        }

        const { error } = await supabaseClient
            .from('smartpos_config')
            .upsert({ clave: 'iva_rate', valor: String(valor / 100) }, { onConflict: 'clave' });

        if (error) return mostrarNotificacion('No se pudo guardar el IVA. ' + mensajeError(error), 'error');

        IVA_RATE = valor / 100;
        if (typeof SMARTPOS_CONFIG !== 'undefined') SMARTPOS_CONFIG.IVA_RATE = IVA_RATE;

        actualizarTotales();
        if (todosLosProductos.length) filtrarProductos();
        mostrarNotificacion(`IVA guardado: ${valor}%`, 'success');
    };

    // ==================== PROMOCIONES ====================
    function hoyYmd() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    }

    async function cargarPromociones() {
        try {
            const { data, error } = await supabaseClient
                .from('promociones')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return;
            listaPromociones = data || [];
        } catch (err) {
            console.warn('No se pudieron cargar las promociones:', err);
        }
    }

    function promoVigente(productoId) {
        const hoy = hoyYmd();

        const vigentes = (listaPromociones || []).filter(promo => {
            if (promo.activa === false) return false;
            if (promo.fecha_inicio && String(promo.fecha_inicio) > hoy) return false;
            if (promo.fecha_fin && String(promo.fecha_fin) < hoy) return false;
            return promo.producto_id == null || Number(promo.producto_id) === Number(productoId);
        });

        if (vigentes.length === 0) return null;

        vigentes.sort((a, b) => {
            const especificoA = a.producto_id != null ? 1 : 0;
            const especificoB = b.producto_id != null ? 1 : 0;
            return (especificoB - especificoA) || (Number(b.descuento) - Number(a.descuento));
        });

        return vigentes[0];
    }

    function renderPromos() {
        const tbody = document.getElementById('promoTableBody');
        if (!tbody) return;

        const hoy = hoyYmd();

        if (!listaPromociones.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay promociones</td></tr>';
            return;
        }

        tbody.innerHTML = listaPromociones.map(promo => {
            const producto = promo.producto_id
                ? ((todosLosProductos.find(p => p.id === promo.producto_id) || {}).nombre || 'Producto')
                : 'Todos los productos';

            const vigente = promo.activa !== false
                && (!promo.fecha_inicio || String(promo.fecha_inicio) <= hoy)
                && (!promo.fecha_fin || String(promo.fecha_fin) >= hoy);

            const estado = promo.activa === false
                ? '<span class="badge-estado badge-anulada">Pausada</span>'
                : (vigente ? '<span class="badge-estado badge-emitida">Activa</span>' : '<span class="badge-estado badge-devuelta">Vencida</span>');

            return `<tr>
                <td>${escaparTexto(promo.nombre)}</td>
                <td>${escaparTexto(producto)}</td>
                <td class="td-num">${Number(promo.descuento)}%</td>
                <td>${promo.fecha_inicio || '-'}</td>
                <td>${promo.fecha_fin || '-'}</td>
                <td>${estado}</td>
                <td class="td-acciones">
                    <button class="btn-icon btn-ver" title="${promo.activa === false ? 'Activar' : 'Pausar'}" onclick="alternarPromo(${promo.id})">${promo.activa === false ? '▶️' : '⏸️'}</button>
                    <button class="btn-icon btn-danger" title="Eliminar" onclick="eliminarPromo(${promo.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }

    async function cargarPromos() {
        await cargarPromociones();

        const select = document.getElementById('promoProducto');
        if (select) {
            select.innerHTML = '<option value="">Todos los productos</option>' +
                todosLosProductos.map(p => `<option value="${p.id}">${escaparTexto(p.nombre)}</option>`).join('');
        }

        renderPromos();
    }

    window.guardarPromo = async function () {
        const nombre = document.getElementById('promoNombre').value.trim();
        const producto_id = document.getElementById('promoProducto').value || null;
        const descuento = parseFloat(document.getElementById('promoDescuento').value);
        const fecha_inicio = document.getElementById('promoDesde').value || null;
        const fecha_fin = document.getElementById('promoHasta').value || null;

        if (!nombre) return mostrarNotificacion('Escribe un nombre para la promoción', 'error');
        if (isNaN(descuento) || descuento <= 0 || descuento > 100) return mostrarNotificacion('El descuento debe estar entre 1 y 100', 'error');
        if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) return mostrarNotificacion('La fecha final no puede ser anterior a la inicial', 'error');

        const { error } = await supabaseClient.from('promociones').insert([{
            nombre, producto_id, descuento, fecha_inicio, fecha_fin, activa: true
        }]);

        if (error) return mostrarNotificacion('No se pudo guardar. ' + mensajeError(error), 'error');

        ['promoNombre', 'promoDescuento', 'promoDesde', 'promoHasta'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.value = '';
        });
        const select = document.getElementById('promoProducto');
        if (select) select.value = '';

        mostrarNotificacion('Promoción creada', 'success');
        await cargarPromos();
        renderCarrito();
    };

    window.alternarPromo = async function (id) {
        const promo = listaPromociones.find(p => p.id === id);
        if (!promo) return;

        const { error } = await supabaseClient
            .from('promociones')
            .update({ activa: promo.activa === false })
            .eq('id', id);

        if (error) return mostrarNotificacion('No se pudo cambiar. ' + mensajeError(error), 'error');

        await cargarPromos();
        renderCarrito();
    };

    window.eliminarPromo = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar promoción',
            mensaje: 'La promoción dejará de aplicarse en el POS.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('promociones', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');

        mostrarNotificacion('Promoción eliminada', 'success');
        await cargarPromos();
        renderCarrito();
    };

    async function cargarDatosIniciales() {
        const [resCat, resProv, resUbi, resUMed, resTipoDoc] = await Promise.all([
            supabaseClient.from('categorias').select('*').order('nombre'),
            supabaseClient.from('proveedores').select('*').order('nombre'),
            supabaseClient.from('ubicaciones').select('*').order('nombre'),
            supabaseClient.from('unidades_medida').select('*').order('nombre'),
            supabaseClient.from('tipos_documento').select('*').order('abreviatura')
        ]);
        listaCategorias = resCat.data || []; 
        listaProveedores = resProv.data || []; 
        listaUbicaciones = resUbi.data || []; 
        listaUMedidas = resUMed.data || []; 
        listaTiposDoc = resTipoDoc.data || [];
        llenarSelectsFormulario();
    }

    function llenarSelectsFormulario() {
        const selProv = document.getElementById('newProveedor'); 
        if (selProv) selProv.innerHTML = '<option value="">Seleccione...</option>' + listaProveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        
        const selCat = document.getElementById('newCategoria'); 
        if (selCat) selCat.innerHTML = '<option value="">Seleccione...</option>' + listaCategorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        
        const selUbi = document.getElementById('newUbicacion'); 
        if (selUbi) selUbi.innerHTML = '<option value="">Seleccione...</option>' + listaUbicaciones.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
        
        const selUMed = document.getElementById('newMedidaSelect'); 
        if (selUMed) selUMed.innerHTML = '<option value="">Seleccione...</option>' + listaUMedidas.map(u => `<option value="${u.id}">${u.abreviatura} (${u.nombre})</option>`).join('');
        
        const optsTipoDoc = '<option value="">Tipo...</option>' + listaTiposDoc.map(t => `<option value="${t.id}">${t.abreviatura}</option>`).join('');
        const selCliTipo = document.getElementById('cliTipoDoc'); if (selCliTipo) selCliTipo.innerHTML = optsTipoDoc;
        const selProvTipo = document.getElementById('provTipoDoc'); if (selProvTipo) selProvTipo.innerHTML = optsTipoDoc;
    }

    const selCatProducto = document.getElementById('newCategoria');
    if (selCatProducto) {
        selCatProducto.addEventListener('change', async (e) => {
            const catId = e.target.value;
            const selSubCat = document.getElementById('newSubcategoria');
            selSubCat.innerHTML = '<option value="">Seleccione...</option>';
            if (!catId) return;
            const { data } = await supabaseClient.from('subcategorias').select('*').eq('categoria_id', catId);
            if (data) selSubCat.innerHTML += data.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
        });
    }

    // ==================== LÓGICA DE CAJA Y TURNOS ====================
    async function verificarEstadoCaja() {
        const { data, error } = await supabaseClient.from('turnos').select('*').eq('estado', 'ABIERTO').order('fecha_apertura', { ascending: false }).limit(1);
        
        if (data && data.length > 0) {
            turnoActual = data[0];
            const btn = document.getElementById('btnCaja');
            btn.textContent = '🔴 Cerrar Caja';
            btn.className = 'btn btn-danger';
            btn.onclick = abrirModalCerrarCaja;
            document.getElementById('btnCobrar').disabled = false;
        } else {
            turnoActual = null;
            const btn = document.getElementById('btnCaja');
            btn.textContent = '🟢 Abrir Caja';
            btn.className = 'btn btn-success';
            btn.onclick = abrirModalAbrirCaja;
            document.getElementById('btnCobrar').disabled = true;
        }
    }

    window.abrirModalAbrirCaja = function() {
        document.getElementById('modalCaja').classList.remove('hidden');
        document.getElementById('cajaModalTitle').textContent = 'Abrir Caja';
        document.getElementById('cajaModalLabel').textContent = 'Dinero inicial (para cambio)';
        document.getElementById('cajaMonto').value = '';
        document.getElementById('cajaNotas').value = '';
        document.getElementById('cajaResultado').classList.add('hidden');
        document.getElementById('btnConfirmarCaja').onclick = confirmarAbrirCaja;
    };

    window.abrirModalCerrarCaja = async function() {
        if (!turnoActual) return;
        
        let respuesta = await supabaseClient.from('ventas')
            .select('total, estado, metodo_pago')
            .gte('created_at', turnoActual.fecha_apertura);

        // Compatibilidad si todavía no existen las columnas nuevas
        if (respuesta.error) {
            respuesta = await supabaseClient.from('ventas')
                .select('total, estado')
                .gte('created_at', turnoActual.fecha_apertura);
        }
        if (respuesta.error) {
            respuesta = await supabaseClient.from('ventas')
                .select('total')
                .gte('created_at', turnoActual.fecha_apertura);
        }

        // Solo sumamos las ventas válidas y, para el efectivo, las cobradas en efectivo
        const ventasValidas = (respuesta.data || [])
            .filter(v => String(v.estado || '').toUpperCase() !== 'ANULADA');
        const esEfectivo = v => !v.metodo_pago || v.metodo_pago === 'EFECTIVO';

        const totalEfectivo = ventasValidas.filter(esEfectivo)
            .reduce((suma, v) => suma + Number(v.total || 0), 0);
        const totalOtros = ventasValidas.filter(v => !esEfectivo(v))
            .reduce((suma, v) => suma + Number(v.total || 0), 0);

        const montoSistema = Number(turnoActual.monto_inicial) + totalEfectivo;

        document.getElementById('modalCaja').classList.remove('hidden');
        document.getElementById('cajaModalTitle').textContent = 'Cerrar Caja';
        document.getElementById('cajaModalLabel').textContent = 'Dinero contado en caja';
        document.getElementById('cajaMonto').value = '';
        document.getElementById('cajaNotas').value = '';
        
        const resDiv = document.getElementById('cajaResultado');
        resDiv.classList.remove('hidden');
        resDiv.innerHTML = `<p><b>Dinero inicial:</b> $${Number(turnoActual.monto_inicial).toFixed(2)}</p>
                            <p><b>Ventas en efectivo:</b> $${totalEfectivo.toFixed(2)}</p>
                            ${totalOtros > 0 ? `<p><b>Tarjeta / transferencia:</b> $${totalOtros.toFixed(2)}</p>` : ''}
                            <p style="border-top:1px solid #ccc; padding-top:5px; margin-top:5px;"><b>Debería haber en caja:</b> $${montoSistema.toFixed(2)}</p>`;
                            
        document.getElementById('btnConfirmarCaja').onclick = () => confirmarCerrarCaja(montoSistema);
    };

    window.cerrarModalCaja = function() {
        document.getElementById('modalCaja').classList.add('hidden');
    };

    async function confirmarAbrirCaja() {
        const monto = parseFloat(document.getElementById('cajaMonto').value) || 0;
        
        await supabaseClient.from('turnos').insert([{
            usuario: 'Vendedor Demo', monto_inicial: monto, estado: 'ABIERTO'
        }]);
        
        mostrarNotificacion('Caja abierta con $' + monto.toFixed(2), 'success');
        cerrarModalCaja();
        verificarEstadoCaja();
    }

    async function confirmarCerrarCaja(montoSistema) {
        const contado = parseFloat(document.getElementById('cajaMonto').value) || 0;
        const diferencia = contado - montoSistema;
        
        await supabaseClient.from('turnos').update({
            monto_sistema: montoSistema,
            monto_contado: contado,
            diferencia: diferencia,
            fecha_cierre: new Date().toISOString(),
            estado: 'CERRADO'
        }).eq('id', turnoActual.id);
        
        const msj = diferencia === 0
            ? 'La caja cuadra perfecto'
            : (diferencia > 0 ? `Sobran $${Math.abs(diferencia).toFixed(2)}` : `Faltan $${Math.abs(diferencia).toFixed(2)}`);
        mostrarNotificacion(msj, diferencia === 0 ? 'success' : 'error');
        
        cerrarModalCaja();
        verificarEstadoCaja();
    }

    // ==================== VISTAS ====================
    window.cambiarTab = function(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
        if (tabId === 'tab-clientes') cargarClientes();
        if (tabId === 'tab-proveedores') cargarProveedores();
        if (tabId === 'tab-ajustes') cargarAjustes(); 
        if (tabId === 'tab-ventas' && typeof window.cargarVentas === 'function') window.cargarVentas();
        if (tabId === 'tab-promos') cargarPromos();
    };

    window.abrirAdmin = function() { document.getElementById('pos-view').classList.add('hidden'); document.getElementById('admin-view').classList.remove('hidden'); cargarProductosAdmin(); };
    window.cerrarAdmin = function() { document.getElementById('admin-view').classList.add('hidden'); document.getElementById('pos-view').classList.remove('hidden'); limpiarFormularios(); };

    function limpiarFormularios() {
        document.querySelectorAll('input').forEach(input => { if(input.type !== 'file' && input.type !== 'checkbox') input.value = ''; });
        document.querySelectorAll('select').forEach(select => select.value = '');
        const chkIva = document.getElementById('newAplicaIva'); if(chkIva) chkIva.checked = true;
    }

    // ==================== CARRITO ====================
    if (inputCode) inputCode.addEventListener('keydown', function(e) { if (e.key === 'Enter') agregarProducto(); });

    window.agregarProducto = async function() {
        if (!turnoActual) return mostrarNotificacion('Debes abrir la caja primero', 'error');
        
        const codigo = inputCode.value.trim(); if (!codigo) return;
        const { data, error } = await supabaseClient.from('productos').select('*').eq('codigo', codigo).limit(1);
        if (error || !data || data.length === 0) { inputCode.classList.add('input-error'); setTimeout(() => inputCode.classList.remove('input-error'), 800); inputCode.value = ''; return; }
        
        const producto = data[0];
        if (producto.activo === false) {
            inputCode.classList.add('input-error');
            setTimeout(() => inputCode.classList.remove('input-error'), 800);
            inputCode.value = '';
            return mostrarNotificacion('Ese producto no está disponible', 'error');
        }

        const promo = promoVigente(producto.id);
        const precioBase = Number(producto.precio);
        const precio = promo ? Number((precioBase * (1 - Number(promo.descuento) / 100)).toFixed(2)) : precioBase;

        const existe = carrito.find(item => item.id === producto.id);
        if (existe) existe.cantidad++;
        else carrito.push({
            id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            precio,
            precio_original: precioBase,
            descuento: promo ? Number(promo.descuento) : 0,
            promo: promo ? promo.nombre : null,
            cantidad: 1,
            aplica_iva: producto.aplica_iva
        });
        
        inputCode.value = ''; renderCarrito();
    };

    function renderCarrito() {
        cartBody.innerHTML = '';
        if (carrito.length === 0) { cartBody.innerHTML = '<tr><td colspan="6" class="empty">Carrito vacío</td></tr>'; actualizarTotales(); return; }
        carrito.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.codigo}</td>
                <td>${item.nombre}${item.descuento ? ` <span class="badge-promo">-${item.descuento}%</span>` : ''}</td>
                <td>$${item.precio.toFixed(2)}${item.descuento ? ` <s class="precio-tachado">$${item.precio_original.toFixed(2)}</s>` : ''}</td>
                <td><input type="number" class="input-cantidad" value="${item.cantidad}" min="1" onchange="actualizarCantidad(${index}, this.value)"></td>
                <td>$${(item.precio * item.cantidad).toFixed(2)}</td>
                <td><button class="btn-eliminar" onclick="eliminarItem(${index})">X</button></td>
            `; cartBody.appendChild(tr);
        });
        actualizarTotales();
    }

    function actualizarTotales() {
        let sGrav = 0, sExento = 0;
        carrito.forEach(item => {
            const totalLinea = item.precio * item.cantidad;
            if (item.aplica_iva) sGrav += totalLinea; else sExento += totalLinea;
        });
        const subtotal = sGrav + sExento, iva = sGrav * IVA_RATE, total = subtotal + iva;
        document.getElementById('tSub').textContent = '$' + subtotal.toFixed(2);
        document.getElementById('tIva').textContent = '$' + iva.toFixed(2);
        document.getElementById('tTot').textContent = '$' + total.toFixed(2);
    }

    window.actualizarCantidad = function(index, val) { let cant = parseInt(val) || 1; if (cant < 1) cant = 1; carrito[index].cantidad = cant; renderCarrito(); };
    window.eliminarItem = function(index) { carrito.splice(index, 1); renderCarrito(); };

    // ==================== COBRO: FORMA DE PAGO Y VUELTO ====================
    let cobroPendiente = null;
    let metodoPago = 'EFECTIVO';

    window.cobrar = function() {
        if (!turnoActual) return mostrarNotificacion('Debes abrir la caja primero', 'error');
        if (carrito.length === 0) return mostrarNotificacion('El carrito está vacío', 'error');

        const carritoCopia = carrito.map(item => ({ ...item, total: item.precio * item.cantidad }));
        let sGrav = 0, sExento = 0;
        carritoCopia.forEach(item => { if (item.aplica_iva) sGrav += item.total; else sExento += item.total; });
        const subtotal = sGrav + sExento, iva = sGrav * IVA_RATE, total = subtotal + iva;

        cobroPendiente = { items: carritoCopia, subtotal, iva, total };

        document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
        document.getElementById('cobroRecibido').value = '';
        window.elegirMetodoPago('EFECTIVO');
        cargarClientesVenta();
        document.getElementById('modalCobro').classList.remove('hidden');

        const campo = document.getElementById('cobroRecibido');
        if (campo.focus) campo.focus();
    };

    window.cerrarModalCobro = function () {
        document.getElementById('modalCobro').classList.add('hidden');
        cobroPendiente = null;
    };

    window.elegirMetodoPago = function (metodo) {
        metodoPago = metodo;

        document.getElementById('pagoEfectivo').classList.toggle('activo', metodo === 'EFECTIVO');
        document.getElementById('pagoTarjeta').classList.toggle('activo', metodo === 'TARJETA');
        document.getElementById('pagoTransferencia').classList.toggle('activo', metodo === 'TRANSFERENCIA');
        document.getElementById('cobroEfectivoCampos').classList.toggle('hidden', metodo !== 'EFECTIVO');

        window.actualizarVuelto();
    };

    window.actualizarVuelto = function () {
        if (!cobroPendiente) return;

        const total = cobroPendiente.total;
        const caja = document.getElementById('cobroVuelto');
        const boton = document.getElementById('btnConfirmarCobro');
        const recibido = parseFloat(document.getElementById('cobroRecibido').value) || 0;

        if (metodoPago !== 'EFECTIVO') {
            const nombre = metodoPago === 'TARJETA' ? 'tarjeta' : 'transferencia';
            caja.className = 'cobro-vuelto cobro-ok';
            caja.innerHTML = `Pago con ${nombre} por <b>$${total.toFixed(2)}</b>`;
            boton.disabled = false;
            return;
        }

        const vuelto = recibido - total;

        if (recibido <= 0) {
            caja.className = 'cobro-vuelto';
            caja.innerHTML = `Total a cobrar: <b>$${total.toFixed(2)}</b>`;
            boton.disabled = true;
        } else if (vuelto < 0) {
            caja.className = 'cobro-vuelto cobro-error';
            caja.innerHTML = `Faltan <b>$${Math.abs(vuelto).toFixed(2)}</b>`;
            boton.disabled = true;
        } else {
            caja.className = 'cobro-vuelto cobro-ok';
            caja.innerHTML = `Vuelto: <b>$${vuelto.toFixed(2)}</b>`;
            boton.disabled = false;
        }
    };

    window.confirmarCobro = async function () {
        if (!cobroPendiente) return;

        const { items, subtotal, iva, total } = cobroPendiente;

        const selectCliente = document.getElementById('cobroCliente');
        const clienteId = selectCliente && selectCliente.value ? Number(selectCliente.value) : null;
        const clienteElegido = clienteId ? listaClientesVenta.find(c => Number(c.id) === clienteId) : null;
        const clienteNombre = clienteElegido ? clienteElegido.nombre : null;

        let recibido = total;
        let vuelto = 0;

        if (metodoPago === 'EFECTIVO') {
            recibido = parseFloat(document.getElementById('cobroRecibido').value) || 0;
            if (recibido < total) return mostrarNotificacion(`Faltan $${(total - recibido).toFixed(2)}`, 'error');
            vuelto = recibido - total;
        }

        const boton = document.getElementById('btnConfirmarCobro');

        try {
            if (boton) boton.disabled = true;
            mostrarNotificacion('Cobrando...', 'success');

            const { data, error } = await supabaseClient.rpc('realizar_venta', {
                p_usuario: 'Vendedor Demo',
                p_items: items.map(item => ({ id: item.id, cantidad: item.cantidad }))
            });
            if (error) throw error;

            // Guarda la forma de pago y el total real cobrado (con IVA).
            // Si la función nueva aún no está instalada, se usa la anterior.
            const cobro = await supabaseClient.rpc('registrar_cobro', {
                p_venta_id: data.venta_id,
                p_metodo: metodoPago,
                p_recibido: recibido,
                p_vuelto: vuelto,
                p_total: total
            });

            if (cobro.error) {
                const respaldo = await supabaseClient.rpc('registrar_pago', {
                    p_venta_id: data.venta_id,
                    p_metodo: metodoPago,
                    p_recibido: recibido,
                    p_vuelto: vuelto
                });

                if (respaldo.error) console.warn('No se pudo guardar la forma de pago:', respaldo.error.message);
                else console.warn('Falta ejecutar sql/008 para guardar el total con IVA.');
            }

            if (clienteId) {
                const guardado = await supabaseClient.rpc('registrar_cliente', {
                    p_venta_id: data.venta_id,
                    p_cliente_id: clienteId,
                    p_nombre: clienteNombre
                });
                if (guardado.error) console.warn('No se pudo guardar el cliente:', guardado.error.message);
            }

            mostrarNotificacion(`¡Venta #${data.venta_id}!`, 'success');

            // El precio de cada línea debe ser el rebajado que se cobró
            const precios = await supabaseClient.rpc('actualizar_precios_venta', {
                p_venta_id: data.venta_id,
                p_items: items.map(item => ({ id: item.id, precio: item.precio }))
            });
            if (precios.error) console.warn('No se pudieron actualizar los precios de las líneas:', precios.error.message);

            carrito = [];
            renderCarrito();
            window.cerrarModalCobro();

            if (typeof moduloTicket !== 'undefined') {
                try {
                    moduloTicket.mostrar({
                        id: data.venta_id,
                        usuario: 'Vendedor Demo',
                        items: items.map(item => ({
                            ...item,
                            nombre: item.descuento ? `${item.nombre} (-${item.descuento}%)` : item.nombre
                        })),
                        subtotal,
                        iva,
                        total,
                        metodo_pago: metodoPago,
                        monto_recibido: recibido,
                        vuelto,
                        cliente: clienteNombre
                    });
                } catch (errTicket) {
                    // La venta ya está guardada: un fallo del ticket no debe parecer un cobro fallido
                    console.warn('La venta se guardó, pero no se pudo mostrar el ticket:', errTicket);
                }
            }
            if (!document.getElementById('admin-view').classList.contains('hidden')) cargarProductosAdmin();
        } catch (err) {
            mostrarNotificacion('No se pudo cobrar. ' + mensajeError(err), 'error');
        } finally {
            if (boton) boton.disabled = false;
        }
    };

    // Convierte los errores técnicos en mensajes sencillos para el usuario
    function mensajeError(err) {
        const texto = String((err && err.message) || err || '');
        console.error('Detalle técnico:', texto);

        if (!texto) return 'Algo salió mal. Inténtalo otra vez.';
        if (/violates foreign key constraint/i.test(texto)) return 'No se puede eliminar porque está en uso.';
        if (/row-level security|permission denied/i.test(texto)) return 'No hay permiso para esta acción.';
        if (/duplicate key/i.test(texto)) return 'Ese dato ya existe.';
        if (/does not exist/i.test(texto)) return 'Falta configurar la base de datos. Avisa al administrador.';
        return 'Algo salió mal. Inténtalo otra vez.';
    }
        // ==================== GESTIÓN DE PRODUCTOS ====================
    window.cargarProductosAdmin = async function() {
        const tbody = document.getElementById('productTableBody'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="14" class="empty">Cargando...</td></tr>';
        const { data, error } = await supabaseClient.from('productos').select(`*, categorias (nombre), proveedores (nombre), unidades_medida (abreviatura)`).order('nombre');
        if (error) return tbody.innerHTML = '<tr><td colspan="14" class="empty" style="color:red;">Error</td></tr>';
        todosLosProductos = data || [];
        filtrarProductos();
    };

    window.filtrarProductos = function() {
        const query = document.getElementById('searchProduct').value.toLowerCase().trim();
        productosFiltrados = todosLosProductos.filter(p => {
            if (!mostrarOcultos && p.activo === false) return false;
            if (!query) return true;
            return (p.codigo.toLowerCase().includes(query) || p.nombre.toLowerCase().includes(query) || (p.categorias && p.categorias.nombre.toLowerCase().includes(query)) || (p.proveedores && p.proveedores.nombre.toLowerCase().includes(query)));
        });
        paginaActual = 1; renderProductosPaginados();
    };

    window.cambiarItemsPorPagina = function(val) { itemsPorPagina = parseInt(val); paginaActual = 1; renderProductosPaginados(); };
    window.cambiarPagina = function(delta) { const totalPaginas = Math.ceil(productosFiltrados.length / itemsPorPagina); const nueva = paginaActual + delta; if (nueva >= 1 && nueva <= totalPaginas) { paginaActual = nueva; renderProductosPaginados(); } };

    function renderProductosPaginados() {
        const tbody = document.getElementById('productTableBody'); tbody.innerHTML = '';
        const total = productosFiltrados.length, totalPaginas = Math.ceil(total / itemsPorPagina) || 1;
        const inicio = (paginaActual - 1) * itemsPorPagina, fin = inicio + itemsPorPagina;
        const pagina = productosFiltrados.slice(inicio, fin);

        if (pagina.length === 0) { tbody.innerHTML = '<tr><td colspan="14" class="empty">No hay productos que coincidan</td></tr>'; }
        else {
            pagina.forEach(prod => {
                const pC = Number(prod.precio_compra) || 0, pV = Number(prod.precio) || 0;
                const margen = pV - pC, pct = pC > 0 ? ((margen / pC) * 100).toFixed(1) : '0.0';
                const oculto = prod.activo === false;
                const tr = document.createElement('tr');
                if (oculto) tr.className = 'fila-oculta';
                const tdImg = document.createElement('td');
                tdImg.style.cursor = 'pointer';
                tdImg.title = 'Ver imagen y editar';
                tdImg.innerHTML = prod.imagen_url
                    ? `<img src="${prod.imagen_url}" class="img-thumbnail" alt="Producto">`
                    : `<div class="img-thumbnail" style="background:#e2e8f0;"></div>`;
                tdImg.onclick = () => verProducto(prod.id);

                const botonFinal = oculto
                    ? `<button class="btn-icon btn-ver" title="Volver a mostrar" onclick="restaurarProducto(${prod.id})">♻️</button>`
                    : `<button class="btn-icon btn-danger" title="Quitar del listado" onclick="eliminarProducto(${prod.id})">🗑️</button>`;

                tr.innerHTML = `
                    <td>${prod.codigo}</td><td>${prod.nombre}</td><td>${prod.categorias ? prod.categorias.nombre : '-'}</td><td>${prod.unidades_medida ? prod.unidades_medida.abreviatura : '-'}</td><td>${prod.stock_minimo || 0}</td><td style="font-weight:bold; color:${prod.stock <= prod.stock_minimo ? 'red' : 'green'}">${prod.stock}</td><td>$${pC.toFixed(2)}</td><td>$${pV.toFixed(2)}</td><td style="color: ${prod.aplica_iva ? '#16a34a' : '#dc2626'}; font-weight:bold;">${prod.aplica_iva ? Number((IVA_RATE * 100).toFixed(2)) + '%' : 'No'}</td><td>$${margen.toFixed(2)}</td><td>${pct}%</td><td>${prod.proveedores ? prod.proveedores.nombre : '-'}</td><td class="td-acciones"><button class="btn-icon btn-stock" title="Entrada / salida de stock" onclick="abrirModalStock(${prod.id})">📦</button><button class="btn-icon btn-ver" title="Ver y editar" onclick="verProducto(${prod.id})">✏️</button>${botonFinal}</td>`;
                tr.insertBefore(tdImg, tr.firstChild); tbody.appendChild(tr);
            });
        }
        document.getElementById('paginationInfo').textContent = `Mostrando ${pagina.length} de ${total} productos`;
        document.getElementById('pageInfo').textContent = `Página ${paginaActual} de ${totalPaginas}`;
        document.getElementById('prevPageBtn').disabled = (paginaActual === 1);
        document.getElementById('nextPageBtn').disabled = (paginaActual === totalPaginas);
    }

    window.guardarProducto = async function() {
        const codigo = document.getElementById('newCodigo').value.trim(), nombre = document.getElementById('newNombre').value.trim();
        const pVenta = parseFloat(document.getElementById('newPrecio').value), pCompra = parseFloat(document.getElementById('newPrecioCompra').value) || 0;
        const stock = parseInt(document.getElementById('newStock').value), stockMin = parseInt(document.getElementById('newStockMin').value) || 0;
        
        const proveedor_id = document.getElementById('newProveedor').value || null;
        const categoria_id = document.getElementById('newCategoria').value || null;
        const subcategoria_id = document.getElementById('newSubcategoria').value || null;
        const unidad_medida_id = document.getElementById('newMedidaSelect').value || null;
        const ubicacion_id = document.getElementById('newUbicacion').value || null;
        const aplica_iva = document.getElementById('newAplicaIva').checked;
        
        if (!codigo || !nombre || isNaN(pVenta) || isNaN(stock)) return mostrarNotificacion('Completa los campos obligatorios', 'error');
        
        try {
            mostrarNotificacion('Guardando...', 'success');
            let imagen_url = null;
            const fileInput = document.getElementById('newImagen');
            
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0], fileExt = file.name.split('.').pop(), fileName = `${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabaseClient.storage.from('productos-imagenes').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabaseClient.storage.from('productos-imagenes').getPublicUrl(fileName);
                imagen_url = urlData.publicUrl;
            }
            
            const { error } = await supabaseClient.from('productos').insert([{ 
                codigo, nombre, precio: pVenta, precio_compra: pCompra, 
                stock, stock_minimo: stockMin, proveedor_id, categoria_id, 
                subcategoria_id, unidad_medida_id, ubicacion_id, imagen_url,
                aplica_iva 
            }]);
            
            if (error) throw error;
            mostrarNotificacion('Producto añadido', 'success'); 
            limpiarFormularios(); 
            cargarProductosAdmin();
            
        } catch (err) { 
            mostrarNotificacion('No se pudo guardar. ' + mensajeError(err), 'error'); 
        }
    };

    window.eliminarProducto = async function (id) {
        const prod = todosLosProductos.find(p => p.id === id);
        const nombre = prod ? prod.nombre : 'este producto';

        const confirmado = await abrirConfirmacion({
            titulo: 'Quitar producto',
            mensaje: `"${nombre}" dejará de aparecer en el listado y en el POS. Sus ventas anteriores se conservan.`,
            boton: 'Quitar',
            peligro: true
        });
        if (!confirmado) return;

        const { error } = await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        if (error) return mostrarNotificacion('No se pudo quitar. ' + mensajeError(error), 'error');

        // Comprobamos que el cambio se guardó de verdad (RLS puede descartarlo sin error)
        const { data: comprobado } = await supabaseClient.from('productos').select('activo').eq('id', id).single();
        if (!comprobado || comprobado.activo !== false) {
            return mostrarNotificacion('La base de datos no permitió quitar el producto.', 'error');
        }

        mostrarNotificacion('Producto quitado del listado', 'success');
        cargarProductosAdmin();
    };

    window.restaurarProducto = async function (id) {
        const { error } = await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
        if (error) return mostrarNotificacion('No se pudo restaurar. ' + mensajeError(error), 'error');

        const { data: comprobado } = await supabaseClient.from('productos').select('activo').eq('id', id).single();
        if (!comprobado || comprobado.activo !== true) {
            return mostrarNotificacion('La base de datos no permitió restaurar el producto.', 'error');
        }

        mostrarNotificacion('Producto restaurado', 'success');
        cargarProductosAdmin();
    };

    window.cambiarVerOcultos = function (valor) {
        mostrarOcultos = !!valor;
        filtrarProductos();
    };

    // ==================== VER / EDITAR PRODUCTO ====================
    let productoEditando = null;
    let imagenQuitada = false;
    let modoDuplicar = false;

    function escaparTexto(texto) {
        return String(texto == null ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function llenarSelect(id, items, valor, texto) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">—</option>';
        (items || []).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = texto(item);
            sel.appendChild(opt);
        });
        sel.value = valor != null ? String(valor) : '';
    }

    async function cargarSubcategoriasEdicion(categoriaId, seleccionada) {
        const sel = document.getElementById('prodSubcategoria');
        if (!sel) return;
        sel.innerHTML = '<option value="">—</option>';
        if (!categoriaId) return;

        const { data } = await supabaseClient
            .from('subcategorias')
            .select('*')
            .eq('categoria_id', categoriaId)
            .order('nombre');

        (data || []).forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id;
            opt.textContent = sub.nombre;
            sel.appendChild(opt);
        });
        sel.value = seleccionada != null ? String(seleccionada) : '';
    }

    window.cambiarCategoriaEdicion = function (categoriaId) {
        cargarSubcategoriasEdicion(categoriaId, null);
    };

    function mostrarImagenProducto(url) {
        const img = document.getElementById('prodImagen');
        const sin = document.getElementById('prodSinImagen');
        if (url) {
            img.src = url;
            img.classList.remove('hidden');
            sin.classList.add('hidden');
        } else {
            img.removeAttribute('src');
            img.classList.add('hidden');
            sin.classList.remove('hidden');
        }
    }

    window.verProducto = async function (id) {
        const prod = todosLosProductos.find(p => p.id === id);
        if (!prod) return mostrarNotificacion('No se encontró el producto', 'error');

        productoEditando = prod;
        imagenQuitada = false;
        modoDuplicar = false;

        document.getElementById('prodModalTitulo').textContent = 'Ver y editar producto';
        const btnDuplicar = document.getElementById('btnDuplicarProducto');
        if (btnDuplicar) btnDuplicar.style.display = 'inline-flex';
        document.getElementById('prodNombre').value = prod.nombre || '';
        document.getElementById('prodCodigo').value = prod.codigo || '';
        document.getElementById('prodPrecioCompra').value = prod.precio_compra != null ? prod.precio_compra : 0;
        document.getElementById('prodPrecio').value = prod.precio != null ? prod.precio : 0;
        document.getElementById('prodStock').value = prod.stock != null ? prod.stock : 0;
        document.getElementById('prodStockMin').value = prod.stock_minimo != null ? prod.stock_minimo : 0;
        document.getElementById('prodAplicaIva').checked = !!prod.aplica_iva;

        llenarSelect('prodCategoria', listaCategorias, prod.categoria_id, c => c.nombre);
        llenarSelect('prodProveedor', listaProveedores, prod.proveedor_id, p => p.nombre);
        llenarSelect('prodUbicacion', listaUbicaciones, prod.ubicacion_id, u => u.nombre);
        llenarSelect('prodMedida', listaUMedidas, prod.unidad_medida_id, u => `${u.abreviatura} - ${u.nombre}`);

        await cargarSubcategoriasEdicion(prod.categoria_id, prod.subcategoria_id);

        mostrarImagenProducto(prod.imagen_url);
        document.getElementById('prodNuevaImagen').value = '';
        document.getElementById('modalProducto').classList.remove('hidden');
    };

    window.duplicarProducto = function () {
        if (!productoEditando) return;

        modoDuplicar = true;
        document.getElementById('prodModalTitulo').textContent = 'Duplicar producto';
        document.getElementById('prodNombre').value = (productoEditando.nombre || '') + ' (copia)';
        document.getElementById('prodCodigo').value = '';
        document.getElementById('prodStock').value = 0;

        const btnDuplicar = document.getElementById('btnDuplicarProducto');
        if (btnDuplicar) btnDuplicar.style.display = 'none';

        const campoCodigo = document.getElementById('prodCodigo');
        if (campoCodigo.focus) campoCodigo.focus();

        mostrarNotificacion('Ponle un código nuevo y pulsa Guardar', 'success');
    };

    window.quitarImagenProducto = function () {
        imagenQuitada = true;
        document.getElementById('prodNuevaImagen').value = '';
        mostrarImagenProducto(null);
    };

    window.cerrarModalProducto = function () {
        document.getElementById('modalProducto').classList.add('hidden');
        productoEditando = null;
        modoDuplicar = false;
    };

    window.guardarEdicionProducto = async function () {
        if (!productoEditando) return;

        const nombre = document.getElementById('prodNombre').value.trim();
        const codigo = document.getElementById('prodCodigo').value.trim();
        const precio = parseFloat(document.getElementById('prodPrecio').value);
        const precioCompra = parseFloat(document.getElementById('prodPrecioCompra').value) || 0;
        const stock = parseInt(document.getElementById('prodStock').value);
        const stockMin = parseInt(document.getElementById('prodStockMin').value) || 0;

        if (!nombre || !codigo || isNaN(precio) || isNaN(stock)) {
            return mostrarNotificacion('Completa nombre, código, precio y stock', 'error');
        }

        try {
            mostrarNotificacion('Guardando...', 'success');

            let imagenUrl = imagenQuitada ? null : (productoEditando.imagen_url || null);
            const archivo = document.getElementById('prodNuevaImagen').files[0];

            if (archivo) {
                const extension = archivo.name.split('.').pop();
                const nombreArchivo = `${Date.now()}.${extension}`;
                const { error: errorSubida } = await supabaseClient.storage
                    .from('productos-imagenes')
                    .upload(nombreArchivo, archivo);
                if (errorSubida) throw errorSubida;

                const { data: urlData } = supabaseClient.storage
                    .from('productos-imagenes')
                    .getPublicUrl(nombreArchivo);
                imagenUrl = urlData.publicUrl;
            }

            const datos = {
                nombre,
                codigo,
                precio,
                precio_compra: precioCompra,
                stock,
                stock_minimo: stockMin,
                categoria_id: document.getElementById('prodCategoria').value || null,
                subcategoria_id: document.getElementById('prodSubcategoria').value || null,
                proveedor_id: document.getElementById('prodProveedor').value || null,
                unidad_medida_id: document.getElementById('prodMedida').value || null,
                ubicacion_id: document.getElementById('prodUbicacion').value || null,
                aplica_iva: document.getElementById('prodAplicaIva').checked,
                imagen_url: imagenUrl
            };

            let error;
            if (modoDuplicar) {
                ({ error } = await supabaseClient.from('productos').insert([datos]));
            } else {
                ({ error } = await supabaseClient.from('productos').update(datos).eq('id', productoEditando.id));
            }

            if (error) throw error;

            mostrarNotificacion(modoDuplicar ? 'Producto duplicado' : 'Producto guardado', 'success');
            cerrarModalProducto();
            cargarProductosAdmin();
        } catch (err) {
            mostrarNotificacion('No se pudo guardar. ' + mensajeError(err), 'error');
        }
    };

    // Vista previa al elegir una imagen nueva
    const inputImagenProducto = document.getElementById('prodNuevaImagen');
    if (inputImagenProducto) {
        inputImagenProducto.addEventListener('change', (e) => {
            const archivo = e.target.files[0];
            if (archivo) {
                imagenQuitada = false;
                mostrarImagenProducto(URL.createObjectURL(archivo));
            }
        });
    }

    // ==================== ENTRADA / SALIDA DE STOCK ====================
    let stockProducto = null;
    let tipoStock = 'ENTRADA';

    function actualizarResumenStock() {
        const resumen = document.getElementById('stockResumen');
        if (!resumen || !stockProducto) return;

        const cantidad = parseInt(document.getElementById('stockCantidad').value) || 0;
        const base = Number(stockProducto.stock) || 0;
        const despues = tipoStock === 'ENTRADA' ? base + cantidad : base - cantidad;

        resumen.className = 'stock-resumen' + (despues < 0 ? ' stock-error' : '');
        resumen.innerHTML = `Ahora hay <b>${base}</b> · quedarán <b>${despues}</b>`;
    }

    window.elegirTipoStock = function (tipo) {
        tipoStock = tipo;

        document.getElementById('stockTipoEntrada').classList.toggle('activo', tipo === 'ENTRADA');
        document.getElementById('stockTipoSalida').classList.toggle('activo', tipo === 'SALIDA');
        document.getElementById('stockCantidadLabel').textContent = tipo === 'ENTRADA'
            ? '¿Cuántas unidades entran?'
            : '¿Cuántas unidades salen?';

        actualizarResumenStock();
    };

    window.abrirModalStock = function (id) {
        const prod = todosLosProductos.find(p => p.id === id);
        if (!prod) return mostrarNotificacion('No se encontró el producto', 'error');

        stockProducto = prod;
        document.getElementById('stockProducto').textContent = prod.nombre;
        document.getElementById('stockCantidad').value = '';
        document.getElementById('stockMotivo').value = '';
        document.getElementById('stockHistorial').innerHTML = '';
        window.elegirTipoStock('ENTRADA');
        actualizarResumenStock();
        document.getElementById('modalStock').classList.remove('hidden');
        cargarHistorialStock(prod.id);
    };

    window.cerrarModalStock = function () {
        document.getElementById('modalStock').classList.add('hidden');
        stockProducto = null;
    };

    async function cargarHistorialStock(productoId) {
        const cont = document.getElementById('stockHistorial');
        if (!cont) return;
        cont.innerHTML = '<p class="stock-vacio">Cargando historial...</p>';

        const { data, error } = await supabaseClient
            .from('movimientos_stock')
            .select('tipo, cantidad, motivo, created_at')
            .eq('producto_id', productoId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            cont.innerHTML = '<p class="stock-vacio">Historial no disponible todavía</p>';
            return;
        }
        if (!data || data.length === 0) {
            cont.innerHTML = '<p class="stock-vacio">Sin movimientos todavía</p>';
            return;
        }

        cont.innerHTML = '<h4>Últimos movimientos</h4>' + data.map(mov => `
            <div class="movimiento">
                <span class="${mov.tipo === 'ENTRADA' ? 'mov-entrada' : 'mov-salida'}">${mov.tipo === 'ENTRADA' ? '+' : '−'}${mov.cantidad}</span>
                <span class="mov-motivo">${mov.motivo ? escaparTexto(mov.motivo) : 'Sin motivo'}</span>
                <span class="mov-fecha">${new Date(mov.created_at).toLocaleString()}</span>
            </div>`).join('');
    }

    window.guardarMovimientoStock = async function () {
        if (!stockProducto) return;

        const cantidad = parseInt(document.getElementById('stockCantidad').value) || 0;
        if (cantidad < 1) return mostrarNotificacion('Escribe cuántas unidades', 'error');

        const motivo = document.getElementById('stockMotivo').value.trim();
        const id = stockProducto.id;

        try {
            mostrarNotificacion('Guardando...', 'success');

            const { data: actual, error: errorLectura } = await supabaseClient
                .from('productos')
                .select('stock')
                .eq('id', id)
                .single();
            if (errorLectura) throw errorLectura;

            const fila = Array.isArray(actual) ? actual[0] : actual;
            const stockAnterior = Number(fila && fila.stock != null ? fila.stock : stockProducto.stock) || 0;
            const stockNuevo = tipoStock === 'ENTRADA' ? stockAnterior + cantidad : stockAnterior - cantidad;

            if (stockNuevo < 0) {
                return mostrarNotificacion(`Solo hay ${stockAnterior} unidades`, 'error');
            }

            const { error: errorStock } = await supabaseClient
                .from('productos')
                .update({ stock: stockNuevo })
                .eq('id', id);
            if (errorStock) throw errorStock;

            const { error: errorMovimiento } = await supabaseClient.from('movimientos_stock').insert([{
                producto_id: id,
                tipo: tipoStock,
                cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                motivo: motivo || null,
                usuario: 'Vendedor Demo'
            }]);

            if (errorMovimiento) {
                console.warn('No se pudo guardar el movimiento:', errorMovimiento.message);
                mostrarNotificacion(`Stock: ${stockAnterior} → ${stockNuevo}. No se pudo guardar en el historial.`, 'error');
            } else {
                mostrarNotificacion(`Stock: ${stockAnterior} → ${stockNuevo}`, 'success');
            }

            cerrarModalStock();
            cargarProductosAdmin();
        } catch (err) {
            mostrarNotificacion('No se pudo guardar. ' + mensajeError(err), 'error');
        }
    };

    const inputStockCantidad = document.getElementById('stockCantidad');
    if (inputStockCantidad) inputStockCantidad.addEventListener('input', actualizarResumenStock);

    // Borra un registro y comprueba que realmente se borró
    // (RLS puede bloquear el DELETE sin devolver error).
    async function borrarRegistro(tabla, id) {
        const { error } = await supabaseClient.from(tabla).delete().eq('id', id);
        if (error) return { ok: false, mensaje: mensajeError(error) };

        const { data } = await supabaseClient.from(tabla).select('id').eq('id', id).limit(1);
        if (data && data.length > 0) return { ok: false, mensaje: 'la base de datos no permitió el borrado.' };

        return { ok: true };
    }
    // ==================== CLIENTES EN LA VENTA ====================
    async function cargarClientesVenta() {
        try {
            const { data, error } = await supabaseClient
                .from('clientes')
                .select('id, nombre')
                .order('nombre');

            if (error) return;
            listaClientesVenta = data || [];

            const select = document.getElementById('cobroCliente');
            if (select) {
                const elegido = select.value;
                select.innerHTML = '<option value="">Consumidor final</option>' +
                    listaClientesVenta.map(c => `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`).join('');
                select.value = elegido;
            }
        } catch (err) {
            console.warn('No se pudieron cargar los clientes:', err);
        }
    }

    // ==================== GESTIÓN DE CLIENTES ====================
    window.guardarCliente = async function() {
        const tipo_documento_id = document.getElementById('cliTipoDoc').value || null, doc = document.getElementById('cliDoc').value.trim();
        const nombre = document.getElementById('cliNombre').value.trim(), tel = document.getElementById('cliTelefono').value.trim(), dir = document.getElementById('cliDireccion').value.trim();
        
        if (!doc || !nombre) return mostrarNotificacion('Doc y Nombre obligatorios', 'error');
        
        const { error } = await supabaseClient.from('clientes').insert([{ tipo_documento_id, numero_documento: doc, nombre, telefono: tel, direccion: dir }]);
        
        if (error) return mostrarNotificacion('Error (¿Doc duplicado?)', 'error');
        mostrarNotificacion('Cliente añadido', 'success'); limpiarFormularios(); cargarClientes();
    };

    async function cargarClientes() {
        const tbody = document.getElementById('clientesTableBody');
        const { data } = await supabaseClient.from('clientes').select('*, tipos_documento(abreviatura)').order('nombre');
        tbody.innerHTML = data.map(c => `<tr><td>${c.tipos_documento ? c.tipos_documento.abreviatura : '-'} ${c.numero_documento}</td><td>${c.nombre}</td><td>${c.telefono || '-'}</td><td>${c.direccion || '-'}</td><td><button class="btn-icon btn-danger" onclick="eliminarCliente(${c.id})">🗑️</button></td></tr>`).join('');
    }
    window.eliminarCliente = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar cliente',
            mensaje: 'Se va a eliminar este cliente. Esta acción no se puede deshacer.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('clientes', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Cliente eliminado', 'success');
        cargarClientes();
    };

    // ==================== GESTIÓN DE PROVEEDORES ====================
    window.guardarProveedor = async function() {
        const tipo_documento_id = document.getElementById('provTipoDoc').value || null, doc = document.getElementById('provDoc').value.trim();
        const nombre = document.getElementById('provNombre').value.trim(), tel = document.getElementById('provTelefono').value.trim(), contacto = document.getElementById('provContacto').value.trim();
        
        if (!doc || !nombre) return mostrarNotificacion('Doc y Razón Social obligatorios', 'error');
        
        const { error } = await supabaseClient.from('proveedores').insert([{ tipo_documento_id, numero_documento: doc, nombre, telefono: tel, contacto }]);
        
        if (error) return mostrarNotificacion('Error (¿Doc duplicado?)', 'error');
        mostrarNotificacion('Proveedor añadido', 'success'); limpiarFormularios(); cargarProveedores(); cargarDatosIniciales();
    };

    async function cargarProveedores() {
        const tbody = document.getElementById('proveedoresTableBody');
        const { data } = await supabaseClient.from('proveedores').select('*, tipos_documento(abreviatura)').order('nombre');
        tbody.innerHTML = data.map(p => `<tr><td>${p.tipos_documento ? p.tipos_documento.abreviatura : '-'} ${p.numero_documento}</td><td>${p.nombre}</td><td>${p.contacto || '-'}</td><td>${p.telefono || '-'}</td><td><button class="btn-icon btn-danger" onclick="eliminarProveedor(${p.id})">🗑️</button></td></tr>`).join('');
    }
    window.eliminarProveedor = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar proveedor',
            mensaje: 'Se va a eliminar este proveedor. Esta acción no se puede deshacer.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('proveedores', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Proveedor eliminado', 'success');
        cargarProveedores();
        cargarDatosIniciales();
    };

    // ==================== AJUSTES ====================
    window.guardarCategoria = async function() { 
        const nombre = document.getElementById('newCatNombre').value.trim(); 
        if (!nombre) return; 
        await supabaseClient.from('categorias').insert([{ nombre }]); 
        document.getElementById('newCatNombre').value = ''; 
        mostrarNotificacion('Categoría añadida', 'success');
        cargarAjustes(); 
        cargarDatosIniciales(); 
    };
    window.eliminarCategoria = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar categoría',
            mensaje: 'Los productos de esta categoría quedarán sin categoría.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('categorias', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Categoría eliminada', 'success');
        cargarAjustes();
        cargarDatosIniciales();
    };

    window.guardarSubcategoria = async function() {
        const categoria_id = document.getElementById('newSubCatPadre').value;
        const nombre = document.getElementById('newSubCatNombre').value.trim();
        if (!categoria_id || !nombre) return mostrarNotificacion('Selecciona categoría y escribe nombre', 'error');
        const { error } = await supabaseClient.from('subcategorias').insert([{ categoria_id, nombre }]);
        if (error) return mostrarNotificacion('Error (¿Ya existe?)', 'error');
        document.getElementById('newSubCatNombre').value = '';
        mostrarNotificacion('Subcategoría añadida', 'success');
        cargarAjustes();
    };
    window.eliminarSubcategoria = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar subcategoría',
            mensaje: 'Esta acción no se puede deshacer.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('subcategorias', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Subcategoría eliminada', 'success');
        cargarAjustes();
    };

    window.guardarUbicacion = async function() { 
        const nombre = document.getElementById('newUbicNombre').value.trim(); 
        if (!nombre) return; 
        await supabaseClient.from('ubicaciones').insert([{ nombre }]); 
        document.getElementById('newUbicNombre').value = ''; 
        cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarUbicacion = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar ubicación',
            mensaje: 'Los productos de esta ubicación quedarán sin ubicación.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('ubicaciones', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Ubicación eliminada', 'success');
        cargarAjustes();
        cargarDatosIniciales();
    };

    window.guardarUMedida = async function() { 
        const nombre = document.getElementById('newUMedNombre').value.trim(), abrev = document.getElementById('newUMedAbrev').value.trim().toUpperCase(); 
        if (!nombre || !abrev) return mostrarNotificacion('Campos obligatorios', 'error'); 
        const { error } = await supabaseClient.from('unidades_medida').insert([{ nombre, abreviatura: abrev }]); 
        if (error) return mostrarNotificacion('Error (¿Ya existe?)', 'error'); 
        document.getElementById('newUMedNombre').value = ''; document.getElementById('newUMedAbrev').value = ''; 
        mostrarNotificacion('Unidad añadida', 'success'); cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarUMedida = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar unidad de medida',
            mensaje: 'Los productos con esta medida quedarán sin medida.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('unidades_medida', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Unidad eliminada', 'success');
        cargarAjustes();
        cargarDatosIniciales();
    };

    window.guardarTipoDoc = async function() { 
        const nombre = document.getElementById('newTipoDocNombre').value.trim(), abrev = document.getElementById('newTipoDocAbrev').value.trim().toUpperCase(); 
        if (!nombre || !abrev) return mostrarNotificacion('Campos obligatorios', 'error'); 
        const { error } = await supabaseClient.from('tipos_documento').insert([{ nombre, abreviatura: abrev }]); 
        if (error) return mostrarNotificacion('Error (¿Ya existe?)', 'error'); 
        document.getElementById('newTipoDocNombre').value = ''; document.getElementById('newTipoDocAbrev').value = ''; 
        mostrarNotificacion('Tipo añadido', 'success'); cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarTipoDoc = async function (id) {
        const confirmado = await abrirConfirmacion({
            titulo: 'Eliminar tipo de documento',
            mensaje: 'Esta acción no se puede deshacer.',
            boton: 'Eliminar',
            peligro: true
        });
        if (!confirmado) return;

        const resultado = await borrarRegistro('tipos_documento', id);
        if (!resultado.ok) return mostrarNotificacion('No se pudo eliminar. ' + resultado.mensaje, 'error');
        mostrarNotificacion('Tipo de documento eliminado', 'success');
        cargarAjustes();
        cargarDatosIniciales();
    };

    async function cargarAjustes() {
        cargarConfiguracion();

        const { data: cats } = await supabaseClient.from('categorias').select('*').order('nombre');
        document.getElementById('listaCategorias').innerHTML = cats.map(c => `<li>${c.nombre} <button onclick="eliminarCategoria(${c.id})" class="btn-eliminar">X</button></li>`).join('');
        
        const selCatPadre = document.getElementById('newSubCatPadre');
        if (selCatPadre) selCatPadre.innerHTML = '<option value="">Seleccione categoría...</option>' + cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const { data: subcats } = await supabaseClient.from('subcategorias').select('*, categorias(nombre)').order('nombre');
        if (subcats) document.getElementById('listaSubcategorias').innerHTML = subcats.map(s => `<li><span><b>${s.categorias ? s.categorias.nombre : '-'}</b> > ${s.nombre}</span> <button onclick="eliminarSubcategoria(${s.id})" class="btn-eliminar">X</button></li>`).join('');

        const { data: ubis } = await supabaseClient.from('ubicaciones').select('*').order('nombre');
        document.getElementById('listaUbicaciones').innerHTML = ubis.map(u => `<li>${u.nombre} <button onclick="eliminarUbicacion(${u.id})" class="btn-eliminar">X</button></li>`).join('');

        const { data: umeds } = await supabaseClient.from('unidades_medida').select('*').order('nombre');
        document.getElementById('listaUMedidas').innerHTML = umeds.map(u => `<li>${u.abreviatura} - ${u.nombre} <button onclick="eliminarUMedida(${u.id})" class="btn-eliminar">X</button></li>`).join('');

        const { data: tipos } = await supabaseClient.from('tipos_documento').select('*').order('abreviatura');
        document.getElementById('listaTiposDoc').innerHTML = tipos.map(t => `<li>${t.abreviatura} - ${t.nombre} <button onclick="eliminarTipoDoc(${t.id})" class="btn-eliminar">X</button></li>`).join('');
    }

    // ==================== EXCEL (IMPORTAR / EXPORTAR) ====================
    window.descargarPlantillaExcel = function() { 
        try { 
            const data = [{ 'Codigo': '8480013525103', 'Nombre': 'Leche Entera 1L', 'Precio': 2.50, 'Stock': 50 }]; 
            const ws = XLSX.utils.json_to_sheet(data); 
            ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 12 }, { wch: 12 }]; 
            for (let cell in ws) { if (cell.startsWith('A')) { ws[cell].t = 's'; ws[cell].z = '@'; } } 
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Productos"); 
            XLSX.writeFile(wb, "Plantilla_SmartPOS.xlsx"); 
        } catch (err) { mostrarNotificacion('Error', 'error'); } 
    };
    
    window.exportarProductosExcel = async function() { 
        const { data, error } = await supabaseClient.from('productos').select('codigo, nombre, precio, stock'); 
        if (error || !data.length) return mostrarNotificacion('No hay productos', 'error'); 
        const ws = XLSX.utils.json_to_sheet(data); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Productos"); 
        XLSX.writeFile(wb, "Inventario_SmartPOS.xlsx"); 
    };
    
    window.importarProductosExcel = function(event) { 
        const file = event.target.files[0]; if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = async (e) => { 
            try { 
                const data = new Uint8Array(e.target.result); 
                const workbook = XLSX.read(data, { type: 'array' }); 
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); 
                const cleanJson = json.map(row => { 
                    const cleanRow = {}; 
                    for (let key in row) { 
                        const cleanKey = key.trim().replace(/^\uFEFF/, '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
                        cleanRow[cleanKey] = row[key]; 
                    } return cleanRow; 
                }); 
                const productos = cleanJson.map(row => { 
                    const codigo = String(row['codigo'] || '').trim(); 
                    const nombre = String(row['nombre'] || row['producto'] || '').trim(); 
                    const precio = parseFloat(String(row['precio'] || '0').replace(',', '.')) || 0; 
                    const stock = parseInt(row['stock'] || 0) || 0; 
                    if (!codigo || !nombre) return null; 
                    return { codigo, nombre, precio, stock }; 
                }).filter(p => p !== null); 
                if (productos.length === 0) return mostrarNotificacion('Datos inválidos', 'error'); 
                await supabaseClient.from('productos').upsert(productos, { onConflict: 'codigo' }); 
                mostrarNotificacion(`¡${productos.length} cargados!`, 'success'); 
                event.target.value = ''; 
                cargarProductosAdmin(); 
            } catch (err) { mostrarNotificacion('Error al leer archivo', 'error'); } 
        }; 
        reader.readAsArrayBuffer(file); 
    };

    window.abrirGeneradorEtiquetas = function() { window.open('modulos/etiquetas/index.html', '_blank'); };

    // ==================== NOTIFICACIONES ====================
    function mostrarNotificacion(mensaje, tipo) {
        let toast = document.getElementById('smartpos-toast'); if (toast) toast.remove();
        toast = document.createElement('div'); toast.id = 'smartpos-toast'; 
        toast.className = `toast ${tipo === 'error' ? 'toast-error' : 'toast-success'}`; 
        toast.textContent = mensaje;
        document.body.appendChild(toast); 
        // La clase "show" es la que hace visible el toast (la animación arranca en opacity 0)
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, tipo === 'error' ? 6000 : 3000);
    }
    // Disponible para los demás módulos (ventas.js, realtime.js, etc.)
    window.mostrarNotificacion = mostrarNotificacion;

    // ==================== DIÁLOGO DE CONFIRMACIÓN ====================
    let resolverConfirmacion = null;

    function abrirConfirmacion(opciones) {
        return new Promise((resolver) => {
            resolverConfirmacion = resolver;

            document.getElementById('confirmTitulo').textContent = opciones.titulo || '¿Seguro?';
            document.getElementById('confirmMensaje').textContent = opciones.mensaje || '';

            const boton = document.getElementById('confirmAceptar');
            boton.textContent = opciones.boton || 'Aceptar';
            boton.className = 'btn ' + (opciones.peligro ? 'btn-danger' : 'btn-primary');

            document.getElementById('modalConfirmar').classList.remove('hidden');
        });
    }

    window.cerrarConfirmacion = function (resultado) {
        document.getElementById('modalConfirmar').classList.add('hidden');

        const resolver = resolverConfirmacion;
        resolverConfirmacion = null;
        if (resolver) resolver(!!resultado);
    };

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && resolverConfirmacion) window.cerrarConfirmacion(false);
    });


        // ==================== MÓDULO DE COMPROBANTES Y DEVOLUCIONES ====================
    let comprobanteActual = null; // Guarda la venta cargada actualmente

       window.buscarComprobante = async function() {
        const query = document.getElementById('searchTicket').value.trim().toUpperCase();
        if (!query) return mostrarNotificacion('Escribe el número del ticket o escanéalo', 'error');

        const idLimpio = query.replace(/[^0-9]/g, ''); 
        if (!idLimpio) return mostrarNotificacion('Ese número no es un ticket', 'error');

        try {
            mostrarNotificacion('Buscando...', 'success');
            
            // Hacemos una sola consulta trayendo la venta, sus productos y sus devoluciones
            const { data: venta, error: ventaError } = await supabaseClient
                .from('ventas')
                .select(`
                    *,
                    venta_detalles (
                        *,
                        productos (nombre)
                    ),
                    devoluciones (
                        devolucion_detalles (
                            producto_id,
                            cantidad
                        )
                    )
                `)
                .eq('id', parseInt(idLimpio))
                .single();

            if (ventaError || !venta) throw new Error('Ticket no encontrado');

            // Procesamos las devoluciones para saber cuánto se ha devuelto de cada producto
            const devueltosMap = {};
            if (venta.devoluciones && venta.devoluciones.length > 0) {
                venta.devoluciones.forEach(dev => {
                    if (dev.devolucion_detalles) {
                        dev.devolucion_detalles.forEach(det => {
                            devueltosMap[det.producto_id] = (devueltosMap[det.producto_id] || 0) + det.cantidad;
                        });
                    }
                });
            }

            // Asignamos las cantidades disponibles
            (venta.venta_detalles || []).forEach(det => {
                det.cantidad_devuelta = devueltosMap[det.producto_id] || 0;
                det.cantidad_disponible = det.cantidad - det.cantidad_devuelta;
            });

            // Renombramos la propiedad para que el resto del código funcione igual
            venta.detalles = venta.venta_detalles || [];

            comprobanteActual = venta;
            renderizarComprobante();

        } catch (err) {
            document.getElementById('ticketResultado').classList.add('hidden');
            mostrarNotificacion(err.message, 'error');
        }
    };
    function renderizarComprobante() {
        const v = comprobanteActual;
        document.getElementById('ticketResultado').classList.remove('hidden');
        document.getElementById('tk-titulo').textContent = 'Ticket #' + String(v.id).padStart(6, '0');

        // Si la venta está anulada, todo volvió al inventario
        const anulada = v.estado === 'ANULADA';
        const totalDevuelto = anulada
            ? Number(v.total)
            : (v.detalles || []).reduce(
                (suma, d) => suma + Number(d.cantidad_devuelta || 0) * Number(d.precio_unitario || 0),
                0
            );
        const queda = Math.max(0, Number(v.total) - totalDevuelto);

        let info = `<b>Fecha:</b> ${new Date(v.created_at).toLocaleString()}<br><b>Vendedor:</b> ${v.usuario}<br><b>Total:</b> $${Number(v.total).toFixed(2)}`;
        if (totalDevuelto > 0) info += ` · <b>Devuelto:</b> $${totalDevuelto.toFixed(2)} · <b>Queda:</b> $${queda.toFixed(2)}`;
        if (anulada) info += '<br><b style="color: #991b1b;">Venta anulada: todo volvió al inventario</b>';

        document.getElementById('tk-info').innerHTML = info;

        // Estado del ticket
        const estadoDiv = document.getElementById('tk-estado');
        if (anulada) {
            estadoDiv.innerHTML = '<span class="badge-estado badge-anulada">Anulada</span>';
            document.getElementById('btnDevolver').style.display = 'none';
            document.getElementById('btnAnular').style.display = 'none';
        } else {
            estadoDiv.innerHTML = '<span class="badge-estado badge-emitida">Válida</span>';
            document.getElementById('btnAnular').style.display = 'inline-flex';
            
            // Si ya se devolvió todo, ocultamos el botón de devolver
            const hayDisponibles = (v.detalles || []).some(d => d.cantidad_disponible > 0);
            document.getElementById('btnDevolver').style.display = hayDisponibles ? 'inline-flex' : 'none';
        }

        // Tabla de detalles
        const tbody = document.getElementById('tk-detalles-body');
        if (!v.detalles || v.detalles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Esta venta no tiene líneas de detalle registradas</td></tr>';
        } else {
            tbody.innerHTML = v.detalles.map(d => {
                // En una venta anulada todas las unidades volvieron al stock
                const devuelta = anulada ? Number(d.cantidad) : Number(d.cantidad_devuelta || 0);
                const disponible = anulada ? 0 : Number(d.cantidad_disponible || 0);

                return `
                <tr>
                    <td>${d.productos ? d.productos.nombre : 'Producto Eliminado'}</td>
                    <td>$${Number(d.precio_unitario).toFixed(2)}</td>
                    <td>${d.cantidad}</td>
                    <td style="color: #b45309;">${devuelta}</td>
                    <td><b style="color: ${disponible > 0 ? '#16a34a' : '#dc2626'}">${disponible}</b></td>
                </tr>`;
            }).join('');
        }
    }

    // --- MODAL DE DEVOLUCIÓN ---
    window.abrirModalDevolucion = function() {
        if (!comprobanteActual) return;
        
        const disponibles = comprobanteActual.detalles.filter(d => d.cantidad_disponible > 0);
        if (disponibles.length === 0) return mostrarNotificacion('Esta venta no tiene productos para devolver', 'error');

        document.getElementById('modalDevolucion').classList.remove('hidden');
        document.getElementById('dev-motivo').value = '';

        const tbody = document.getElementById('dev-form-body');
        tbody.innerHTML = disponibles.map(d => `
            <tr>
                <td>${d.productos ? d.productos.nombre : 'Prod'}</td>
                <td>${d.cantidad_disponible}</td>
                <td><input type="number" class="input-cantidad dev-qty" data-id="${d.producto_id}" data-max="${d.cantidad_disponible}" min="0" max="${d.cantidad_disponible}" value="0"></td>
            </tr>
        `).join('');
    };

    window.cerrarModalDevolucion = function() {
        document.getElementById('modalDevolucion').classList.add('hidden');
    };

    window.procesarDevolucion = async function() {
        if (!comprobanteActual) return;

        const inputs = document.querySelectorAll('.dev-qty');
        const items = [];
        let ajustado = false;

        inputs.forEach(input => {
            const max = parseInt(input.dataset.max) || 0;
            let cant = parseInt(input.value) || 0;
            if (cant > max) { cant = max; ajustado = true; }
            if (cant > 0) {
                items.push({ id: parseInt(input.dataset.id), cantidad: cant });
            }
        });

        if (items.length === 0) return mostrarNotificacion('Escribe cuántas unidades devuelves', 'error');

        const motivo = document.getElementById('dev-motivo').value.trim();
        const unidades = items.reduce((suma, item) => suma + item.cantidad, 0);

        try {
            mostrarNotificacion('Devolviendo...', 'success');
            const { error } = await supabaseClient.rpc('procesar_devolucion', {
                p_venta_id: comprobanteActual.id,
                p_usuario: 'Vendedor Demo',
                p_motivo: motivo,
                p_items: items
            });
            if (error) throw error;

            const texto = `Devolviste ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`;
            mostrarNotificacion(ajustado ? texto + ' (no se puede devolver más)' : texto, 'success');
            cerrarModalDevolucion();
            await buscarComprobante(); // Recargar la vista
            cargarProductosAdmin(); // Recargar stock en admin
        } catch (err) {
            mostrarNotificacion('No se pudo devolver. ' + mensajeError(err), 'error');
        }
    };

    // --- ANULAR VENTA COMPLETA ---
    window.anularVentaCompleta = async function() {
        if (!comprobanteActual) return;
        const confirmado = await abrirConfirmacion({
            titulo: 'Anular venta',
            mensaje: 'Los productos volverán al inventario y la venta quedará sin efecto.',
            boton: 'Anular venta',
            peligro: true
        });
        if (!confirmado) return;

        try {
            mostrarNotificacion('Anulando...', 'success');
            const { error } = await supabaseClient.rpc('anular_venta_completa', {
                p_venta_id: comprobanteActual.id,
                p_usuario: 'Vendedor Demo',
                p_motivo: 'Anulación manual desde administración'
            });
            if (error) throw error;

            mostrarNotificacion('Venta anulada. Los productos volvieron al inventario.', 'success');
            buscarComprobante();
            cargarProductosAdmin();
        } catch (err) {
            mostrarNotificacion('No se pudo anular. ' + mensajeError(err), 'error');
        }
    };
});