if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        const state = window.downloaderState;
        if (state.isHostPaused) {
            status.innerText = '⚠️ Transfer is paused by the sender. Please wait.';
            setStatusDot('yellow');
            return;
        }
        status.innerText = 'Downloading...';
        setStatusDot('green');
        if (streamAnimation) streamAnimation.style.display = 'flex';
        downloadBtn.style.display = 'none';
        downloadControls.style.display = 'flex';
        progressBar.style.display = 'block';
        state.isDownloading = true;
        state.startHeartbeat();
        state.conn.send({ type: 'START_DOWNLOAD', offset: state.receivedSize });
    });
}

if (pausePlayBtn) {
    pausePlayBtn.addEventListener('click', () => {
        const state = window.downloaderState;
        state.isPaused = !state.isPaused;
        if (state.isPaused) {
            pausePlayBtn.innerText = 'Resume Download';
            pausePlayBtn.classList.add('paused');
            status.innerText = 'Download paused.';
            setStatusDot('yellow');
            if (streamAnimation) streamAnimation.style.display = 'none';
            state.conn.send({ type: 'PAUSE_TRANSFER' });
            state.stopHeartbeat();
        } else {
            pausePlayBtn.innerText = 'Pause Download';
            pausePlayBtn.classList.remove('paused');
            status.innerText = 'Downloading...';
            setStatusDot('green');
            if (streamAnimation) streamAnimation.style.display = 'flex';
            state.startHeartbeat();
            state.conn.send({ type: 'START_DOWNLOAD', offset: state.receivedSize });
        }
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
        const state = window.downloaderState;
        if (state.conn && state.conn.open) {
            state.conn.send({ type: 'CANCEL_TRANSFER' });
        }
        state.isDownloading = false;
        state.isPaused = false;
        state.stopHeartbeat();
        if (state.fileMetadata) {
            status.innerText = 'Download cancelled. Ready to download.';
            setStatusDot('red');
        } else {
            status.innerText = '⚠️ No file is currently hosted by the sender.';
            setStatusDot('red');
        }
        if (streamAnimation) streamAnimation.style.display = 'none';
        
        try {
            await state.clearStoredChunks(state.slug);
        } catch (e) {}
        
        state.receivedSize = 0;
        progressBar.value = 0;
        
        downloadBtn.style.display = 'none';
        fileInfo.style.display = 'none';
        downloadControls.style.display = 'none';
        pausePlayBtn.innerText = 'Pause Download';
        pausePlayBtn.classList.remove('paused');
    });
}
