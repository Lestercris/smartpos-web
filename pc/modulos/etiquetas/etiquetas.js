// ⚠️ TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

// Aviso flotante con el estilo de la app (sustituye a alert)
function avisar(mensaje, tipo) {
    let toast = document.getElementById('toast-etiquetas');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'toast-etiquetas';
    toast.className = 'toast-etiquetas ' + (tipo === 'error' ? 'error' : 'ok');
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, tipo === 'error' ? 5000 : 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('etiquetas-container');

    if (typeof supabase === 'undefined') {
        avisar('No se pudo cargar la librería de datos. Revisa la conexión.', 'error');
        if (container) container.innerHTML = '<p style="text-align:center; width:100%; color:#dc2626;">No se pudo cargar la librería de datos.</p>';
        return;
    }
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (!container) return;

    container.innerHTML = '<p style="text-align:center; width:100%;">Cargando productos...</p>';

    try {
        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center; width:100%;">No hay productos para etiquetar.</p>';
            return;
        }

        container.innerHTML = '';

        data.forEach((prod, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'etiqueta-wrapper';

            // 1. Checkbox para mostrar/ocultar en impresión
            const chkWrapper = document.createElement('div');
            chkWrapper.className = 'checkbox-wrapper';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.id = 'chk-print-' + index;
            chk.checked = true; // Marcado por defecto
            chk.addEventListener('change', (e) => {
                // Si se desmarca, añade la clase 'desactivada' al contenedor
                if (e.target.checked) {
                    wrapper.classList.remove('desactivada');
                } else {
                    wrapper.classList.add('desactivada');
                }
            });

            const lblChk = document.createElement('label');
            lblChk.htmlFor = 'chk-print-' + index;
            lblChk.textContent = 'Imprimir';

            chkWrapper.appendChild(chk);
            chkWrapper.appendChild(lblChk);

            // 2. Selector de cantidad
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

            // 3. Etiqueta visual
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
            
            // Ensamblar
            wrapper.appendChild(chkWrapper);
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
                // Verificamos si el checkbox de esta etiqueta está marcado
                const chk = wrapper.querySelector('input[type="checkbox"]');
                if (chk && !chk.checked) {
                    return; // Si no está marcado, lo saltamos (no se imprime)
                }

                const input = wrapper.querySelector('input[type="number"]');
                const etiquetaOriginal = wrapper.querySelector('.etiqueta');
                
                if (!input || !etiquetaOriginal) return;
                
                const cantidad = parseInt(input.value) || 1;

                for (let i = 0; i < cantidad; i++) {
                    printContainer.appendChild(etiquetaOriginal.cloneNode(true));
                }
            });

            if (printContainer.children.length === 0) {
                avisar('No has seleccionado ninguna etiqueta para imprimir.', 'error');
                return;
            }

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
            window.close();
        });
    }
});