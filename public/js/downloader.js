// Theme Toggle and Canvas Grid initialization is handled in common.js

const status = document.getElementById('status');
const fileInfo = document.getElementById('fileInfo');
const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const downloadBtn = document.getElementById('downloadBtn');
const downloadControls = document.getElementById('downloadControls');
const pausePlayBtn = document.getElementById('pausePlayBtn');
const cancelBtn = document.getElementById('cancelBtn');
const streamAnimation = document.getElementById('streamAnimation');
const progressBar = document.getElementById('progressBar');

const slug = window.config.slug;
let uploaderPeerId = window.config.uploaderPeerId;

let conn = null;
let fileMetadata = null;
let receivedSize = 0;
let isDownloading = false;
let isPaused = false;
let isHostPaused = false;
let reconnectTimeout = null;
let lastActiveTime = Date.now();
let heartbeatInterval = null;
let pendingWrites = [];
let currentStatusColor = 'red';
window.currentStatusColor = currentStatusColor;
function setStatusDot(color) {
    currentStatusColor = color || 'red';
    window.currentStatusColor = currentStatusColor;
    status.classList.remove('status-green', 'status-yellow', 'status-red');
    if (color) {
        status.classList.add(`status-${color}`);
    }
    const h1 = document.querySelector('h1');
    if (h1) {
        h1.classList.remove('status-green', 'status-yellow', 'status-red');
        if (color) {
            h1.classList.add(`status-${color}`);
        }
    }
}

peer.on('disconnected', () => {
    console.log('Disconnected from signaling server. Reconnecting...');
    peer.reconnect();
});

peer.on('open', async (id) => {
    console.log('My peer ID is: ' + id);
    try {
        await initDB();
        const cachedMeta = await getStoredMetadata(slug);
        const records = await getStoredProgress(slug);
        const chunks = records.filter(r => r.offset !== undefined);
        let size = 0;
        for (const r of chunks) {
            const len = r.data.byteLength !== undefined ? r.data.byteLength : (r.data.length || 0);
            if (r.offset === size) {
                size += len;
            } else {
                break;
            }
        }
        receivedSize = size;
        
        if (receivedSize > 0 && cachedMeta) {
            progressBar.style.display = 'block';
            status.innerText = `Found partial download progress for ${cachedMeta.name}. Ready to resume at ${(receivedSize / (1024 * 1024)).toFixed(2)} MB.`;
        }
    } catch (err) {
        console.error("IndexedDB initialization error:", err);
    }
    connectToUploader();

    // Fade out page loader overlay
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 500);
    }
});

peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    if (err.type === 'peer-unavailable') {
        status.innerText = 'Uploader is offline. Retrying...';
        handleDisconnect();
    }
});

function startHeartbeat() {
    stopHeartbeat();
    lastActiveTime = Date.now();
    heartbeatInterval = setInterval(() => {
        if (!isPaused && isDownloading) {
            if (Date.now() - lastActiveTime > 30000) {
                console.log("Heartbeat timeout. Assuming connection dead.");
                handleDisconnect();
            } else {
                if (conn && conn.open) {
                    conn.send({ type: 'PING' });
                }
            }
        }
    }, 5000);
}

function stopHeartbeat() {
    clearInterval(heartbeatInterval);
}

