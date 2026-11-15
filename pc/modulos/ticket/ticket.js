const moduloTicket = {
    init: function() {
        // Insertamos el HTML del ticket en el body
        const contenedor = document.createElement('div');
        contenedor.id = 'contenedor-ticket';
        
        fetch('modulos/ticket/ticket.html')
            .then(res => res.text())
            .then(html => {
                contenedor.innerHTML = html;
                document.body.appendChild(contenedor);
                this.bindEvents();
            });
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
        // venta = { id, total, usuario, items: [{nombre, cantidad, precio, total}], subtotal, iva }
        
        document.getElementById('tk-id').textContent = String(venta.id).padStart(6, '0');
        
        const fecha = new Date();
        document.getElementById('tk-fecha').textContent = fecha.toLocaleString();
        document.getElementById('tk-vendedor').textContent = venta.usuario;

        // Llenar los productos
        const tbody = document.getElementById('tk-productos');
        tbody.innerHTML = '';
        
        venta.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.cantidad}</td>
                <td>${item.nombre}</td>
                <td style="text-align: right;">$${item.total.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Llenar totales
        document.getElementById('tk-subtotal').textContent = '$' + venta.subtotal.toFixed(2);
        document.getElementById('tk-iva').textContent = '$' + venta.iva.toFixed(2);
        document.getElementById('tk-total').textContent = '$' + venta.total.toFixed(2);

        // Mostrar el modal
        document.getElementById('ticket-modal').classList.add('active');
    }
};

// Inicializar el módulo cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    moduloTicket.init();
});