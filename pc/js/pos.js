document.addEventListener('DOMContentLoaded', () => {
    
    // ==================== VARIABLES GLOBALES ====================
    let carrito = [];
    const IVA_RATE = 0.18; 
    
    // Variables para guardar los datos de las tablas y usarlos en los selects
    let listaCategorias = [];
    let listaProveedores = [];
    let listaUbicaciones = [];

    // Referencias al DOM
    const inputCode = document.getElementById('posCode');
    const cartBody = document.getElementById('cartBody');

    // ==================== INICIALIZACIÓN ====================
    
    // Cargar datos iniciales cuando abre la página
    cargarDatosIniciales();

    async function cargarDatosIniciales() {
        // Cargar categorías, proveedores y ubicaciones para los selects
        const [resCat, resProv, resUbi] = await Promise.all([
            supabaseClient.from('categorias').select('*'),
            supabaseClient.from('proveedores').select('*'),
            supabaseClient.from('ubicaciones').select('*')
        ]);

        listaCategorias = resCat.data || [];
        listaProveedores = resProv.data || [];
        listaUbicaciones = resUbi.data || [];

        llenarSelectsFormulario();
    }

    function llenarSelectsFormulario() {
        // Llenar Select de Proveedores
        const selProv = document.getElementById('newProveedor');
        if (selProv) {
            selProv.innerHTML = '<option value="">Proveedor...</option>' + 
                listaProveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        }

        // Llenar Select de Categorías
        const selCat = document.getElementById('newCategoria');
        if (selCat) {
            selCat.innerHTML = '<option value="">Categoría...</option>' + 
                listaCategorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }

        // Llenar Select de Ubicaciones
        const selUbi = document.getElementById('newUbicacion');
        if (selUbi) {
            selUbi.innerHTML = '<option value="">Ubicación...</option>' + 
                listaUbicaciones.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
        }
    }

    // ==================== LÓGICA DE PESTAÑAS ====================
    window.cambiarTab = function(tabId) {
        // Ocultar todos los contenidos
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        // Mostrar el seleccionado
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');

        // Si la pestaña es Clientes o Proveedores, recargar sus datos
        if (tabId === 'tab-clientes') cargarClientes();
        if (tabId === 'tab-proveedores') cargarProveedores();
        if (tabId === 'tab-ajustes') cargarAjustes();
    };

    // ==================== VISTAS (POS Y ADMIN) ====================
    window.abrirAdmin = function() {
        document.getElementById('pos-view').classList.add('hidden');
        document.getElementById('admin-view').classList.remove('hidden');
        cargarProductosAdmin();
    };

    window.cerrarAdmin = function() {
        document.getElementById('admin-view').classList.add('hidden');
        document.getElementById('pos-view').classList.remove('hidden');
        limpiarFormularios();
    };

    function limpiarFormularios() {
        document.querySelectorAll('input').forEach(input => {
            if(input.type !== 'file') input.value = '';
        });
        document.querySelectorAll('select').forEach(select => select.value = '');
    }

    // ==================== LÓGICA DEL CARRITO ====================
    if (inputCode) {
        inputCode.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') agregarProducto();
        });
    }

    window.agregarProducto = async function() {
        const codigo = inputCode.value.trim();
        if (!codigo) return;

        const { data, error } = await supabaseClient.from('productos').select('*').eq('codigo', codigo).limit(1);

        if (error || !data || data.length === 0) {
            inputCode.classList.add('input-error');
            setTimeout(() => inputCode.classList.remove('input-error'), 800);
            inputCode.value = '';
            return;
        }

        const producto = data[0];
        const existe = carrito.find(item => item.id === producto.id);
        
        if (existe) {
            existe.cantidad++;
        } else {
            carrito.push({
                id: producto.id, codigo: producto.codigo, nombre: producto.nombre,
                precio: Number(producto.precio), cantidad: 1
            });
        }
        inputCode.value = '';
        renderCarrito();
    };

    function renderCarrito() {
        cartBody.innerHTML = '';
        if (carrito.length === 0) {
            cartBody.innerHTML = '<tr><td colspan="6" class="empty">Carrito vacío</td></tr>';
            actualizarTotales(0);
            return;
        }

        carrito.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td><input type="number" class="input-cantidad" value="${item.cantidad}" min="1" onchange="actualizarCantidad(${index}, this.value)"></td>
                <td>$${(item.precio * item.cantidad).toFixed(2)}</td>
                <td><button class="btn-eliminar" onclick="eliminarItem(${index})">X</button></td>
            `;
            cartBody.appendChild(tr);
        });

        const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        actualizarTotales(subtotal);
    }

    function actualizarTotales(subtotal) {
        const iva = subtotal * IVA_RATE;
        document.getElementById('tSub').textContent = '$' + subtotal.toFixed(2);
        document.getElementById('tIva').textContent = '$' + iva.toFixed(2);
        document.getElementById('tTot').textContent = '$' + (subtotal + iva).toFixed(2);
    }

    window.actualizarCantidad = function(index, val) {
        let cant = parseInt(val) || 1;
        if (cant < 1) cant = 1;
        carrito[index].cantidad = cant;
        renderCarrito();
    };

    window.eliminarItem = function(index) {
        carrito.splice(index, 1);
        renderCarrito();
    };

    // ==================== COBRO (RPC Y TICKET) ====================
    window.cobrar = async function() {
        if (carrito.length === 0) return mostrarNotificacion('El carrito está vacío', 'error');

        const carritoCopia = carrito.map(item => ({ ...item, total: item.precio * item.cantidad }));
        const subtotal = carritoCopia.reduce((sum, item) => sum + item.total, 0);
        const iva = subtotal * IVA_RATE;
        const items = carritoCopia.map(item => ({ id: item.id, cantidad: item.cantidad }));

        try {
            mostrarNotificacion('Procesando venta...', 'success');
            const { data, error } = await supabaseClient.rpc('realizar_venta', {
                p_usuario: 'Vendedor Demo', p_items: items
            });
            if (error) throw error;

            mostrarNotificacion(`¡Venta #${data.venta_id} registrada!`, 'success');
            carrito = [];
            renderCarrito();
            
            if (typeof moduloTicket !== 'undefined') {
                moduloTicket.mostrar({
                    id: data.venta_id, usuario: 'Vendedor Demo', items: carritoCopia,
                    subtotal: subtotal, iva: iva, total: subtotal + iva
                });
            }
            if (!document.getElementById('admin-view').classList.contains('hidden')) cargarProductosAdmin();

        } catch (err) {
            console.error("Error al cobrar:", err);
            mostrarNotificacion('Error: ' + err.message, 'error');
        }
    };

    // ==================== GESTIÓN DE PRODUCTOS ====================
    window.cargarProductosAdmin = async function() {
        const tbody = document.getElementById('productTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Cargando...</td></tr>';

        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        if (error) return tbody.innerHTML = '<tr><td colspan="6" class="empty" style="color:red;">Error al cargar</td></tr>';
        
        if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay productos</td></tr>';

        tbody.innerHTML = '';
        data.forEach(prod => {
            const tr = document.createElement('tr');
            
            // Imagen (con placeholder si no hay)
            const tdImg = document.createElement('td');
            if (prod.imagen_url) {
                tdImg.innerHTML = `<img src="${prod.imagen_url}" class="img-thumbnail">`;
            } else {
                tdImg.innerHTML = `<div class="img-thumbnail" style="background:#e2e8f0;"></div>`;
            }

            tr.innerHTML = `
                <td>${prod.codigo}</td>
                <td>${prod.nombre}</td>
                <td>$${Number(prod.precio).toFixed(2)}</td>
                <td>${prod.stock}</td>
                <td><button class="btn-icon btn-danger" onclick="eliminarProducto(${prod.id})">🗑️</button></td>
            `;
            tr.insertBefore(tdImg, tr.firstChild);
            tbody.appendChild(tr);
        });
    };

    window.guardarProducto = async function() {
        const codigo = document.getElementById('newCodigo').value.trim();
        const nombre = document.getElementById('newNombre').value.trim();
        const precio = parseFloat(document.getElementById('newPrecio').value);
        const stock = parseInt(document.getElementById('newStock').value);
        
        // IDs de los selects (pueden venir vacíos)
        const proveedor_id = document.getElementById('newProveedor').value || null;
        const categoria_id = document.getElementById('newCategoria').value || null;
        const subcategoria_id = document.getElementById('newSubcategoria').value || null;
        const ubicacion_id = document.getElementById('newUbicacion').value || null;

        if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
            return mostrarNotificacion('Completa código, nombre, precio y stock.', 'error');
        }

        try {
            mostrarNotificacion('Guardando producto...', 'success');
            let imagen_url = null;

            // 1. Subir imagen si existe
            const fileInput = document.getElementById('newImagen');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabaseClient.storage
                    .from('productos-imagenes')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabaseClient.storage
                    .from('productos-imagenes')
                    .getPublicUrl(fileName);
                
                imagen_url = urlData.publicUrl;
            }

            // 2. Insertar en base de datos
            const { error } = await supabaseClient.from('productos').insert([{ 
                codigo, nombre, precio, stock, 
                proveedor_id, categoria_id, subcategoria_id, ubicacion_id, imagen_url 
            }]);

            if (error) throw error;

            mostrarNotificacion('Producto añadido', 'success');
            limpiarFormularios();
            cargarProductosAdmin();

        } catch (err) {
            console.error(err);
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
        const doc = document.getElementById('cliDoc').value.trim();
        const nombre = document.getElementById('cliNombre').value.trim();
        const tel = document.getElementById('cliTelefono').value.trim();
        const dir = document.getElementById('cliDireccion').value.trim();

        if (!doc || !nombre) return mostrarNotificacion('Doc y Nombre obligatorios', 'error');

        const { error } = await supabaseClient.from('clientes').insert([{
            numero_documento: doc, nombre, telefono: tel, direccion: dir
        }]);

        if (error) return mostrarNotificacion('Error (¿Doc duplicado?)', 'error');
        
        mostrarNotificacion('Cliente añadido', 'success');
        limpiarFormularios();
        cargarClientes();
    };

    async function cargarClientes() {
        const tbody = document.getElementById('clientesTableBody');
        const { data } = await supabaseClient.from('clientes').select('*').order('nombre');
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.numero_documento}</td><td>${c.nombre}</td>
                <td>${c.telefono || '-'}</td><td>${c.direccion || '-'}</td>
                <td><button class="btn-icon btn-danger" onclick="eliminarCliente(${c.id})">🗑️</button></td>
            </tr>
        `).join('');
    }

    window.eliminarCliente = async function(id) {
        if(!confirm('¿Eliminar?')) return;
        await supabaseClient.from('clientes').delete().eq('id', id);
        cargarClientes();
    };

    // ==================== GESTIÓN DE PROVEEDORES ====================
    window.guardarProveedor = async function() {
        const doc = document.getElementById('provDoc').value.trim();
        const nombre = document.getElementById('provNombre').value.trim();
        const tel = document.getElementById('provTelefono').value.trim();
        const contacto = document.getElementById('provContacto').value.trim();

        if (!doc || !nombre) return mostrarNotificacion('Doc y Razón Social obligatorios', 'error');

        const { error } = await supabaseClient.from('proveedores').insert([{
            numero_documento: doc, nombre, telefono: tel, contacto
        }]);

        if (error) return mostrarNotificacion('Error (¿Doc duplicado?)', 'error');
        
        mostrarNotificacion('Proveedor añadido', 'success');
        limpiarFormularios();
        cargarProveedores();
        cargarDatosIniciales(); // Recargar select de productos
    };

    async function cargarProveedores() {
        const tbody = document.getElementById('proveedoresTableBody');
        const { data } = await supabaseClient.from('proveedores').select('*').order('nombre');
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.numero_documento}</td><td>${p.nombre}</td>
                <td>${p.contacto || '-'}</td><td>${p.telefono || '-'}</td>
                <td><button class="btn-icon btn-danger" onclick="eliminarProveedor(${p.id})">🗑️</button></td>
            </tr>
        `).join('');
    }

    window.eliminarProveedor = async function(id) {
        if(!confirm('¿Eliminar?')) return;
        await supabaseClient.from('proveedores').delete().eq('id', id);
        cargarProveedores();
        cargarDatosIniciales();
    };

    // ==================== AJUSTES (CATEGORÍAS Y UBICACIONES) ====================
    window.guardarCategoria = async function() {
        const nombre = document.getElementById('newCatNombre').value.trim();
        if (!nombre) return;
        await supabaseClient.from('categorias').insert([{ nombre }]);
        document.getElementById('newCatNombre').value = '';
        cargarAjustes();
        cargarDatosIniciales();
    };

    window.guardarUbicacion = async function() {
        const nombre = document.getElementById('newUbicNombre').value.trim();
        if (!nombre) return;
        await supabaseClient.from('ubicaciones').insert([{ nombre }]);
        document.getElementById('newUbicNombre').value = '';
        cargarAjustes();
        cargarDatosIniciales();
    };

    async function cargarAjustes() {
        // Categorías
        const { data: cats } = await supabaseClient.from('categorias').select('*').order('nombre');
        document.getElementById('listaCategorias').innerHTML = cats.map(c => `
            <li>${c.nombre} <button onclick="eliminarCategoria(${c.id})" style="background:none;border:none;color:red;cursor:pointer;">X</button></li>
        `).join('');

        // Ubicaciones
        const { data: ubis } = await supabaseClient.from('ubicaciones').select('*').order('nombre');
        document.getElementById('listaUbicaciones').innerHTML = ubis.map(u => `
            <li>${u.nombre} <button onclick="eliminarUbicacion(${u.id})" style="background:none;border:none;color:red;cursor:pointer;">X</button></li>
        `).join('');
    }

    window.eliminarCategoria = async function(id) {
        await supabaseClient.from('categorias').delete().eq('id', id);
        cargarAjustes(); cargarDatosIniciales();
    };

    window.eliminarUbicacion = async function(id) {
        await supabaseClient.from('ubicaciones').delete().eq('id', id);
        cargarAjustes(); cargarDatosIniciales();
    };

    // ==================== EXCEL (IMPORTAR / EXPORTAR) ====================
    // ... (El código de Excel que ya teníamos se mantiene igual)
    window.descargarPlantillaExcel = function() {
        try {
            const data = [{ 'Codigo': '8480013525103', 'Nombre': 'Leche Entera 1L', 'Precio': 2.50, 'Stock': 50 }];
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 12 }, { wch: 12 }];
            for (let cell in ws) { if (cell.startsWith('A')) { ws[cell].t = 's'; ws[cell].z = '@'; } }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Productos");
            XLSX.writeFile(wb, "Plantilla_SmartPOS.xlsx");
        } catch (err) { mostrarNotificacion('Error al generar plantilla', 'error'); }
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
        const file = event.target.files[0];
        if (!file) return;
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
                    }
                    return cleanRow;
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

    window.abrirGeneradorEtiquetas = function() {
        window.open('modulos/etiquetas/index.html', '_blank');
    };

    // ==================== NOTIFICACIONES ====================
    function mostrarNotificacion(mensaje, tipo) {
        let toast = document.getElementById('smartpos-toast');
        if (toast) toast.remove();
        toast = document.createElement('div');
        toast.id = 'smartpos-toast';
        toast.className = `toast ${tipo === 'error' ? 'toast-error' : 'toast-success'}`;
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});