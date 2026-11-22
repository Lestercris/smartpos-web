// ==================== MÓDULO DE VENTAS / REPORTES ====================
// Depende de: db.js (supabaseClient, SMARTPOS_CONFIG), pos.js (mostrarNotificacion / cambiarTab),
//             ticket.js (moduloTicket) y XLSX (CDN) para exportar.

const VentasModule = (() => {
    const POR_PAGINA = 25;
    const LIMITE_SEGURIDAD = 5000; // Tope de filas por consulta para no saturar el navegador

    let ventas = [];               // Ventas del período consultado
    let pagina = 1;
    let unidadesPorVenta = {};     // venta_id -> unidades (solo de la página visible)
    let ventaActual = null;        // Venta abierta en el modal de detalle
    let rangoActual = null;        // { desde, hasta, etiqueta }
    

    const cacheDetalles = new Map();

    // ---------------- Utilidades ----------------
    function toast(mensaje, tipo) {
        if (typeof window.mostrarNotificacion === 'function') window.mostrarNotificacion(mensaje, tipo);
        else console.log(mensaje);
    }

    function moneda() {
        return (typeof SMARTPOS_CONFIG !== 'undefined' && SMARTPOS_CONFIG.MONEDA) ? SMARTPOS_CONFIG.MONEDA : '$';
    }

    function dinero(valor) {
        return moneda() + Number(valor || 0).toFixed(2);
    }

    function escapar(texto) {
        return String(texto === null || texto === undefined ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fecha(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function etiquetaPago(metodo) {
        const nombres = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
        return nombres[metodo] || 'Efectivo';
    }

    function folio(id) {
        return '#' + String(id).padStart(6, '0');
    }

    function esAnulada(v) {
        return String(v.estado || '').toUpperCase() === 'ANULADA';
    }

    function ymd(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function inicioDelDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
    function finDelDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

    // ---------------- Selección de rango ----------------
    function rangoSeleccionado() {
        const modo = document.getElementById('ventasRango')?.value || 'hoy';
        const ahora = new Date();

        if (modo === 'hoy') return { desde: inicioDelDia(ahora), hasta: finDelDia(ahora), etiqueta: 'Hoy' };
        if (modo === 'ayer') {
            const a = new Date(ahora); a.setDate(a.getDate() - 1);
            return { desde: inicioDelDia(a), hasta: finDelDia(a), etiqueta: 'Ayer' };
        }
        if (modo === '7dias') {
            const d = new Date(ahora); d.setDate(d.getDate() - 6);
            return { desde: inicioDelDia(d), hasta: finDelDia(ahora), etiqueta: 'Últimos 7 días' };
        }
        if (modo === 'mes') {
            const d = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            return { desde: inicioDelDia(d), hasta: finDelDia(ahora), etiqueta: 'Este mes' };
        }

        // Personalizado
        const parsear = (valor) => {
            const [y, m, d] = String(valor).split('-').map(Number);
            const f = new Date(y, (m || 1) - 1, d || 1);
            return isNaN(f.getTime()) ? null : f;
        };
        const desdeVal = parsear(document.getElementById('ventasDesde')?.value);
        const hastaVal = parsear(document.getElementById('ventasHasta')?.value);
        const desde = desdeVal ? inicioDelDia(desdeVal) : inicioDelDia(ahora);
        const hasta = hastaVal ? finDelDia(hastaVal) : finDelDia(ahora);
        return { desde, hasta, etiqueta: 'Período personalizado' };
    }

    // ---------------- Consultas ----------------
    async function traerVentas(desde, hasta) {
        const acumulado = [];
        const paso = 500;

        // Con "*" no falla si a la base le falta alguna columna nueva
        for (let offset = 0; offset < LIMITE_SEGURIDAD; offset += paso) {
            const respuesta = await supabaseClient
                .from('ventas')
                .select('*')
                .gte('created_at', desde.toISOString())
                .lte('created_at', hasta.toISOString())
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(offset, offset + paso - 1);

            if (respuesta.error) throw respuesta.error;

            const data = respuesta.data || [];
            acumulado.push(...data);
            if (data.length < paso) break;
        }
        return acumulado;
    }

    async function cargarUnidades(ids) {
        const mapa = {};
        if (!ids.length) return mapa;
        const { data, error } = await supabaseClient
            .from('venta_detalles')
            .select('venta_id, cantidad')
            .in('venta_id', ids);
        if (error) return mapa;
        (data || []).forEach(d => {
            mapa[d.venta_id] = (mapa[d.venta_id] || 0) + Number(d.cantidad || 0);
        });
        return mapa;
    }

    async function obtenerDetalles(ventaId) {
        if (cacheDetalles.has(ventaId)) return cacheDetalles.get(ventaId);
        const { data, error } = await supabaseClient
            .from('venta_detalles')
            .select('producto_id, cantidad, precio_unitario, productos (nombre)')
            .eq('venta_id', ventaId);
        if (error) throw error;
        cacheDetalles.set(ventaId, data || []);
        return data || [];
    }

    // ---------------- Render ----------------
    function renderKPIs() {
        const emitidas = ventas.filter(v => !esAnulada(v));
        const anuladas = ventas.filter(v => esAnulada(v));
        const ingresos = emitidas.reduce((s, v) => s + Number(v.total || 0), 0);
        const montoAnulado = anuladas.reduce((s, v) => s + Number(v.total || 0), 0);
        const promedio = emitidas.length ? ingresos / emitidas.length : 0;

        const set = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };
        set('kpiVentas', String(emitidas.length));
        set('kpiIngresos', dinero(ingresos));
        set('kpiPromedio', dinero(promedio));
        set('kpiAnuladas', String(anuladas.length));
        set('kpiAnuladasSub', dinero(montoAnulado));

        const periodo = document.getElementById('ventasPeriodo');
        if (periodo && rangoActual) {
            const { desde, hasta, etiqueta } = rangoActual;
            periodo.textContent = `${etiqueta} · ${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}`;
        }
    }

    async function renderTabla() {
        const tbody = document.getElementById('ventasTableBody');
        if (!tbody) return;

        const totalPaginas = Math.max(1, Math.ceil(ventas.length / POR_PAGINA));
        if (pagina > totalPaginas) pagina = totalPaginas;
        if (pagina < 1) pagina = 1;

        const inicio = (pagina - 1) * POR_PAGINA;
        const trozo = ventas.slice(inicio, inicio + POR_PAGINA);

        unidadesPorVenta = await cargarUnidades(trozo.map(v => v.id));

        if (!trozo.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay ventas en estas fechas</td></tr>';
        } else {
            tbody.innerHTML = trozo.map(v => {
                const anulada = esAnulada(v);
                return `<tr class="${anulada ? 'fila-anulada' : ''}">
                    <td><b>${folio(v.id)}</b></td>
                    <td>${fecha(v.created_at)}</td>
                    <td>${escapar(v.usuario || '-')}</td>
                    <td class="td-num">${unidadesPorVenta[v.id] || 0}</td>
                    <td class="td-num">${dinero(v.total)}</td>
                    <td>${etiquetaPago(v.metodo_pago)}</td>
                    <td><span class="badge-estado ${anulada ? 'badge-anulada' : 'badge-emitida'}">${anulada ? 'Anulada' : 'Válida'}</span></td>
                    <td class="td-acciones">
                        <button class="btn-icon btn-ver" title="Ver detalle" onclick="verVenta(${v.id})">👁️</button>
                        <button class="btn-icon btn-print" title="Reimprimir ticket" onclick="imprimirVenta(${v.id})">🖨️</button>
                    </td>
                </tr>`;
            }).join('');
        }

        const info = document.getElementById('ventasPaginationInfo');
        if (info) info.textContent = `Mostrando ${trozo.length} de ${ventas.length} ventas`;
        const pageInfo = document.getElementById('ventasPageInfo');
        if (pageInfo) pageInfo.textContent = `Página ${pagina} de ${totalPaginas}`;
        const prev = document.getElementById('ventasPrevBtn');
        if (prev) prev.disabled = pagina <= 1;
        const next = document.getElementById('ventasNextBtn');
        if (next) next.disabled = pagina >= totalPaginas;
    }

    // ---------------- API pública ----------------
    window.cargarVentas = async function () {
        const tbody = document.getElementById('ventasTableBody');
        if (!tbody) return;

        rangoActual = rangoSeleccionado();
        tbody.innerHTML = '<tr><td colspan="8" class="empty">Cargando ventas...</td></tr>';

        try {
            ventas = await traerVentas(rangoActual.desde, rangoActual.hasta);
            pagina = 1;
            renderKPIs();
            await renderTabla();
        } catch (err) {
            ventas = [];
            renderKPIs();
            tbody.innerHTML = `<tr><td colspan="8" class="empty" style="color:#dc2626;">No se pudieron cargar las ventas</td></tr>`;
            toast('No se pudieron cargar las ventas', 'error');
        }
    };

    window.cambiarRangoVentas = function (valor) {
        const custom = document.getElementById('ventasFechasCustom');
        if (custom) custom.classList.toggle('hidden', valor !== 'personalizado');
        if (valor !== 'personalizado') window.cargarVentas();
    };

    window.cambiarPaginaVentas = function (delta) {
        const totalPaginas = Math.max(1, Math.ceil(ventas.length / POR_PAGINA));
        const destino = pagina + delta;
        if (destino < 1 || destino > totalPaginas) return;
        pagina = destino;
        renderTabla();
    };

    window.verVenta = async function (id) {
        const venta = ventas.find(v => v.id === id);
        if (!venta) return toast('Venta no encontrada', 'error');

        try {
            const detalles = await obtenerDetalles(id);
            ventaActual = venta;
            mostrarDetalle(venta, detalles);
        } catch (err) {
            toast('No se pudo abrir la venta', 'error');
        }
    };

    function mostrarDetalle(venta, detalles) {
        const anulada = esAnulada(venta);

        document.getElementById('vd-titulo').textContent = 'Venta ' + folio(venta.id);
        document.getElementById('vd-info').innerHTML = `
            <b>Fecha:</b> ${fecha(venta.created_at)}<br>
            <b>Vendedor:</b> ${escapar(venta.usuario || '-')}<br>
            <b>Pago:</b> ${etiquetaPago(venta.metodo_pago)}${venta.vuelto > 0 ? ` · Vuelto ${dinero(venta.vuelto)}` : ''}<br>
            <b>Estado:</b> <span class="badge-estado ${anulada ? 'badge-anulada' : 'badge-emitida'}">${anulada ? 'Anulada' : 'Válida'}</span>
        `;

        const filas = (detalles || []).map(d => {
            const precio = Number(d.precio_unitario || 0);
            const cant = Number(d.cantidad || 0);
            return { nombre: d.productos ? d.productos.nombre : 'Producto eliminado', precio, cant, total: precio * cant };
        });

        const base = filas.reduce((s, f) => s + f.total, 0);
        const total = Number(venta.total || 0);
        const iva = Math.max(0, total - base);

        document.getElementById('vd-body').innerHTML = filas.length
            ? filas.map(f => `<tr>
                    <td>${escapar(f.nombre)}</td>
                    <td class="td-num">${dinero(f.precio)}</td>
                    <td class="td-num">${f.cant}</td>
                    <td class="td-num">${dinero(f.total)}</td>
                </tr>`).join('')
            : '<tr><td colspan="4" class="empty">Esta venta no tiene productos</td></tr>';

        document.getElementById('vd-sub').textContent = dinero(base);
        document.getElementById('vd-iva').textContent = dinero(iva);
        document.getElementById('vd-total').textContent = dinero(total);

        const btnDevolver = document.getElementById('vd-btnDevolver');
        if (btnDevolver) btnDevolver.style.display = anulada ? 'none' : 'inline-flex';

        document.getElementById('modalVentaDetalle').classList.remove('hidden');
    }

    window.cerrarDetalleVenta = function () {
        document.getElementById('modalVentaDetalle').classList.add('hidden');
        ventaActual = null;
    };

    window.imprimirVenta = async function (id) {
        const venta = ventas.find(v => v.id === id);
        if (!venta) return toast('Venta no encontrada', 'error');
        await reimprimir(venta);
    };

    window.imprimirVentaActual = async function () {
        if (!ventaActual) return;
        await reimprimir(ventaActual);
    };

    async function reimprimir(venta) {
        try {
            const detalles = await obtenerDetalles(venta.id);
            const items = (detalles || []).map(d => {
                const precio = Number(d.precio_unitario || 0);
                const cant = Number(d.cantidad || 0);
                return {
                    nombre: d.productos ? d.productos.nombre : 'Producto eliminado',
                    cantidad: cant,
                    precio,
                    total: precio * cant
                };
            });
            const base = items.reduce((s, i) => s + i.total, 0);
            const total = Number(venta.total || 0);

            if (typeof moduloTicket === 'undefined') return toast('El ticket aún no está listo', 'error');

            moduloTicket.mostrar({
                id: venta.id,
                usuario: venta.usuario || '-',
                fecha: venta.created_at,
                items,
                subtotal: base,
                iva: Math.max(0, total - base),
                total,
                metodo_pago: venta.metodo_pago,
                monto_recibido: venta.monto_recibido,
                vuelto: venta.vuelto
            });
        } catch (err) {
            toast('No se pudo imprimir el ticket', 'error');
        }
    }

    window.gestionarVentaActual = function () {
        if (!ventaActual) return;
        const id = ventaActual.id;
        window.cerrarDetalleVenta();
        if (typeof window.cambiarTab === 'function') window.cambiarTab('tab-comprobantes');
        const input = document.getElementById('searchTicket');
        if (input) {
            input.value = 'T-' + String(id).padStart(6, '0');
            if (typeof window.buscarComprobante === 'function') window.buscarComprobante();
        }
    };

    window.exportarVentasExcel = function () {
        if (!ventas.length) return toast('No hay ventas para descargar', 'error');
        if (typeof XLSX === 'undefined') return toast('El Excel no está disponible', 'error');

        try {
            const emitidas = ventas.filter(v => !esAnulada(v));
            const anuladas = ventas.filter(v => esAnulada(v));
            const ingresos = emitidas.reduce((s, v) => s + Number(v.total || 0), 0);
            const rango = rangoActual || rangoSeleccionado();

            const resumen = XLSX.utils.aoa_to_sheet([
                ['Reporte de ventas - SmartPOS'],
                ['Período', `${rango.etiqueta} (${ymd(rango.desde)} a ${ymd(rango.hasta)})`],
                ['Generado', new Date().toLocaleString()],
                [],
                ['Ventas', emitidas.length],
                ['Dinero vendido', Number(ingresos.toFixed(2))],
                ['Venta media', Number((emitidas.length ? ingresos / emitidas.length : 0).toFixed(2))],
                ['Anuladas', anuladas.length],
                ['Dinero anulado', Number(anuladas.reduce((s, v) => s + Number(v.total || 0), 0).toFixed(2))]
            ]);
            resumen['!cols'] = [{ wch: 22 }, { wch: 38 }];

            const filas = ventas.map(v => ({
                Ticket: folio(v.id),
                Fecha: new Date(v.created_at).toLocaleString(),
                Vendedor: v.usuario || '',
                Total: Number(v.total || 0),
                Estado: esAnulada(v) ? 'Anulada' : 'Válida'
            }));
            const hojaVentas = XLSX.utils.json_to_sheet(filas);
            hojaVentas['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];

            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, resumen, 'Resumen');
            XLSX.utils.book_append_sheet(libro, hojaVentas, 'Ventas');
            XLSX.writeFile(libro, `Ventas_${ymd(rango.desde)}_a_${ymd(rango.hasta)}.xlsx`);

            toast('Excel descargado', 'success');
        } catch (err) {
            toast('No se pudo descargar el Excel', 'error');
        }
    };

    // Fechas por defecto del filtro personalizado
    document.addEventListener('DOMContentLoaded', () => {
        const desde = document.getElementById('ventasDesde');
        const hasta = document.getElementById('ventasHasta');
        const hoy = ymd(new Date());
        if (desde && !desde.value) desde.value = hoy;
        if (hasta && !hasta.value) hasta.value = hoy;
    });

    return { recargar: () => window.cargarVentas() };
})();
