const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('scanner-container');
let running = false;

// Función simple para iniciar
function startScanner() {
    if (running) return;
    startBtn.textContent = 'Encendiendo...';
    
    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { facingMode: 'environment' }
        },
        decoder: {
            readers: ['ean_reader']
        }
    }, function(err) {
        if (err) {
            alert("Error: " + err.message);
            startBtn.textContent = '▶ Iniciar Escáner';
            return;
        }
        Quagga.start();
        running = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
    });
}

// Función simple para detener
function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    container.innerHTML = '<div class="scan-frame"><div class="corner-bottom"></div><div class="scan-line"></div></div><div id="result"></div>';
}