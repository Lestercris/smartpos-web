// Conexión en tiempo real para escuchar el escáner
const channel = supabaseClient
    .channel('escaneos-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escaneos' }, payload => {
        const codigo = payload.new.codigo;
        console.log("📩 Código escaneado recibido:", codigo);
        
        // Verificamos si estamos en la pestaña de Comprobantes
        const tabComprobantes = document.getElementById('tab-comprobantes');
        const enComprobantes = tabComprobantes && tabComprobantes.classList.contains('active');

        // Si el código empieza con "T-" o estamos en la pestaña de comprobantes, lo mandamos ahí
        if (enComprobantes || codigo.toUpperCase().startsWith('T-')) {
            const inputTicket = document.getElementById('searchTicket');
            if (inputTicket) {
                // Si el usuario está en la vista POS, lo cambiamos a la vista de administración
                if (!enComprobantes) {
                    document.getElementById('pos-view').classList.add('hidden');
                    document.getElementById('admin-view').classList.remove('hidden');
                    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    document.getElementById('tab-comprobantes').classList.add('active');
                    document.querySelector('.tab-btn[data-tab="tab-comprobantes"]').classList.add('active');
                }
                
                inputTicket.value = codigo;
                inputTicket.style.backgroundColor = '#dcfce7';
                setTimeout(() => { inputTicket.style.backgroundColor = ''; }, 800);
                
                // Disparamos la búsqueda automáticamente si la función existe
                if (typeof buscarComprobante === 'function') {
                    buscarComprobante();
                }
            }
        } else {
            // Si es un código normal, va al carrito de ventas
            const inputProd = document.getElementById('posCode');
            if (inputProd) {
                inputProd.value = codigo;
                inputProd.style.backgroundColor = '#dcfce7';
                setTimeout(() => { inputProd.style.backgroundColor = ''; }, 800);
                
                if (typeof agregarProducto === 'function') {
                    agregarProducto();
                }
            }
        }
    })
    .subscribe((status) => {
        const statusEl = document.getElementById('connection-status');
        if (status === 'SUBSCRIBED') {
            statusEl.textContent = '🟢 En línea';
            statusEl.className = 'status connected';
            console.log("✅ Conectado a Supabase Realtime");
        } else {
            statusEl.textContent = '🔴 Desconectado';
            statusEl.className = 'status disconnected';
        }
    });