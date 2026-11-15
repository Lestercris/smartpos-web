function startScanner() {
    if (running) return;
    resultEl.classList.remove('show');

    Quagga.init({
        inputStream: {
            type: 'LiveStream',
            target: container,
            constraints: { 
                facingMode: 'environment', // Cámara trasera
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