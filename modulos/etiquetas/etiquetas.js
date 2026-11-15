// Este módulo es independiente. Solo usa 'supabaseClient' que ya existe en la PC.
const moduloEtiquetas = {
    init: function() {
        // Cargar el HTML del módulo en el contenedor principal
        const contenedor = document.getElementById('contenedor-modulos');
        if (!contenedor) {
            console.error('No se encontró el contenedor de módulos');
            return;
        }

        fetch('modulos/etiquetas/etiquetas.html')
            .then(res => {
                if (!res.ok) throw new Error('Error al cargar el HTML del módulo');
                return res.text();
            })
            .then(html => {
                contenedor.innerHTML = html;
                this.bindEvents();
            })
            .catch(err => {
                console.error('Error cargando el módulo:', err);
                contenedor.innerHTML = '<p style="color:red; text-align:center;">Error al cargar el módulo de etiquetas.</p>';
            });
    },
    
    bindEvents: function() {
        // Verificamos que los botones existan antes de asignar eventos
        const btnCerrar = document.getElementById('btnCerrarEtiquetas');
        const btnImprimir = document.getElementById('btnImprimirEtiquetas');

        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                document.getElementById('modulo-etiquetas').style.display = 'none';
                document.querySelector('.pos-container').style.display = 'grid';
            });
        }

        if (btnImprimir) {
            btnImprimir.addEventListener('click', () => {
                window.print();
            });
        }
    },

    abrir: async function() {
        // Ocultamos el POS y mostramos el módulo
        document.querySelector('.pos-container').style.display = 'none';
        
        // Nos aseguramos de que el módulo se haya cargado antes de mostrarlo
        const modulo = document.getElementById('modulo-etiquetas');
        if (!modulo) {
            alert('El módulo no se ha cargado correctamente. Recarga la página.');
            return;
        }
        modulo.style.display = 'block';
        
        const container = document.getElementById('etiquetas-container');
        if (!container) return;

        container.innerHTML = '<p style="text-align:center; width:100%;">Cargando productos...</p>';

        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        
        if (error || !data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center; width:100%;">No hay productos para etiquetar.</p>';
            return;
        }

        container.innerHTML = '';

        data.forEach((prod, index) => {
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
            svg.setAttribute("style", "width: 100%; height: 50px;");

            const pCodigo = document.createElement('p');
            pCodigo.className = 'codigo-texto';
            pCodigo.textContent = prod.codigo;

            div.appendChild(pNombre);
            div.appendChild(pPrecio);
            div.appendChild(svg);
            div.appendChild(pCodigo);
            container.appendChild(div);

            try {
                JsBarcode(svg, prod.codigo, { format: "CODE128", width: 2, height: 40, displayValue: false });
            } catch (err) {
                console.error("Error generando código de barras:", err);
            }
        });
    }
};