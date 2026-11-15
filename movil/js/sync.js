const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const container = document.getElementById('scanner-container');
const interactive = document.getElementById('interactive'); // El nuevo div
let running = false;

function startScanner() {
    if (running) return;
    startBtn.textContent = 'Encendiendo...';

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: interactive, // Apuntamos al div interno
            constraints: { 
                facingMode: 'environment',
                width: { ideal: 1280 }, // Resolución alta para leer
                height: { ideal: 720 }
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: false // false para mejor precisión en la lectura
        },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 10,
        decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader']
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error(err);
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

function stopScanner() {
    if (!running) return;
    Quagga.stop();
    running = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    // No borramos el HTML del marco, solo limpiamos el video
    interactive.innerHTML = ''; 
}