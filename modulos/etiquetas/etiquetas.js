// Este módulo es independiente. Solo usa 'supabaseClient' que ya existe en la PC.
const moduloEtiquetas = {
    init: function() {
        // Cargar el HTML del módulo en el contenedor principal
        const contenedor = document.getElementById('contenedor-modulos');
        if (!contenedor) return;

        fetch('modulos/etiquetas/etiquetas.html')
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = html;
                this.bindEvents();
            });
    },
    
    bindEvents: function() {
        document.getElementById('btnCerrarEtiquetas').addEventListener('click', () => {
            document.getElementById('modulo-etiquetas').style.display = 'none';
            document.querySelector('.pos-container').style.display = 'grid';
        });

        document.getElementById('btnImprimirEtiquetas').addEventListener('click', () => {
            window.print();
        });
    },

    abrir: async function() {
        document.querySelector('.pos-container').style.display = 'none';
        document.getElementById('modulo-etiquetas').style.display = 'block';
        
        const container = document.getElementById('etiquetas-container');
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