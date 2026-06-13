async function handleChunk(data) {
    const state = window.downloaderState;
    if (!state || !state.isDownloading) return;
    if (data.done) {
        state.sendProgressUpdate(true);
        status.innerText = 'Download complete! Assembling...';
        state.stopHeartbeat();
        try {
            // Wait for all background database writes to finish before assembling
            await Promise.all(state.pendingWrites);
            state.pendingWrites = [];

            const records = await getStoredProgress(state.slug);
            const blob = new Blob(records.map(r => r.data), { type: state.fileMetadata.fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = state.fileMetadata.name;
            a.click();
            URL.revokeObjectURL(url);
            status.innerText = 'File saved.';
            setStatusDot('red');
            await state.clearStoredChunks(state.slug);
        } catch (err) {
            console.error("Assembly or cleanup failed:", err);
            status.innerText = 'File assembly failed.';
            setStatusDot('red');
        }
        progressBar.style.display = 'none';
        downloadControls.style.display = 'none';
        if (streamAnimation) streamAnimation.style.display = 'none';
        state.isDownloading = false;
        return;
    }

    if (data.offset === state.receivedSize) {
        const chunkLength = data.buffer.byteLength !== undefined ? data.buffer.byteLength : (data.buffer.length || 0);
        // Start the DB write in the background without blocking the incoming chunks flow
        const writePromise = storeChunk(state.slug, data.offset, data.buffer).catch(err => {
            console.error("Failed to cache chunk:", err);
            throw err;
        });
        state.pendingWrites.push(writePromise);

        // Update receivedSize synchronously so the next incoming chunk (which arrives immediately)
        // matches the updated offset check
        state.receivedSize += chunkLength;
        progressBar.value = state.receivedSize; // Update progress bar natively
        state.sendProgressUpdate();
    }
}
