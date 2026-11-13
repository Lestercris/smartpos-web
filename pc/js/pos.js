const inputCode = document.getElementById('posCode');
const cartBody = document.getElementById('cartBody');

// Presionar Enter en el input para agregar
inputCode.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        agregarProducto();
    }
});

async function agregarProducto() {
    const codigo = inputCode.value.trim();
    if (!codigo) return;

    // Buscar producto en la base de datos
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error || !data) {
        alert('Producto no encontrado');
        inputCode.value = '';
        return;
    }

    // Agregar al carrito local
    const existe = carrito.find(item => item.id === data.id);
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            id: data.id,
            codigo: data.codigo,
            nombre: data.nombre,
            precio: data.precio,
            cantidad: 1
        });
    }

    inputCode.value = '';
    renderCarrito();
}

function renderCarrito() {
    if (carrito.length === 0) {
        cartBody.innerHTML = '<tr><td colspan="6" class="empty">Carrito vacío</td></tr>';
        actualizarTotales(0);
        return;
    }

    cartBody.innerHTML = carrito.map((item, index) => `
        <tr>
            <td>${item.codigo}</td>
            <td>${item.nombre}</td>
            <td>$${item.precio.toFixed(2)}</td>
            <td>${item.cantidad}</td>
            <td>$${(item.precio * item.cantidad).toFixed(2)}</td>
            <td><button onclick="eliminarItem(${index})" style="color:red; border:none; background:none; cursor:pointer;">X</button></td>
        </tr>
    `).join('');

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
    alert('¡Cobro exitoso! (La lógica de guardado la haremos en el siguiente paso)');
}