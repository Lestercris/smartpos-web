// ⚠️ TUS CREDENCIALES DE SUPABASE (las mismas de la PC)
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar Supabase
    if (typeof supabase === 'undefined') {
        alert("Error crítico: La librería de Supabase no se cargó.");
        return;
    }
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const container = document.getElementById('etiquetas-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; width:100%;">Cargando productos...</p>';

    try {
        // 2. Cargar productos
        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center; width:100%;">No hay productos para etiquetar.</p>';
            return;
        }

        container.innerHTML = '';

        // 3. Generar la vista
        data.forEach((prod, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'etiqueta-wrapper';

            // Selector de cantidad
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

            // Etiqueta
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

            // Generar código de barras
            try {
                JsBarcode(svg, prod.codigo, { format: "CODE128", width: 2, height: 40, displayValue: false });
            } catch (err) {
                console.error("Error generando código de barras:", err);
            }
        });
    } catch (err) {
        console.error("Error cargando productos:", err);
        container.innerHTML = '<p style="text-align:center; width:100%; color:red;">Error al cargar los productos.</p>';
    }

    // 4. Configurar Botón Imprimir
    const btnImprimir = document.getElementById('btnImprimirEtiquetas');
    if (btnImprimir) {
        btnImprimir.addEventListener('click', () => {
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
                if (document.body.contains(printContainer)) {
                    document.body.removeChild(printContainer);
                }
            }, 1000);
        });
    }

    // 5. Configurar Botón Cerrar
    const btnCerrar = document.getElementById('btnCerrarEtiquetas');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            window.close(); // Intenta cerrar la pestaña
        });
    }
});