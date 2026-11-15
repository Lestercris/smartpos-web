// Al cargar esta página, ejecutamos todo
document.addEventListener('DOMContentLoaded', async () => {
    // Necesitamos la conexión a Supabase. Al ser una ventana nueva, necesitamos crearla aquí.
    // (Asegúrate de que estas credenciales coincidan con las de tu db.js)
    const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const container = document.getElementById('etiquetas-container');
    container.innerHTML = '<p>Cargando productos...</p>';

    // 1. Cargar productos de Supabase
    const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
    
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p>No hay productos para etiquetar.</p>';
        return;
    }

    container.innerHTML = '';

    // 2. Generar la vista de cada producto
    data.forEach((prod, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'etiqueta-wrapper';

        const cantWrapper = document.createElement('div');
        cantWrapper.className = 'cantidad-wrapper';
        
        const label = document.createElement('label');
        label.textContent = 'Cantidad:';
        
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.value = 1;
        inputCant.min = 1;

        cantWrapper.appendChild(label);
        cantWrapper.appendChild(inputCant);

        const div = document.createElement('div');
        div.className = 'etiqueta';

        const pNombre = document.createElement('p');
        pNombre.className = 'nombre';
        pNombre.textContent = prod.nombre;

        const pPrecio = document.createElement('p');
        pPrecio.className = 'precio';
        pPrecio.textContent = '$' + Number(prod.precio).toFixed(2);

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "barcode-" + index);
        
        const pCodigo = document.createElement('p');
        pCodigo.className = 'codigo-texto';
        pCodigo.textContent = prod.codigo;

        div.appendChild(pNombre);
        div.appendChild(pPrecio);
        div.appendChild(svg);
        div.appendChild(pCodigo);
        
        wrapper.appendChild(cantWrapper);
        wrapper.appendChild(div);
        container.appendChild(wrapper);

        try {
            JsBarcode(svg, prod.codigo, { format: "CODE128", width: 2, height: 40, displayValue: false });
        } catch (err) {
            console.error("Error generando código de barras:", err);
        }
    });

    // 3. Lógica de Impresión
    document.getElementById('btnImprimirEtiquetas').addEventListener('click', () => {
        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';

        const wrappers = document.querySelectorAll('.etiqueta-wrapper');
        
        wrappers.forEach(wrapper => {
            const input = wrapper.querySelector('input[type="number"]');
            const etiquetaOriginal = wrapper.querySelector('.etiqueta');
            
            if (!input || !etiquetaOriginal) return;
            
            const cantidad = parseInt(input.value) || 1;

            for (let i = 0; i < cantidad; i++) {
                printContainer.appendChild(etiquetaOriginal.cloneNode(true));
            }
        });

        document.body.appendChild(printContainer);
        window.print();

        setTimeout(() => {
            document.body.removeChild(printContainer);
        }, 1000);
    });

    // 4. Botón Cerrar Ventana
    document.getElementById('btnCerrarEtiquetas').addEventListener('click', () => {
        window.close(); // Cierra esta pestaña
    });
});
@media print {
    .cantidad-wrapper {
        display: none !important;
    }
}