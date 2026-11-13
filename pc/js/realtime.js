// Conexión en tiempo real para escuchar el escáner
const channel = supabaseClient
    .channel('escaneos-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escaneos' }, payload => {
        const codigo = payload.new.codigo;
        console.log("📩 Código escaneado recibido:", codigo);
        
        // Inyectar en el input y agregar al carrito automáticamente
        const input = document.getElementById('posCode');
        input.value = codigo;
        
        // Efecto visual verde
        input.style.backgroundColor = '#dcfce7';
        setTimeout(() => { input.style.backgroundColor = ''; }, 800);
        
        // Simular el Enter
        agregarProducto();
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