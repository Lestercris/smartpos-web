// ⚠️ TUS CREDENCIALES
const SUPABASE_URL = 'https://aqkwuwsogrrllatyhrfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GnsebOkP_46qA05Q-r20cA_mKQjuFwX';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('interactive'); // Apunta al div interno
let running = false;

async function enviarCodigo(codigo) {
    try {
        resultEl.textContent = '⏳ Enviando...';
        resultEl.className = 'show';
        
        const { error } = await supabaseClient.from('escaneos').insert({ codigo: codigo });
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

function startScanner() {
    if (running) return;
    resultEl.classList.remove('show');

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        },
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 10,
        decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader'] },
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

        setTimeout(() => {
            const videoElement = container.querySelector('video');
            if (videoElement) {
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = 'cover';
            }
        }, 100);
    });
}

function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    container.innerHTML = ''; 
}

Quagga.onDetected(function(result) {
    if (!running) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;

    const codigo = result.codeResult.code;
    stopScanner();
    enviarCodigo(codigo);
});