// ⚠️ PEGA AQUÍ TUS CREDENCIALES DE SUPABASE ⚠️
const SUPABASE_URL = 'https://aqkwuossogrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

// Inicializar Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('scanner-container');
let running = false;

// Función para enviar el código a Supabase
async function enviarCodigo(codigo) {
    try {
        const { error } = await supabaseClient
            .from('escaneos')
            .insert({ codigo: codigo });

        if (error) throw error;
        
        resultEl.textContent = '✅ Enviado: ' + codigo;
        resultEl.className = 'success';
        if (navigator.vibrate) navigator.vibrate(200);
        
        // Volver a activar la cámara después de 2 segundos
        setTimeout(() => {
            startScanner();
        }, 2000);

    } catch (error) {
        console.error(error);
        resultEl.textContent = '❌ Error al enviar: ' + error.message;
        resultEl.className = 'error';
    }
}

// Iniciar Quagga
function startScanner() {
    if (running) return;
    resultEl.textContent = 'Activando cámara...';
    resultEl.className = '';

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { facingMode: 'environment' }
        },
        decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader']
        }
    }, function(err) {
        if (err) {
            console.error(err);
            resultEl.textContent = 'Error de cámara: ' + err.message;
            return;
        }
        Quagga.start();
        running = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        resultEl.textContent = 'Apunta al código de barras...';
    });
}

// Detener Quagga
function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    container.innerHTML = '';
}

// Evento cuando Quagga detecta un código
Quagga.onDetected(function(result) {
    if (!running) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;

    const codigo = result.codeResult.code;
    
    // Detener cámara inmediatamente para no escanear múltiples veces
    stopScanner();
    
    // Enviar a Supabase
    enviarCodigo(codigo);
});