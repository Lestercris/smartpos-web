const moduloEtiquetas = {
    init: function() {
        const contenedor = document.getElementById('contenedor-modulos');
        if (!contenedor) return;

        fetch('modulos/etiquetas/etiquetas.html')
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = html;
                this.bindEvents();
            })
            .catch(err => console.error('Error cargando el módulo:', err));
    },
    
    bindEvents: function() {
        const btnCerrar = document.getElementById('btnCerrarEtiquetas');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                document.getElementById('modulo-etiquetas').style.display = 'none';
                document.getElementById('product-management').style.display = 'block';
            });
        }

        const btnImprimir = document.getElementById('btnImprimirEtiquetas');
        if (btnImprimir) {
            btnImprimir.addEventListener('click', () => {
                this.imprimirEtiquetas();
            });
        }
    },

    abrir: async function() {
        // Ocultar gestión de productos y mostrar etiquetas
        document.getElementById('product-management').style.display = 'none';
        document.getElementById('modulo-etiquetas').style.display = 'block';
        
        const container = document.getElementById('etiquetas-container');
        container.innerHTML = '<p>Cargando productos...</p>';

        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        
        if (error || !data || data.length === 0) {
            container.innerHTML = '<p>No hay productos para etiquetar.</p>';
            return;
        }

        container.innerHTML = '';

        data.forEach((prod, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'etiqueta-wrapper';

            // Control de cantidad
            const cantWrapper = document.createElement('div');
            cantWrapper.className = 'cantidad-wrapper';
            
            const label = document.createElement('label');
            label.textContent = 'Cantidad:';
            
            const inputCant = document.createElement('input');
            inputCant.type = 'number';
            inputCant.value = 1;
            inputCant.min = 1;
            inputCant.setAttribute('data-id', prod.id);

            cantWrapper.appendChild(label);
            cantWrapper.appendChild(inputCant);

            // Etiqueta visual
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
    },

    imprimirEtiquetas: function() {
        // 1. Crear el contenedor de impresión
        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';

        // 2. Leer todos los productos y sus cantidades
        const wrappers = document.querySelectorAll('.etiqueta-wrapper');
        
        wrappers.forEach(wrapper => {
            const input = wrapper.querySelector('input[type="number"]');
            const etiquetaOriginal = wrapper.querySelector('.etiqueta');
            
            if (!input || !etiquetaOriginal) return;
            
            const cantidad = parseInt(input.value) || 1;

            // 3. Clonar la etiqueta las veces necesarias
            for (let i = 0; i < cantidad; i++) {
                const clone = etiquetaOriginal.cloneNode(true);
                // Los SVG generados por JsBarcode se clonan con su path interno, así que se ven perfectos
                printContainer.appendChild(clone);
            }
        });

        // 4. Añadir al body (oculto visualmente, pero visible para la impresora)
        document.body.appendChild(printContainer);

        // 5. Lanzar la impresión
        window.print();

        // 6. Limpiar después de imprimir
        setTimeout(() => {
            document.body.removeChild(printContainer);
        }, 1000);
    }
};