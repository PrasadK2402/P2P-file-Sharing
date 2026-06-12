async function sendFile(conn, startOffset = 0) {
    try {
        const state = window.uploaderState;
        conn.isTransferPaused = false;
        setStatusDot('green');
        if (streamAnimation) streamAnimation.style.display = 'flex';
        const fileSlice = state.selectedFile.slice(startOffset);
        const reader = fileSlice.stream().getReader();
        let offset = startOffset;

        while (true) {
            if (state.isPaused || conn.isTransferPaused) {
                setStatusDot('yellow');
                if (streamAnimation) streamAnimation.style.display = 'none';
                reader.cancel();
                break;
            }

            const { done, value } = await reader.read();
            if (done) {
                conn.send({ type: 'CHUNK', done: true });
                status.innerText = 'Transfer complete!';
                setStatusDot('red');
                if (streamAnimation) streamAnimation.style.display = 'none';
                break;
            }

            // Segment chunk into safe 64KB slices for WebRTC Data Channel
            let valueOffset = 0;
            while (valueOffset < value.length) {
                if (state.isPaused || conn.isTransferPaused) {
                    break;
                }

                // WebRTC Backpressure: Check if channel queue is saturated
                if (conn.dataChannel && conn.dataChannel.bufferedAmount > 256 * 1024) {
                    await new Promise(resolve => {
                        const dc = conn.dataChannel;
                        dc.bufferedAmountLowThreshold = 64 * 1024;
                        const onLow = () => {
                            dc.removeEventListener('bufferedamountlow', onLow);
                            resolve();
                        };
                        dc.addEventListener('bufferedamountlow', onLow);
                    });
                }

                const chunkLength = Math.min(64 * 1024, value.length - valueOffset);
                const subArray = value.subarray(valueOffset, valueOffset + chunkLength);

                conn.send({
                    type: 'CHUNK',
                    buffer: subArray,
                    done: false,
                    offset: offset
                });
                offset += chunkLength;
                valueOffset += chunkLength;
            }
        }
    } catch (error) {
        console.error('Error sending file stream:', error);
        setStatusDot('red');
        if (streamAnimation) streamAnimation.style.display = 'none';
    }
}
