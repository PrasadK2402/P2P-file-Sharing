if (discardBtn) {
    discardBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        state.activeConnections.forEach(conn => {
            try {
                conn.send({ type: 'SESSION_TERMINATED' });
            } catch (e) {}
            conn.close();
        });
        state.activeConnections.clear();
        resetSenderToPicker();
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
        clearPeerProgress();
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

        resetSenderToPicker();
    });
}

if (fileInput) {
    const prepareHostingFromSelection = async () => {
        const state = window.uploaderState;
        const files = Array.from(state.selectedFiles || []);
        if (!files.length || state.activeSlug) return;

        fileInput.disabled = true;
        status.innerText = files.length > 1 ? 'Preparing zip archive...' : 'Preparing share link...';

        const slug = state.activeSlug || Math.random().toString(36).substring(2, 10);
        const activationSessionId = state.selectionSessionId;

        try {
            if (files.length === 1) {
                state.selectedFile = files[0];
            } else {
                const zipFile = await buildZipFile(files, 'files.zip');
                if (activationSessionId !== state.selectionSessionId) return;
                state.selectedFile = zipFile;
            }

            const res = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ peerId: state.peer.id, slug })
            });

            if (activationSessionId !== state.selectionSessionId || !state.selectedFiles.length) {
                return;
            }

            if (res.ok) {
                state.activeSlug = slug;
                localStorage.setItem('active_share', JSON.stringify({ slug, name: state.selectedFiles.map(file => file.name).join(', ') }));
                const shareLink = `${window.location.origin}/download/${slug}`;
                linkContainer.style.display = 'flex';
                linkDiv.innerHTML = `Share link: <a href="${shareLink}" target="_blank">${shareLink}</a>`;
                status.innerText = state.isPaused ? 'Share link activated. Sharing is paused.' : 'Link activated. Waiting for connections...';
                restoreBanner.style.display = 'none';
                instructionText.style.display = 'block';
                instructionText.innerHTML = `Currently hosting: <strong>${state.selectedFile ? state.selectedFile.name : 'files.zip'}</strong>`;
                uploadWrapper.style.display = 'none';
                resetBtn.style.display = 'block';

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
                resetSenderToPicker();
            }
        } catch (err) {
            console.error('Failed to prepare hosted file:', err);
            status.innerText = 'Failed to prepare hosted file.';
            setStatusDot('red');
            resetSenderToPicker();
        }
    };

    window.uploaderState.prepareHostingFromSelection = prepareHostingFromSelection;

    fileInput.addEventListener('change', async (e) => {
        const state = window.uploaderState;
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        state.selectedFiles = files;
        await prepareHostingFromSelection();
    });
}

if (pausePlayBtn) {
    pausePlayBtn.addEventListener('click', () => {
        const state = window.uploaderState;
        if (!state.selectedFiles.length && !state.activeSlug) return;
        state.isPaused = !state.isPaused;
        if (state.isPaused) {
            pausePlayBtn.innerText = 'Resume Upload';
            pausePlayBtn.classList.add('paused');
            status.innerText = state.activeSlug ? 'Upload paused.' : 'Share staged. Transfer paused before start.';
            setStatusDot('yellow');
            if (streamAnimation) streamAnimation.style.display = 'none';
            state.activeConnections.forEach(conn => {
                conn.send({ type: 'HOST_PAUSE' });
            });
        } else {
            pausePlayBtn.innerText = 'Pause Upload';
            pausePlayBtn.classList.remove('paused');
            status.innerText = state.activeConnections.size > 0 ? `Connected peers: ${state.activeConnections.size}` : 'Share resumed. Waiting for connections...';
            setStatusDot(state.activeConnections.size > 0 ? 'green' : 'yellow');
            if (streamAnimation && state.activeConnections.size > 0 && state.selectedFiles.length) streamAnimation.style.display = 'flex';
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

        resetSenderToPicker();
    });
}
