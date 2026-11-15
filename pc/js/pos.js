const inputCode = document.getElementById('posCode');
const cartBody = document.getElementById('cartBody');

// Escuchar la tecla Enter en el input para agregar producto
inputCode.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        agregarProducto();
    }
});

async function agregarProducto() {
    const codigo = inputCode.value.trim();
    if (!codigo) return;

    // Sanitización básica del código (solo letras, números y guiones)
    if (!/^[a-zA-Z0-9\-]+$/.test(codigo)) {
        inputCode.style.backgroundColor = '#fee2e2';
        setTimeout(() => { inputCode.style.backgroundColor = ''; }, 800);
        inputCode.value = '';
        return;
    }

    // Buscamos el producto usando .limit(1) para evitar el error 406
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('codigo', codigo)
        .limit(1);

    // Si hay error o el array está vacío, el producto no existe
    if (error || !data || data.length === 0) {
        console.warn('Producto no encontrado:', codigo);
        
        // Efecto visual rojo en el input
        inputCode.style.backgroundColor = '#fee2e2';
        setTimeout(() => { inputCode.style.backgroundColor = ''; }, 800);
        
        inputCode.value = '';
        return;
    }

    // Extraemos el producto del array
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
            precio: producto.precio,
            cantidad: 1
        });
    }

    // Limpiamos el input y actualizamos la vista
    inputCode.value = '';
    renderCarrito();
}

function renderCarrito() {
    cartBody.innerHTML = ''; // Limpiamos de forma segura

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

        // Creamos las celdas y usamos textContent para evitar inyecciones HTML (XSS)
        const tdCodigo = document.createElement('td'); tdCodigo.textContent = item.codigo;
        const tdNombre = document.createElement('td'); tdNombre.textContent = item.nombre;
        const tdPrecio = document.createElement('td'); tdPrecio.textContent = '$' + Number(item.precio).toFixed(2);
        const tdCant = document.createElement('td'); tdCant.textContent = item.cantidad;
        const tdTotal = document.createElement('td'); tdTotal.textContent = '$' + (item.precio * item.cantidad).toFixed(2);

        const tdAccion = document.createElement('td');
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'X';
        btnEliminar.style.color = 'red';
        btnEliminar.style.border = 'none';
        btnEliminar.style.background = 'none';
        btnEliminar.style.cursor = 'pointer';
        btnEliminar.style.fontWeight = 'bold';
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
        alert('El carrito está vacío');
        return;
    }
    // La lógica de guardado en la base de datos la haremos en el siguiente paso
    alert('¡Cobro exitoso! (La lógica de guardado la haremos en el siguiente paso)');
}
// ==================== MÓDULO DE PRODUCTOS ====================

function abrirAdmin() {
    document.querySelector('.pos-container').style.display = 'none';
    document.getElementById('product-management').style.display = 'block';
    cargarProductosAdmin();
}

function cerrarAdmin() {
    document.getElementById('product-management').style.display = 'none';
    document.querySelector('.pos-container').style.display = 'grid';
}

async function cargarProductosAdmin() {
    const tbody = document.getElementById('productTableBody');
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

    tbody.innerHTML = ''; // Limpiamos

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay productos registrados</td></tr>';
        return;
    }

    data.forEach(prod => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';

        // Usamos textContent para evitar XSS
        const tdCodigo = document.createElement('td'); tdCodigo.textContent = prod.codigo; tdCodigo.style.padding = '12px';
        const tdNombre = document.createElement('td'); tdNombre.textContent = prod.nombre; tdNombre.style.padding = '12px';
        const tdPrecio = document.createElement('td'); tdPrecio.textContent = '$' + Number(prod.precio).toFixed(2); tdPrecio.style.padding = '12px';
        const tdStock = document.createElement('td'); tdStock.textContent = prod.stock; tdStock.style.padding = '12px';
        
        const tdAcciones = document.createElement('td'); tdAcciones.style.padding = '12px';
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '🗑️';
        btnEliminar.style.background = '#fee2e2';
        btnEliminar.style.border = 'none';
        btnEliminar.style.cursor = 'pointer';
        btnEliminar.style.padding = '5px 10px';
        btnEliminar.style.borderRadius = '4px';
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

    // Validaciones de seguridad
    if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
        alert('Por favor, rellena todos los campos correctamente.');
        return;
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(codigo)) {
        alert('El código solo puede contener letras, números y guiones.');
        return;
    }

    // Insertar en Supabase
    const { error } = await supabaseClient
        .from('productos')
        .insert([{ codigo, nombre, precio, stock }]);

    if (error) {
        console.error('Error al guardar:', error);
        if (error.code === '23505') { // Código de error para UNIQUE violation
            alert('Ese código de producto ya existe.');
        } else {
            alert('Error al guardar el producto.');
        }
        return;
    }

    // Limpiar formulario y recargar tabla
    document.getElementById('newCodigo').value = '';
    document.getElementById('newNombre').value = '';
    document.getElementById('newPrecio').value = '';
    document.getElementById('newStock').value = '';
    
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
        alert('No se pudo eliminar el producto.');
        return;
    }

    cargarProductosAdmin();
}

function abrirGeneradorEtiquetas() {
    // Abre el index.html del módulo en una pestaña nueva
    window.open('modulos/etiquetas/index.html', '_blank');
}