async function connectToUploader() {
    if (conn) {
        conn.close();
    }
    stopHeartbeat();

    status.innerText = 'Resolving uploader address...';
    try {
        const res = await fetch(`/api/peer/${slug}`);
        if (res.status === 404) {
            status.innerText = '⚠️ The sharing session has been terminated by the uploader. Redirecting to homepage...';
            setStatusDot('red');
            isDownloading = false;
            progressBar.style.display = 'none';
            fileInfo.style.display = 'none';
            stopHeartbeat();
            clearTimeout(reconnectTimeout);
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
            return;
        }
        if (res.ok) {
            const data = await res.json();
            if (data.peerId) {
                uploaderPeerId = data.peerId;
            }
        }
    } catch (e) {
        console.error("Could not resolve latest peer ID:", e);
    }
    
    status.innerText = 'Connecting to uploader...';
    conn = peer.connect(uploaderPeerId, { reliable: true });

    conn.on('open', () => {
        clearTimeout(reconnectTimeout);
        if (isDownloading) {
            status.innerText = 'Reconnected! Resuming download...';
            setStatusDot('green');
            if (streamAnimation) streamAnimation.style.display = 'flex';
            startHeartbeat();
            if (!isPaused) {
                conn.send({ type: 'START_DOWNLOAD', offset: receivedSize });
            }
        } else {
            if (receivedSize > 0) {
                status.innerText = `Connected! Ready to resume download at ${(receivedSize / (1024 * 1024)).toFixed(2)} MB.`;
            } else {
                status.innerText = 'Connected! Requesting file info...';
            }
            conn.send({ type: 'REQUEST_INFO' });
            setStatusDot('yellow');
        }
    });

    conn.on('data', async (data) => {
        lastActiveTime = Date.now();
        if (data.type === 'INFO') {
            let fileChanged = false;
            try {
                const cachedMeta = await getStoredMetadata(slug);
                if (cachedMeta && (cachedMeta.name !== data.name || cachedMeta.size !== data.size)) {
                    console.log("Cached file metadata mismatch. Resetting local cache.");
                    await clearStoredChunks(slug);
                    receivedSize = 0;
                    progressBar.value = 0;
                    downloadBtn.innerText = 'Download';
                    isDownloading = false;
                    fileChanged = true;
                }
                await storeMetadata(slug, { name: data.name, size: data.size });
            } catch (err) {
                console.error("Failed to verify metadata:", err);
            }

            fileMetadata = data;
            fileNameSpan.innerText = data.name;
            fileSizeSpan.innerText = (data.size / (1024 * 1024)).toFixed(2) + ' MB';
            fileInfo.style.display = 'block';
            
            // Configure progress bar limits natively
            progressBar.max = fileMetadata.size;
            progressBar.value = receivedSize;
            
            // Only reset UI controls if the file actually changed or if we are not actively downloading
            if (fileChanged || !isDownloading) {
                downloadBtn.style.display = 'inline-flex';
                downloadControls.style.display = 'none';
                pausePlayBtn.innerText = 'Pause Download';
                pausePlayBtn.classList.remove('paused');
                isPaused = false;

                if (receivedSize > 0) {
                    downloadBtn.innerText = 'Resume Download';
                    status.innerText = `Connected! Ready to resume download at ${(receivedSize / (1024 * 1024)).toFixed(2)} MB.`;
                    setStatusDot('red');
                } else {
                    downloadBtn.innerText = 'Download';
                    status.innerText = 'Connected! Ready to download.';
                    setStatusDot('red');
                }
            }
        } else if (data.type === 'CHUNK') {
            handleChunk(data);
        } else if (data.type === 'TRANSFER_CANCELLED') {
            status.innerText = '⚠️ Transfer was cancelled by the uploader.';
            setStatusDot('red');
            if (streamAnimation) streamAnimation.style.display = 'none';
            isDownloading = false;
            try {
                await clearStoredChunks(slug);
            } catch (e) {}
            receivedSize = 0;
            progressBar.value = 0;
            fileInfo.style.display = 'none';
            downloadBtn.style.display = 'none';
            downloadControls.style.display = 'none';
            fileMetadata = null;
            stopHeartbeat();
        } else if (data.type === 'NO_FILE_HOSTED') {
            status.innerText = '⚠️ No file is currently hosted by the sender.';
            setStatusDot('red');
            if (streamAnimation) streamAnimation.style.display = 'none';
            isDownloading = false;
            progressBar.value = 0;
            fileInfo.style.display = 'none';
            downloadBtn.style.display = 'none';
            downloadControls.style.display = 'none';
            fileMetadata = null;
        } else if (data.type === 'HOST_PAUSE') {
            status.innerText = 'Upload paused by host.';
            setStatusDot('yellow');
            isHostPaused = true;
            if (streamAnimation) streamAnimation.style.display = 'none';
        } else if (data.type === 'HOST_RESUME') {
            isHostPaused = false;
            if (isDownloading && !isPaused) {
                status.innerText = 'Downloading...';
                setStatusDot('green');
                if (streamAnimation) streamAnimation.style.display = 'flex';
                conn.send({ type: 'START_DOWNLOAD', offset: receivedSize });
            } else {
                status.innerText = 'Connected! Ready to download.';
                setStatusDot('yellow');
            }
        } else if (data.type === 'SESSION_TERMINATED') {
            status.innerText = '⚠️ The sharing session has been terminated by the uploader. Redirecting to homepage...';
            setStatusDot('red');
            if (streamAnimation) streamAnimation.style.display = 'none';
            isDownloading = false;
            progressBar.style.display = 'none';
            fileInfo.style.display = 'none';
            stopHeartbeat();
            clearTimeout(reconnectTimeout);
            if (conn) conn.close();
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
    });

    conn.on('close', () => {
        handleDisconnect();
    });

    conn.on('error', (err) => {
        console.error('Data channel connection error:', err);
        handleDisconnect();
    });
}

function handleDisconnect() {
    stopHeartbeat();
    setStatusDot('red');
    if (streamAnimation) streamAnimation.style.display = 'none';
    if (!isDownloading) {
        status.innerText = 'Connection to uploader lost.';
        return;
    }
    status.innerText = `Connection lost. Reconnecting... (Received: ${(receivedSize / (1024 * 1024)).toFixed(2)} MB)`;
    
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        connectToUploader();
    }, 3000);
}

window.downloaderState = {
    get isDownloading() { return isDownloading; },
    set isDownloading(v) { isDownloading = v; },
    get isPaused() { return isPaused; },
    set isPaused(v) { isPaused = v; },
    get isHostPaused() { return isHostPaused; },
    set isHostPaused(v) { isHostPaused = v; },
    get receivedSize() { return receivedSize; },
    set receivedSize(v) { receivedSize = v; },
    get fileMetadata() { return fileMetadata; },
    set fileMetadata(v) { fileMetadata = v; },
    get conn() { return conn; },
    set conn(v) { conn = v; },
    get slug() { return slug; },
    get pendingWrites() { return pendingWrites; },
    set pendingWrites(v) { pendingWrites = v; },
    startHeartbeat,
    stopHeartbeat,
    clearStoredChunks
};



// Interactive grid canvas initialization is handled in common.js
