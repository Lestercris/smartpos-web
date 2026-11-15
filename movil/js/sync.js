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
        locator: {
            patchSize: "medium",
            halfSample: true
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
            resultEl.textContent = 'Error de cámara: ' + err.message;
            resultEl.className = 'show error';
            return;
        }
        Quagga.start();
        running = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        
        // Quagga dibuja su propio canvas. Lo ocultamos con CSS, 
        // pero nos aseguramos de que no tape nuestro marco.
        const quaggaCanvas = container.querySelector('canvas.drawingBuffer');
        if (quaggaCanvas) {
            quaggaCanvas.style.display = 'none';
        }
    });
}