const moduloTicket = {
    init: function() {
        // Insertamos el HTML del ticket en el body
        const contenedor = document.createElement('div');
        contenedor.id = 'contenedor-ticket';
        
        fetch('modulos/ticket/ticket.html', { cache: 'no-store' })
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = html;
                document.body.appendChild(contenedor);
                this.bindEvents();
            })
            .catch(err => console.error("Error cargando el módulo de ticket:", err));
    },

    bindEvents: function() {
        const btnCerrar = document.getElementById('btnCerrarTicket');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                document.getElementById('ticket-modal').classList.remove('active');
            });
        }

        const btnImprimir = document.getElementById('btnImprimirTicket');
        if (btnImprimir) {
            btnImprimir.addEventListener('click', () => {
                window.print();
            });
        }
    },

    mostrar: function(venta) {
        // Datos del negocio en la cabecera
        const negocio = window.SMARTPOS_NEGOCIO || {};
        const ponerTexto = (id, texto) => {
            const el = document.getElementById(id);
            if (el) el.textContent = texto || '';
            return el;
        };

        ponerTexto('tk-negocio', negocio.nombre || 'SmartPOS');

        const logo = document.getElementById('tk-logo');
        if (logo) {
            if (negocio.logo) {
                logo.src = negocio.logo;
                logo.style.display = 'block';
            } else {
                logo.removeAttribute('src');
                logo.style.display = 'none';
            }
        }

        [
            ['tk-negocio-doc', negocio.documento],
            ['tk-negocio-dir', negocio.direccion],
            ['tk-negocio-tel', negocio.telefono]
        ].forEach(([id, valor]) => {
            const el = ponerTexto(id, valor);
            if (el) el.style.display = valor ? 'block' : 'none';
        });

        const aviso = document.getElementById('tk-aviso');
        if (aviso) {
            aviso.textContent = venta.aviso || '';
            aviso.style.display = venta.aviso ? 'block' : 'none';
        }

        // 1. Llenar los datos básicos
        document.getElementById('tk-id').textContent = String(venta.id).padStart(6, '0');
        
        const fecha = venta.fecha ? new Date(venta.fecha) : new Date();
        document.getElementById('tk-fecha').textContent = fecha.toLocaleString();
        document.getElementById('tk-vendedor').textContent = venta.usuario || '-';

        const filaCliente = document.getElementById('tk-cliente-row');
        if (filaCliente) {
            if (venta.cliente) {
                document.getElementById('tk-cliente').textContent = venta.cliente;
                filaCliente.style.display = 'block';
            } else {
                filaCliente.style.display = 'none';
            }
        }

        // 2. Llenar la tabla de productos
        const tbody = document.getElementById('tk-productos');
        tbody.innerHTML = '';
        
        venta.items.forEach(item => {
            const tr = document.createElement('tr');
            // Usamos textContent implícito en innerHTML pero controlado
            tr.innerHTML = `
                <td>${item.cantidad}</td>
                <td>${item.nombre}</td>
                <td style="text-align: right;">$${item.total.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

        // 3. Llenar los totales
        document.getElementById('tk-subtotal').textContent = '$' + venta.subtotal.toFixed(2);
        document.getElementById('tk-iva').textContent = '$' + venta.iva.toFixed(2);
        document.getElementById('tk-total').textContent = '$' + venta.total.toFixed(2);

        const descuento = Number(venta.descuento || 0);
        const filaDescuento = document.getElementById('tk-descuento-row');
        if (filaDescuento) {
            if (descuento > 0) {
                document.getElementById('tk-descuento').textContent = '-$' + descuento.toFixed(2);
                filaDescuento.style.display = 'flex';
            } else {
                filaDescuento.style.display = 'none';
            }
        }

        // 3b. Forma de pago y vuelto (si la venta los tiene)
        const filaPago = document.getElementById('tk-pago-row');
        const filaRecibido = document.getElementById('tk-recibido-row');
        const filaVuelto = document.getElementById('tk-vuelto-row');

        if (filaPago && venta.metodo_pago) {
            const nombres = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
            document.getElementById('tk-pago').textContent = nombres[venta.metodo_pago] || venta.metodo_pago;
            filaPago.style.display = 'flex';

            const esEfectivo = venta.metodo_pago === 'EFECTIVO' && venta.monto_recibido != null;
            filaRecibido.style.display = esEfectivo ? 'flex' : 'none';
            filaVuelto.style.display = esEfectivo ? 'flex' : 'none';

            if (esEfectivo) {
                document.getElementById('tk-recibido').textContent = '$' + Number(venta.monto_recibido).toFixed(2);
                document.getElementById('tk-vuelto').textContent = '$' + Number(venta.vuelto || 0).toFixed(2);
            }
        } else if (filaPago) {
            filaPago.style.display = 'none';
            filaRecibido.style.display = 'none';
            filaVuelto.style.display = 'none';
        }

        // 4. GENERAR EL CÓDIGO DE BARRAS DEL TICKET
        try {
            const codigoTicket = 'T-' + String(venta.id).padStart(6, '0');
            
            // JsBarcode dibuja el código en el SVG con id "tk-barcode"
            JsBarcode("#tk-barcode", codigoTicket, {
                format: "CODE128",
                lineColor: "#000",
                width: 3,
                height: 50,
                displayValue: false // Ocultamos el texto por defecto para usar el nuestro
            });
            
            document.getElementById('tk-barcode-text').textContent = codigoTicket;
            
        } catch (err) {
            console.error("Error generando código de barras:", err);
        }

        // 5. Mostrar la ventana modal
        document.getElementById('ticket-modal').classList.add('active');
    }
};

// Inicializar el módulo cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    moduloTicket.init();
});