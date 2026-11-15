// ==================== VARIABLES GLOBALES ====================
let carrito = [];
const IVA_RATE = 0.18; // 18% de IVA

// Referencias al DOM
const inputCode = document.getElementById('posCode');
const cartBody = document.getElementById('cartBody');

// ==================== LÓGICA DEL CARRITO (POS) ====================

// Escuchar la tecla Enter en el input para agregar producto
if (inputCode) {
    inputCode.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            agregarProducto();
        }
    });
}

async function agregarProducto() {
    const codigo = inputCode.value.trim();
    if (!codigo) return;

    // Sanitización básica (solo letras, números y guiones)
    if (!/^[a-zA-Z0-9\-]+$/.test(codigo)) {
        inputCode.value = '';
        return;
    }

    // Buscamos el producto en Supabase
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('codigo', codigo)
        .limit(1);

    if (error || !data || data.length === 0) {
        console.warn('Producto no encontrado:', codigo);
        // Efecto visual rojo (podemos usar una clase de CSS)
        inputCode.classList.add('input-error');
        setTimeout(() => inputCode.classList.remove('input-error'), 800);
        inputCode.value = '';
        return;
    }

    const producto = data[0];

    // Verificamos si ya está en el carrito
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
}

function renderCarrito() {
    cartBody.innerHTML = ''; // Limpiamos la tabla

    if (carrito.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'empty';
        td.textContent = 'Carrito vacío';
        tr.appendChild(td);
        cartBody.appendChild(tr);
        actualizarTotales(0);
        return;
    }

    carrito.forEach((item, index) => {
        const tr = document.createElement('tr');

        const tdCodigo = document.createElement('td'); tdCodigo.textContent = item.codigo;
        const tdNombre = document.createElement('td'); tdNombre.textContent = item.nombre;
        const tdPrecio = document.createElement('td'); tdPrecio.textContent = '$' + item.precio.toFixed(2);
        const tdCant = document.createElement('td'); tdCant.textContent = item.cantidad;
        const tdTotal = document.createElement('td'); tdTotal.textContent = '$' + (item.precio * item.cantidad).toFixed(2);

        const tdAccion = document.createElement('td');
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'X';
        btnEliminar.className = 'btn-eliminar'; // Usaremos una clase CSS
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

function eliminarItem(index) {
    carrito.splice(index, 1);
    renderCarrito();
}

async function cobrar() {
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'error');
        return;
    }
    // Aquí irá la lógica de guardado en Supabase (siguiente paso)
    mostrarNotificacion('¡Cobro exitoso! (Lógica pendiente)', 'success');
}

// ==================== VISTAS (ADMIN Y POS) ====================

function abrirAdmin() {
    document.getElementById('pos-view').classList.add('hidden');
    document.getElementById('product-management').classList.remove('hidden');
    cargarProductosAdmin();
}

function cerrarAdmin() {
    document.getElementById('product-management').classList.add('hidden');
    document.getElementById('pos-view').classList.remove('hidden');
    
    // Limpiar formulario
    document.getElementById('newCodigo').value = '';
    document.getElementById('newNombre').value = '';
    document.getElementById('newPrecio').value = '';
    document.getElementById('newStock').value = '';
}

// ==================== GESTIÓN DE PRODUCTOS ====================

async function cargarProductosAdmin() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error cargando productos:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay productos registrados</td></tr>';
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
}

async function guardarProducto() {
    const codigo = document.getElementById('newCodigo').value.trim();
    const nombre = document.getElementById('newNombre').value.trim();
    const precio = parseFloat(document.getElementById('newPrecio').value);
    const stock = parseInt(document.getElementById('newStock').value);

    if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
        mostrarNotificacion('Por favor, rellena todos los campos correctamente.', 'error');
        return;
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(codigo)) {
        mostrarNotificacion('El código solo puede contener letras, números y guiones.', 'error');
        return;
    }

    const { error } = await supabaseClient
        .from('productos')
        .insert([{ codigo, nombre, precio, stock }]);

    if (error) {
        console.error('Error al guardar:', error);
        if (error.code === '23505') {
            mostrarNotificacion('Ese código de producto ya existe.', 'error');
        } else if (error.code === '42501') {
            mostrarNotificacion('Error de permisos en Supabase (RLS).', 'error');
        } else {
            mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        }
        return;
    }

    document.getElementById('newCodigo').value = '';
    document.getElementById('newNombre').value = '';
    document.getElementById('newPrecio').value = '';
    document.getElementById('newStock').value = '';
    
    mostrarNotificacion('Producto añadido correctamente', 'success');
    cargarProductosAdmin();
}

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    const { error } = await supabaseClient
        .from('productos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar:', error);
        mostrarNotificacion('No se pudo eliminar el producto.', 'error');
        return;
    }

    mostrarNotificacion('Producto eliminado', 'success');
    cargarProductosAdmin();
}

// ==================== IMPORTAR / EXPORTAR EXCEL ====================

async function exportarProductosExcel() {
    try {
        mostrarNotificacion('Obteniendo productos...', 'success');
        
        const { data, error } = await supabaseClient
            .from('productos')
            .select('codigo, nombre, precio, stock')
            .order('nombre', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) {
            mostrarNotificacion('No hay productos para exportar', 'error');
            return;
        }

        const dataFormateada = data.map(p => ({
            'Código': p.codigo,
            'Nombre': p.nombre,
            'Precio': p.precio,
            'Stock': p.stock
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataFormateada);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
        
        XLSX.writeFile(workbook, "Inventario_SmartPOS.xlsx");
        mostrarNotificacion('Inventario exportado correctamente', 'success');

    } catch (err) {
        console.error("Error al exportar:", err);
        mostrarNotificacion('Error al exportar el archivo', 'error');
    }
}

async function importarProductosExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json.length === 0) {
                mostrarNotificacion('El archivo está vacío', 'error');
                return;
            }

            mostrarNotificacion(`Procesando ${json.length} productos...`, 'success');

            const productosParaSubir = json.map(row => {
                const codigo = String(row['Código'] || row['Codigo'] || row['codigo'] || '').trim();
                const nombre = String(row['Nombre'] || row['nombre'] || row['Producto'] || '').trim();
                const precio = parseFloat(row['Precio'] || row['precio'] || 0);
                const stock = parseInt(row['Stock'] || row['stock'] || 0);

                if (!codigo || !nombre) return null;

                return { codigo, nombre, precio, stock };
            }).filter(p => p !== null);

            if (productosParaSubir.length === 0) {
                mostrarNotificacion('No se encontraron datos válidos.', 'error');
                return;
            }

            const { error } = await supabaseClient
                .from('productos')
                .upsert(productosParaSubir, { onConflict: 'codigo' });

            if (error) throw error;

            mostrarNotificacion(`¡Éxito! ${productosParaSubir.length} productos cargados.`, 'success');
            
            event.target.value = '';
            cargarProductosAdmin();

        } catch (err) {
            console.error("Error al importar:", err);
            mostrarNotificacion('Error al leer el archivo Excel.', 'error');
        }
    };

    reader.readAsArrayBuffer(file);
}

// ==================== MÓDULO DE ETIQUETAS ====================

function abrirGeneradorEtiquetas() {
    // Abre el módulo en una nueva pestaña
    window.open('modulos/etiquetas/index.html', '_blank');
}

// ==================== NOTIFICACIONES (TOAST) ====================

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