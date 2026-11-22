// ⚠️ TUS CREDENCIALES
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('interactive');
let running = false;

// BANDERA DE CONTROL: Evita que lea el mismo código 20 veces mientras lo envía
let isProcessing = false; 

// Enviar código a Supabase
async function enviarCodigo(codigo) {
    isProcessing = true; // Bloqueamos la lectura
    
    try {
        resultEl.textContent = '⏳ Enviando...';
        resultEl.className = 'show';
        
        const { error } = await supabaseClient
            .from('escaneos')
            .insert({ codigo: codigo });

        if (error) throw error;
        
        resultEl.textContent = '✅ ' + codigo;
        resultEl.className = 'show success';
        if (navigator.vibrate) navigator.vibrate(200);
        
        // Solo esperamos 1.5 segundos para que el usuario vea el mensaje
        setTimeout(() => {
            resultEl.classList.remove('show');
            isProcessing = false; // Desbloqueamos la lectura
        }, 1500);

    } catch (error) {
        console.error(error);
        resultEl.textContent = '❌ Error al enviar';
        resultEl.className = 'show error';
        
        setTimeout(() => {
            resultEl.classList.remove('show');
            isProcessing = false; // Desbloqueamos la lectura
        }, 2000);
    }
}

// Iniciar Quagga
function startScanner() {
    if (running) return;
    resultEl.classList.remove('show');

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { 
                facingMode: 'environment', 
                width: { ideal: 1024 }, // Subimos a 1024 para que el Code 128 se vea más nítido
                height: { ideal: 768 }
            }
        },
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 20,
        decoder: { 
            // PRIORIDAD: Ponemos code_128_reader primero para que lo intente leer antes que nada
            readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader'] 
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error(err);
            resultEl.textContent = 'Error de cámara: ' + err.message;
            resultEl.className = 'show error';
            return;
        }
        
        Quagga.start();
        running = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
    });
}

// Detener Quagga (Solo cuando el usuario pulsa el botón rojo)
function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    isProcessing = false;
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    container.innerHTML = ''; 
}

// Evento cuando Quagga detecta un código
Quagga.onDetected(function(result) {
    // Si no está corriendo, o si ya estamos procesando un código, ignoramos
    if (!running || isProcessing) return; 
    if (!result || !result.codeResult || !result.codeResult.code) return;

    // Filtro de calidad
    if (result.codeResult.decodedCodes) {
        const errores = result.codeResult.decodedCodes
            .filter(x => x.error !== undefined)
            .map(x => x.error);
        
        if (errores.length > 0) {
            const errorPromedio = errores.reduce((a, b) => a + b, 0) / errores.length;
            if (errorPromedio > 0.15) return; 
        }
    }

    const codigo = result.codeResult.code;
    // ¡Ya NO apagamos la cámara aquí! Solo enviamos a Supabase y bloqueamos el escáner.
    enviarCodigo(codigo);
});