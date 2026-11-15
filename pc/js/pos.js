// Esperamos a que todo el HTML esté cargado antes de ejecutar nada
document.addEventListener('DOMContentLoaded', () => {
    
    // ==================== VARIABLES GLOBALES ====================
    let carrito = [];
    const IVA_RATE = 0.18; // 18% de IVA

    // Referencias al DOM
    const inputCode = document.getElementById('posCode');
    const cartBody = document.getElementById('cartBody');

    // ==================== LÓGICA DEL CARRITO ====================
    if (inputCode) {
        inputCode.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                agregarProducto();
            }
        });
    }

    window.abrirAdmin = function() {
        document.getElementById('pos-view').classList.add('hidden');
        document.getElementById('product-management').classList.remove('hidden');
        cargarProductosAdmin();
    };

    window.cerrarAdmin = function() {
        document.getElementById('product-management').classList.add('hidden');
        document.getElementById('pos-view').classList.remove('hidden');
        
        // Limpiar formulario
        document.getElementById('newCodigo').value = '';
        document.getElementById('newNombre').value = '';
        document.getElementById('newPrecio').value = '';
        document.getElementById('newStock').value = '';
    };

    window.agregarProducto = async function() {
        const codigo = inputCode.value.trim();
        if (!codigo) return;

        // Sanitización básica
        if (!/^[a-zA-Z0-9\-]+$/.test(codigo)) {
            inputCode.value = '';
            return;
        }

        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('codigo', codigo)
            .limit(1);

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
                id: producto.id,
                codigo: producto.codigo,
                nombre: producto.nombre,
                precio: Number(producto.precio),
                cantidad: 1
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
            
            // Usamos textContent en los td para evitar inyecciones HTML (XSS)
            const tdCodigo = document.createElement('td'); tdCodigo.textContent = item.codigo;
            const tdNombre = document.createElement('td'); tdNombre.textContent = item.nombre;
            const tdPrecio = document.createElement('td'); tdPrecio.textContent = '$' + item.precio.toFixed(2);
            const tdCant = document.createElement('td'); tdCant.textContent = item.cantidad;
            const tdTotal = document.createElement('td'); tdTotal.textContent = '$' + (item.precio * item.cantidad).toFixed(2);
            
            const tdAccion = document.createElement('td');
            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = 'X';
            btnEliminar.className = 'btn-eliminar';
            btnEliminar.onclick = () => eliminarItem(index);
            tdAccion.appendChild(btnEliminar);

            tr.appendChild(tdCodigo);
            tr.appendChild(tdNombre);
            tr.appendChild(tdPrecio);
            tr.appendChild(tdCant);
            tr.appendChild(tdTotal);
            tr.appendChild(tdAccion);
            
            cartBody.appendChild(tr);
        });

        const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        actualizarTotales(subtotal);
    }

    function actualizarTotales(subtotal) {
        const iva = subtotal * IVA_RATE;
        const total = subtotal + iva;
        
        document.getElementById('tSub').textContent = '$' + subtotal.toFixed(2);
        document.getElementById('tIva').textContent = '$' + iva.toFixed(2);
        document.getElementById('tTot').textContent = '$' + total.toFixed(2);
    }

    window.eliminarItem = function(index) {
        carrito.splice(index, 1);
        renderCarrito();
    };

    window.cobrar = function() {
        if (carrito.length === 0) {
            mostrarNotificacion('El carrito está vacío', 'error');
            return;
        }
        mostrarNotificacion('¡Cobro exitoso! (Lógica pendiente)', 'success');
    };

    // ==================== GESTIÓN DE PRODUCTOS ====================
    window.cargarProductosAdmin = async function() {
        const tbody = document.getElementById('productTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="empty">Cargando...</td></tr>';

        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre', { ascending: true });

        if (error) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty" style="color:red;">Error al cargar</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay productos registrados</td></tr>';
            return;
        }

        data.forEach(prod => {
            const tr = document.createElement('tr');
            
            const tdCodigo = document.createElement('td'); tdCodigo.textContent = prod.codigo;
            const tdNombre = document.createElement('td'); tdNombre.textContent = prod.nombre;
            const tdPrecio = document.createElement('td'); tdPrecio.textContent = '$' + Number(prod.precio).toFixed(2);
            const tdStock = document.createElement('td'); tdStock.textContent = prod.stock;
            
            const tdAcciones = document.createElement('td');
            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = '🗑️';
            btnEliminar.className = 'btn-icon btn-danger';
            btnEliminar.onclick = () => eliminarProducto(prod.id);
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdCodigo);
            tr.appendChild(tdNombre);
            tr.appendChild(tdPrecio);
            tr.appendChild(tdStock);
            tr.appendChild(tdAcciones);
            tbody.appendChild(tr);
        });
    };

    window.guardarProducto = async function() {
        const codigo = document.getElementById('newCodigo').value.trim();
        const nombre = document.getElementById('newNombre').value.trim();
        const precio = parseFloat(document.getElementById('newPrecio').value);
        const stock = parseInt(document.getElementById('newStock').value);

        if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
            mostrarNotificacion('Rellena todos los campos correctamente.', 'error');
            return;
        }

        const { error } = await supabaseClient.from('productos').insert([{ codigo, nombre, precio, stock }]);

        if (error) {
            if (error.code === '23505') {
                mostrarNotificacion('Ese código ya existe.', 'error');
            } else {
                mostrarNotificacion('Error al guardar. Revisa permisos.', 'error');
            }
            return;
        }

        document.getElementById('newCodigo').value = '';
        document.getElementById('newNombre').value = '';
        document.getElementById('newPrecio').value = '';
        document.getElementById('newStock').value = '';
        
        mostrarNotificacion('Producto añadido', 'success');
        cargarProductosAdmin();
    };

    window.eliminarProducto = async function(id) {
        if (!confirm('¿Eliminar este producto?')) return;
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        
        if (!error) {
            mostrarNotificacion('Producto eliminado', 'success');
            cargarProductosAdmin();
        }
    };

    // ==================== IMPORTAR / EXPORTAR ====================
    
    window.descargarPlantillaExcel = function() {
        try {
            const data = [
                { 'Codigo': 'Ejemplo: 8480013525103', 'Nombre': 'Ejemplo: Leche Entera 1L', 'Precio': 2.50, 'Stock': 50 }
            ];

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 12 }, { wch: 12 }];

            // Forzar que la columna A sea texto en Excel
            for (let cell in ws) {
                if (cell.startsWith('A')) {
                    ws[cell].t = 's';
                    ws[cell].z = '@';
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Productos");
            XLSX.writeFile(wb, "Plantilla_SmartPOS.xlsx");
            mostrarNotificacion('Plantilla descargada correctamente', 'success');
        } catch (err) {
            mostrarNotificacion('Error al generar la plantilla', 'error');
        }
    };

    window.exportarProductosExcel = async function() {
        mostrarNotificacion('Exportando...', 'success');
        const { data, error } = await supabaseClient.from('productos').select('codigo, nombre, precio, stock');
        
        if (error || !data.length) {
            mostrarNotificacion('No hay productos para exportar', 'error');
            return;
        }

        const dataFormateada = data.map(p => ({
            'Codigo': p.codigo,
            'Nombre': p.nombre,
            'Precio': p.precio,
            'Stock': p.stock
        }));

        const ws = XLSX.utils.json_to_sheet(dataFormateada);
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
                // 1. Leer el archivo
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                // Log para depurar en consola
                console.log("Datos leídos del Excel:", json);

                if (json.length === 0) {
                    mostrarNotificacion('El archivo está vacío.', 'error');
                    return;
                }

                // 2. Limpiar nombres de columnas (sin tildes, minúsculas, sin BOM)
                const cleanJson = json.map(row => {
                    const cleanRow = {};
                    for (let key in row) {
                        const cleanKey = key.trim()
                            .replace(/^\uFEFF/, '') 
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "");
                        
                        cleanRow[cleanKey] = row[key];
                    }
                    return cleanRow;
                });

                // 3. Mapear los datos
                const productos = cleanJson.map(row => {
                    const codigo = String(row['codigo'] || '').trim();
                    const nombre = String(row['nombre'] || row['producto'] || '').trim();
                    
                    const precioStr = String(row['precio'] || '0').replace(',', '.');
                    const precio = parseFloat(precioStr) || 0;
                    
                    const stock = parseInt(row['stock'] || 0) || 0;

                    if (!codigo || !nombre) return null;
                    
                    return { codigo, nombre, precio, stock };
                }).filter(p => p !== null);

                if (productos.length === 0) {
                    mostrarNotificacion('No se encontraron columnas válidas. Revisa la consola (F12).', 'error');
                    return;
                }

                // 4. Guardar en Supabase
                const { error } = await supabaseClient
                    .from('productos')
                    .upsert(productos, { onConflict: 'codigo' });

                if (error) throw error;

                // 5. Éxito
                mostrarNotificacion(`¡Éxito! ${productos.length} productos cargados.`, 'success');
                event.target.value = ''; 
                cargarProductosAdmin(); 

            } catch (err) {
                console.error("Error detallado:", err);
                mostrarNotificacion('Error al leer el archivo. Revisa la consola (F12).', 'error');
            }
        };
        
        reader.readAsArrayBuffer(file);
    };

    // ==================== ETIQUETAS ====================
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