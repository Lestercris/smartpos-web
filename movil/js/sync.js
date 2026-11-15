// ⚠️ PEGA AQUÍ TUS CREDENCIALES DE SUPABASE ⚠️
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('scanner-container');
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

// Iniciar Quagga (Optimizado para velocidad)
function startScanner() {
    if (running) return;
    resultEl.classList.remove('show');

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { 
                facingMode: 'environment', // Cámara trasera
                width: { ideal: 640 },     // Resolución óptima para velocidad
                height: { ideal: 480 }
            },
            // Limitar la búsqueda al área del marco azul
            area: { 
                top: "25%", 
                right: "25%", 
                left: "25%", 
                bottom: "25%" 
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true // Procesa la mitad de la imagen para ir más rápido
        },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 15, // Intentar leer 15 veces por segundo
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
        stopBtn.style.display = 'inline-block';

        // Forzar que el video ocupe todo el contenedor visualmente
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
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    
    // Limpiar el contenedor pero mantener el marco de guía
    container.innerHTML = `
        <div class="scan-frame">
            <div class="corner-bottom"></div>
            <div class="scan-line"></div>
        </div>
        <div id="result"></div>
    `;
}

// Evento cuando Quagga detecta un código
Quagga.onDetected(function(result) {
    if (!running) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;

    const codigo = result.codeResult.code;
    
    // Detener cámara inmediatamente
    stopScanner();
    
    // Enviar a Supabase
    enviarCodigo(codigo);
});