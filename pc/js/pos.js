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