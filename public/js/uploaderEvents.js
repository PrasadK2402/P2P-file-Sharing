if (discardBtn) {
    discardBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        localStorage.removeItem('active_share');
        state.activeSlug = null;
        restoreBanner.style.display = 'none';
        instructionText.style.display = 'block';
        instructionText.innerHTML = 'Select a file to start sharing. Senders must keep this tab open to allow peers to fetch files.';
        fileInput.value = '';
        fileInput.disabled = false;
        status.innerText = 'Ready. Select a file.';
        setStatusDot('red');
        linkContainer.style.display = 'none';
        linkDiv.innerHTML = '';
        controlPanel.style.display = 'none';
        uploadWrapper.style.display = 'block';
    });
}

if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        if (!state.activeSlug) return;
        const shareLink = `${window.location.origin}/download/${state.activeSlug}`;
        navigator.clipboard.writeText(shareLink).then(() => {
            copyBtn.innerHTML = `
                <svg style="width: 20px; height: 20px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                `;
            }, 2000);
        });
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        const state = window.uploaderState;
        state.activeConnections.forEach(conn => {
            try {
                conn.send({ type: 'SESSION_TERMINATED' });
            } catch (e) {}
            conn.close();
        });
        state.activeConnections.clear();

        if (state.activeSlug) {
            try {
                await fetch('/api/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug: state.activeSlug })
                });
            } catch (e) {
                console.error("Failed to delete room slug:", e);
            }
        }

        localStorage.removeItem('active_share');
        state.activeSlug = null;
        state.selectedFile = null;
        state.isPaused = false;

        fileInput.value = '';
        fileInput.disabled = false;
        status.innerText = 'Ready. Select a file.';
        setStatusDot('red');
        linkContainer.style.display = 'none';
        linkDiv.innerHTML = '';
        controlPanel.style.display = 'none';
        restoreBanner.style.display = 'none';
        instructionText.style.display = 'block';
        instructionText.innerHTML = 'Select a file to start sharing. Senders must keep this tab open to allow peers to fetch files.';
        uploadWrapper.style.display = 'block';
    });
}

if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const state = window.uploaderState;
        const file = e.target.files[0];
        if (!file) return;
        fileInput.disabled = true;
        state.selectedFile = file;

        status.innerText = 'Registering link...';
        
        const slug = state.activeSlug || Math.random().toString(36).substring(2, 10);
        
        const res = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerId: state.peer.id, slug })
        });

        if (res.ok) {
            state.activeSlug = slug;
            localStorage.setItem('active_share', JSON.stringify({ slug, name: state.selectedFile.name }));
            const shareLink = `${window.location.origin}/download/${slug}`;
            linkContainer.style.display = 'flex';
            linkDiv.innerHTML = `Share link: <a href="${shareLink}" target="_blank">${shareLink}</a>`;
            status.innerText = 'Link activated. Waiting for connections...';
            restoreBanner.style.display = 'none';
            instructionText.style.display = 'block';
            instructionText.innerHTML = `Currently hosting: <strong>${state.selectedFile.name}</strong>`;
            controlPanel.style.display = 'block';
            uploadWrapper.style.display = 'none';

            state.activeConnections.forEach(conn => {
                conn.send({
                    type: 'INFO',
                    name: state.selectedFile.name,
                    size: state.selectedFile.size,
                    fileType: state.selectedFile.type
                });
            });
        } else {
            status.innerText = 'Error registering link.';
            setStatusDot('red');
            fileInput.disabled = false;
            state.selectedFile = null;
        }
    });
}

if (pausePlayBtn) {
    pausePlayBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        state.isPaused = !state.isPaused;
        if (state.isPaused) {
            pausePlayBtn.innerText = 'Resume Upload';
            pausePlayBtn.classList.add('paused');
            status.innerText = 'Upload paused.';
            setStatusDot('yellow');
            if (streamAnimation) streamAnimation.style.display = 'none';
            state.activeConnections.forEach(conn => {
                conn.send({ type: 'HOST_PAUSE' });
            });
        } else {
            pausePlayBtn.innerText = 'Pause Upload';
            pausePlayBtn.classList.remove('paused');
            status.innerText = `Connected peers: ${state.activeConnections.size}`;
            setStatusDot('green');
            if (streamAnimation && state.activeConnections.size > 0 && state.selectedFile) streamAnimation.style.display = 'flex';
            state.activeConnections.forEach(conn => {
                conn.send({ type: 'HOST_RESUME' });
            });
        }
    });
}

if (cancelTransferBtn) {
    cancelTransferBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        // Cancel any active stream send reader on all connections
        state.activeConnections.forEach(conn => {
            conn.isTransferPaused = true;
            try {
                conn.send({ type: 'TRANSFER_CANCELLED' });
            } catch (e) {}
        });

        state.selectedFile = null;
        state.isPaused = false;
        fileInput.value = '';
        fileInput.disabled = false;
        
        // Update uploader UI
        status.innerText = 'Transfer cancelled. Select a file to share.';
        setStatusDot('red');
        if (streamAnimation) streamAnimation.style.display = 'none';
        instructionText.innerHTML = 'Select a file to start sharing. Senders must keep this tab open to allow peers to fetch files.';
        controlPanel.style.display = 'none';
        uploadWrapper.style.display = 'block';
        pausePlayBtn.innerText = 'Pause Upload';
        pausePlayBtn.classList.remove('paused');

        // Keep session slug in localStorage, but clear file name info
        if (state.activeSlug) {
            localStorage.setItem('active_share', JSON.stringify({ slug: state.activeSlug, name: '' }));
        }
    });
}
