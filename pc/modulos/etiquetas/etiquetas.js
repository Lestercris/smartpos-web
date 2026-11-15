abrir: async function() {
    // Ocultamos el POS y mostramos el módulo
    document.querySelector('.pos-container').style.display = 'none';
    
    const modulo = document.getElementById('modulo-etiquetas');
    if (!modulo) {
        alert('El módulo no se ha cargado correctamente.');
        return;
    }
    modulo.style.display = 'block';
    
    const container = document.getElementById('etiquetas-container');
    container.innerHTML = '<p style="text-align:center; width:100%;">Cargando productos...</p>';

    const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
    
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%;">No hay productos para etiquetar.</p>';
        return;
    }

    container.innerHTML = '';

    data.forEach((prod, index) => {
        // Creamos un contenedor para el producto (etiqueta + input de cantidad)
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '10px';

        // Etiqueta
        const div = document.createElement('div');
        div.className = 'etiqueta';
        // ... (aquí va el código de la etiqueta que ya tenías: nombre, precio, svg, codigo) ...

        // Input de cantidad
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.value = 1;
        inputCant.min = 1;
        inputCant.style.width = '60px';
        inputCant.style.padding = '5px';
        inputCant.style.textAlign = 'center';
        inputCant.setAttribute('data-index', index);

        wrapper.appendChild(div);
        wrapper.appendChild(inputCant);
        container.appendChild(wrapper);

        // Generar código de barras...
    });
}