// ⚠️ PEGA AQUÍ TUS CREDENCIALES DE SUPABASE ⚠️
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('interactive'); // Apunta al div interno
let running = false;

// Función para enviar el código a Supabase
async function enviarCodigo(codigo) {
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
        
        setTimeout(() => {
            resultEl.classList.remove('show');
            startScanner();
        }, 2000);

    } catch (error) {
        console.error(error);
        resultEl.textContent = '❌ Error al enviar';
        resultEl.className = 'show error';
        
        setTimeout(() => {
            resultEl.classList.remove('show');
            startScanner();
        }, 3000);
    }
}

// Iniciar Quagga (Optimizado para precisión)
function startScanner() {
    if (running) return;
    resultEl.classList.remove('show');

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { 
                facingMode: 'environment', // Cámara trasera
                width: { ideal: 1024 },    // Resolución intermedia (más nítida que 640)
                height: { ideal: 768 }
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true // Procesa rápido sin perder demasiada calidad
        },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 15, // 15 lecturas por segundo
        decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader']
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

        // Asegurar que el video se expanda correctamente
        setTimeout(() => {
            const videoElement = container.querySelector('video');
            if (videoElement) {
                videoElement.style.position = 'absolute';
                videoElement.style.top = '0';
                videoElement.style.left = '0';
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = 'cover';
            }
        }, 100);
    });
}

// Detener Quagga
function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    container.innerHTML = ''; // Limpiar el video
}

// Evento cuando Quagga detecta un código (CON FILTRO ANTI-FALSOS POSITIVOS)
Quagga.onDetected(function(result) {
    if (!running) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;

    // 1. FILTRO DE CALIDAD (Evita que se invente los números)
    if (result.codeResult.decodedCodes) {
        const errores = result.codeResult.decodedCodes
            .filter(x => x.error !== undefined)
            .map(x => x.error);
        
        if (errores.length > 0) {
            const errorPromedio = errores.reduce((a, b) => a + b, 0) / errores.length;
            
            // Si el error es mayor al 15%, es una lectura borrosa o falsa.
            if (errorPromedio > 0.15) {
                console.log("❌ Lectura borrosa descartada:", result.codeResult.code);
                return; 
            }
        }
    }

    // 2. FILTRO DE LONGITUD (Opcional: EAN-13 tiene 13 dígitos, UPC tiene 12)
    if (result.codeResult.code.length < 8 || result.codeResult.code.length > 14) {
        return; 
    }

    const codigo = result.codeResult.code;
    console.log("✅ Código válido detectado:", codigo);
    
    // Detener cámara y enviar
    stopScanner();
    enviarCodigo(codigo);
});