document.addEventListener('DOMContentLoaded', () => {
    
    // ==================== VARIABLES GLOBALES ====================
    let carrito = [];
    const IVA_RATE = 0.18; 
    let turnoActual = null; // Variable global para saber si hay caja abierta
    
    let listaCategorias = [], listaProveedores = [], listaUbicaciones = [], listaUMedidas = [], listaTiposDoc = [];
    let todosLosProductos = [], productosFiltrados = [], paginaActual = 1, itemsPorPagina = 10;

    const inputCode = document.getElementById('posCode');
    const cartBody = document.getElementById('cartBody');

    // ==================== INICIALIZACIÓN ====================
    cargarDatosIniciales();
    verificarEstadoCaja(); 

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
        document.getElementById('cajaModalLabel').textContent = 'Monto Inicial (Vuelto)';
        document.getElementById('cajaMonto').value = '';
        document.getElementById('cajaNotas').value = '';
        document.getElementById('cajaResultado').classList.add('hidden');
        document.getElementById('btnConfirmarCaja').onclick = confirmarAbrirCaja;
    };

    window.abrirModalCerrarCaja = async function() {
        if (!turnoActual) return;
        
        const { data: ventas } = await supabaseClient.from('ventas').select('total').gte('created_at', turnoActual.fecha_apertura);
        const totalVentas = ventas.reduce((sum, v) => sum + Number(v.total), 0);
        const montoSistema = Number(turnoActual.monto_inicial) + totalVentas;

        document.getElementById('modalCaja').classList.remove('hidden');
        document.getElementById('cajaModalTitle').textContent = 'Cerrar Caja';
        document.getElementById('cajaModalLabel').textContent = 'Efectivo Contado en Caja';
        document.getElementById('cajaMonto').value = '';
        document.getElementById('cajaNotas').value = '';
        
        const resDiv = document.getElementById('cajaResultado');
        resDiv.classList.remove('hidden');
        resDiv.innerHTML = `<p><b>Monto Inicial:</b> $${Number(turnoActual.monto_inicial).toFixed(2)}</p>
                            <p><b>Ventas:</b> $${totalVentas.toFixed(2)}</p>
                            <p style="border-top:1px solid #ccc; padding-top:5px; margin-top:5px;"><b>Monto Sistema:</b> $${montoSistema.toFixed(2)}</p>`;
                            
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
        
        const msj = diferencia === 0 ? '¡Caja cuadrada perfectamente!' : `Cierre con ${diferencia > 0 ? 'sobrante' : 'faltante'} de $${Math.abs(diferencia).toFixed(2)}`;
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
        const existe = carrito.find(item => item.id === producto.id);
        if (existe) existe.cantidad++;
        else carrito.push({ id: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: Number(producto.precio), cantidad: 1, aplica_iva: producto.aplica_iva });
        
        inputCode.value = ''; renderCarrito();
    };

    function renderCarrito() {
        cartBody.innerHTML = '';
        if (carrito.length === 0) { cartBody.innerHTML = '<tr><td colspan="6" class="empty">Carrito vacío</td></tr>'; actualizarTotales(); return; }
        carrito.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.codigo}</td><td>${item.nombre}</td><td>$${item.precio.toFixed(2)}</td>
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

    window.cobrar = async function() {
        if (!turnoActual) return mostrarNotificacion('Debes abrir la caja primero', 'error');
        if (carrito.length === 0) return mostrarNotificacion('El carrito está vacío', 'error');
        
        const carritoCopia = carrito.map(item => ({ ...item, total: item.precio * item.cantidad }));
        let sGrav = 0, sExento = 0;
        carritoCopia.forEach(item => { if (item.aplica_iva) sGrav += item.total; else sExento += item.total; });
        const subtotal = sGrav + sExento, iva = sGrav * IVA_RATE, total = subtotal + iva;
        
        try {
            mostrarNotificacion('Procesando...', 'success');
            const { data, error } = await supabaseClient.rpc('realizar_venta', { 
                p_usuario: 'Vendedor Demo', 
                p_items: carritoCopia.map(item => ({ id: item.id, cantidad: item.cantidad })) 
            });
            if (error) throw error;
            
            mostrarNotificacion(`¡Venta #${data.venta_id}!`, 'success');
            carrito = []; renderCarrito();
            
            if (typeof moduloTicket !== 'undefined') {
                moduloTicket.mostrar({ id: data.venta_id, usuario: 'Vendedor Demo', items: carritoCopia, subtotal, iva, total });
            }
            if (!document.getElementById('admin-view').classList.contains('hidden')) cargarProductosAdmin();
        } catch (err) { mostrarNotificacion('Error: ' + err.message, 'error'); }
    };
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
                const tr = document.createElement('tr');
                const tdImg = document.createElement('td');
                tdImg.innerHTML = prod.imagen_url ? `<img src="${prod.imagen_url}" class="img-thumbnail">` : `<div class="img-thumbnail" style="background:#e2e8f0;"></div>`;
                tr.innerHTML = `
                    <td>${prod.codigo}</td><td>${prod.nombre}</td><td>${prod.categorias ? prod.categorias.nombre : '-'}</td><td>${prod.unidades_medida ? prod.unidades_medida.abreviatura : '-'}</td><td>${prod.stock_minimo || 0}</td><td style="font-weight:bold; color:${prod.stock <= prod.stock_minimo ? 'red' : 'green'}">${prod.stock}</td><td>$${pC.toFixed(2)}</td><td>$${pV.toFixed(2)}</td><td style="color: ${prod.aplica_iva ? '#16a34a' : '#dc2626'}; font-weight:bold;">${prod.aplica_iva ? 'Sí' : 'No'}</td><td>$${margen.toFixed(2)}</td><td>${pct}%</td><td>${prod.proveedores ? prod.proveedores.nombre : '-'}</td><td><button class="btn-icon btn-danger" onclick="eliminarProducto(${prod.id})">🗑️</button></td>`;
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
            mostrarNotificacion('Error: ' + err.message, 'error'); 
        }
    };

    window.eliminarProducto = async function(id) { 
        if (!confirm('¿Eliminar producto?')) return; 
        await supabaseClient.from('productos').delete().eq('id', id); 
        cargarProductosAdmin(); 
    };

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
    window.eliminarCliente = async function(id) { if(!confirm('¿Eliminar?')) return; await supabaseClient.from('clientes').delete().eq('id', id); cargarClientes(); };

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
    window.eliminarProveedor = async function(id) { if(!confirm('¿Eliminar?')) return; await supabaseClient.from('proveedores').delete().eq('id', id); cargarProveedores(); cargarDatosIniciales(); };

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
    window.eliminarCategoria = async function(id) { await supabaseClient.from('categorias').delete().eq('id', id); cargarAjustes(); cargarDatosIniciales(); };

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
    window.eliminarSubcategoria = async function(id) { await supabaseClient.from('subcategorias').delete().eq('id', id); cargarAjustes(); };

    window.guardarUbicacion = async function() { 
        const nombre = document.getElementById('newUbicNombre').value.trim(); 
        if (!nombre) return; 
        await supabaseClient.from('ubicaciones').insert([{ nombre }]); 
        document.getElementById('newUbicNombre').value = ''; 
        cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarUbicacion = async function(id) { await supabaseClient.from('ubicaciones').delete().eq('id', id); cargarAjustes(); cargarDatosIniciales(); };

    window.guardarUMedida = async function() { 
        const nombre = document.getElementById('newUMedNombre').value.trim(), abrev = document.getElementById('newUMedAbrev').value.trim().toUpperCase(); 
        if (!nombre || !abrev) return mostrarNotificacion('Campos obligatorios', 'error'); 
        const { error } = await supabaseClient.from('unidades_medida').insert([{ nombre, abreviatura: abrev }]); 
        if (error) return mostrarNotificacion('Error (¿Ya existe?)', 'error'); 
        document.getElementById('newUMedNombre').value = ''; document.getElementById('newUMedAbrev').value = ''; 
        mostrarNotificacion('Unidad añadida', 'success'); cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarUMedida = async function(id) { await supabaseClient.from('unidades_medida').delete().eq('id', id); cargarAjustes(); cargarDatosIniciales(); };

    window.guardarTipoDoc = async function() { 
        const nombre = document.getElementById('newTipoDocNombre').value.trim(), abrev = document.getElementById('newTipoDocAbrev').value.trim().toUpperCase(); 
        if (!nombre || !abrev) return mostrarNotificacion('Campos obligatorios', 'error'); 
        const { error } = await supabaseClient.from('tipos_documento').insert([{ nombre, abreviatura: abrev }]); 
        if (error) return mostrarNotificacion('Error (¿Ya existe?)', 'error'); 
        document.getElementById('newTipoDocNombre').value = ''; document.getElementById('newTipoDocAbrev').value = ''; 
        mostrarNotificacion('Tipo añadido', 'success'); cargarAjustes(); cargarDatosIniciales(); 
    };
    window.eliminarTipoDoc = async function(id) { await supabaseClient.from('tipos_documento').delete().eq('id', id); cargarAjustes(); cargarDatosIniciales(); };

    async function cargarAjustes() {
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
        setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
    }


        // ==================== MÓDULO DE COMPROBANTES Y DEVOLUCIONES ====================
    let comprobanteActual = null; // Guarda la venta cargada actualmente

    window.buscarComprobante = async function() {
        const query = document.getElementById('searchTicket').value.trim().toUpperCase();
        if (!query) return mostrarNotificacion('Escribe o escanea un código de ticket', 'error');

        // Limpiamos el prefijo 'T-' si viene del código de barras
        const idLimpio = query.replace(/[^0-9]/g, ''); 
        if (!idLimpio) return mostrarNotificacion('Formato de ticket inválido', 'error');

        try {
            mostrarNotificacion('Buscando ticket...', 'success');
            
            // 1. Buscar la venta
            const { data: venta, error: ventaError } = await supabaseClient
                .from('ventas')
                .select('*')
                .eq('id', parseInt(idLimpio))
                .single();

            if (ventaError || !venta) throw new Error('Ticket no encontrado');

            // 2. Buscar los detalles de la venta
            const { data: detalles, error: detError } = await supabaseClient
                .from('venta_detalles')
                .select(`*, productos (nombre)`)
                .eq('venta_id', venta.id);

            if (detError) throw detError;

            // 3. Buscar las devoluciones previas para calcular cuánto queda disponible
            const { data: devoluciones } = await supabaseClient
                .from('devolucion_detalles')
                .select(`producto_id, cantidad, devoluciones!inner(venta_id)`)
                .eq('devoluciones.venta_id', venta.id);

            const devueltosMap = {};
            if (devoluciones) {
                devoluciones.forEach(d => {
                    devueltosMap[d.producto_id] = (devueltosMap[d.producto_id] || 0) + d.cantidad;
                });
            }

            // Agregar la cantidad devuelta a cada detalle
            detalles.forEach(det => {
                det.cantidad_devuelta = devueltosMap[det.producto_id] || 0;
                det.cantidad_disponible = det.cantidad - det.cantidad_devuelta;
            });

            comprobanteActual = { ...venta, detalles };
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
        document.getElementById('tk-info').innerHTML = `
            <b>Fecha:</b> ${new Date(v.created_at).toLocaleString()}<br>
            <b>Usuario:</b> ${v.usuario} | <b>Total:</b> $${Number(v.total).toFixed(2)}
        `;

        // Estado del ticket
        const estadoDiv = document.getElementById('tk-estado');
        if (v.estado === 'ANULADA') {
            estadoDiv.innerHTML = '<span class="badge-estado badge-anulada">ANULADA</span>';
            document.getElementById('btnDevolver').style.display = 'none';
            document.getElementById('btnAnular').style.display = 'none';
        } else {
            estadoDiv.innerHTML = '<span class="badge-estado badge-emitida">EMITIDA</span>';
            document.getElementById('btnAnular').style.display = 'inline-flex';
            
            // Si ya se devolvió todo, ocultamos el botón de devolver
            const hayDisponibles = v.detalles.some(d => d.cantidad_disponible > 0);
            document.getElementById('btnDevolver').style.display = hayDisponibles ? 'inline-flex' : 'none';
        }

        // Tabla de detalles
        const tbody = document.getElementById('tk-detalles-body');
        tbody.innerHTML = v.detalles.map(d => `
            <tr>
                <td>${d.productos ? d.productos.nombre : 'Producto Eliminado'}</td>
                <td>$${Number(d.precio_unitario).toFixed(2)}</td>
                <td>${d.cantidad}</td>
                <td style="color: #b45309;">${d.cantidad_devuelta}</td>
                <td><b style="color: ${d.cantidad_disponible > 0 ? '#16a34a' : '#dc2626'}">${d.cantidad_disponible}</b></td>
            </tr>
        `).join('');
    }

    // --- MODAL DE DEVOLUCIÓN ---
    window.abrirModalDevolucion = function() {
        if (!comprobanteActual) return;
        
        const disponibles = comprobanteActual.detalles.filter(d => d.cantidad_disponible > 0);
        if (disponibles.length === 0) return mostrarNotificacion('No hay productos disponibles para devolver', 'error');

        document.getElementById('modalDevolucion').classList.remove('hidden');
        document.getElementById('dev-motivo').value = '';

        const tbody = document.getElementById('dev-form-body');
        tbody.innerHTML = disponibles.map(d => `
            <tr>
                <td>${d.productos ? d.productos.nombre : 'Prod'}</td>
                <td>${d.cantidad_disponible}</td>
                <td><input type="number" class="input-cantidad dev-qty" data-id="${d.producto_id}" min="0" max="${d.cantidad_disponible}" value="0"></td>
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
        
        inputs.forEach(input => {
            const cant = parseInt(input.value);
            if (cant > 0) {
                items.push({ id: parseInt(input.dataset.id), cantidad: cant });
            }
        });

        if (items.length === 0) return mostrarNotificacion('Indica al menos una cantidad a devolver', 'error');
        
        const motivo = document.getElementById('dev-motivo').value.trim();

        try {
            mostrarNotificacion('Procesando devolución...', 'success');
            const { error } = await supabaseClient.rpc('procesar_devolucion', {
                p_venta_id: comprobanteActual.id,
                p_usuario: 'Vendedor Demo',
                p_motivo: motivo,
                p_items: items
            });
            if (error) throw error;

            mostrarNotificacion('Devolución procesada con éxito', 'success');
            cerrarModalDevolucion();
            buscarComprobante(); // Recargar la vista
            cargarProductosAdmin(); // Recargar stock en admin
        } catch (err) {
            mostrarNotificacion('Error: ' + err.message, 'error');
        }
    };

    // --- ANULAR VENTA COMPLETA ---
    window.anularVentaCompleta = async function() {
        if (!comprobanteActual) return;
        if (!confirm('¿Estás seguro de anular esta venta? Se devolverá todo el stock al inventario.')) return;

        try {
            mostrarNotificacion('Anulando venta...', 'success');
            const { error } = await supabaseClient.rpc('anular_venta_completa', {
                p_venta_id: comprobanteActual.id,
                p_usuario: 'Vendedor Demo',
                p_motivo: 'Anulación manual desde administración'
            });
            if (error) throw error;

            mostrarNotificacion('Venta anulada correctamente', 'success');
            buscarComprobante();
            cargarProductosAdmin();
        } catch (err) {
            mostrarNotificacion('Error: ' + err.message, 'error');
        }
    };
});