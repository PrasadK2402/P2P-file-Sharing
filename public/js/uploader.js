// Theme Toggle and Canvas Grid initialization is handled in common.js

const fileInput = document.getElementById('fileInput');
const uploadWrapper = document.getElementById('uploadWrapper');
const status = document.getElementById('status');
const linkContainer = document.getElementById('linkContainer');
const linkDiv = document.getElementById('link');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const restoreBanner = document.getElementById('restoreBanner');
const restoreMsg = document.getElementById('restoreMsg');
const discardBtn = document.getElementById('discardBtn');
const controlPanel = document.getElementById('controlPanel');
const pausePlayBtn = document.getElementById('pausePlayBtn');
const cancelTransferBtn = document.getElementById('cancelTransferBtn');
const peerProgressArea = document.getElementById('peerProgressArea');
const peerProgressList = document.getElementById('peerProgressList');
const selectedFilesPanel = document.getElementById('selectedFilesPanel');
const selectedFilesSummary = document.getElementById('selectedFilesSummary');
const selectedFilesList = document.getElementById('selectedFilesList');
const streamAnimation = document.getElementById('streamAnimation');
const instructionText = document.getElementById('instructionText');

let selectedFiles = [];
let selectedFile = null;
let isPaused = false;
let activeSlug = null;
let activeConnections = new Set();
let selectionSessionId = 0;
let nextPeerProgressLabel = 1;
const peerProgressMap = new Map();
const peerProgressLabels = new Map();

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

function clampProgress(percent) {
    const value = Number(percent);
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function getPeerProgressLabel(peerId) {
    if (!peerProgressLabels.has(peerId)) {
        peerProgressLabels.set(peerId, `Peer ${nextPeerProgressLabel++}`);
    }
    return peerProgressLabels.get(peerId);
}

function renderPeerProgress() {
    if (!peerProgressArea || !peerProgressList) return;

    peerProgressList.innerHTML = '';

    if (peerProgressMap.size === 0) {
        peerProgressArea.style.display = 'none';
        return;
    }

    peerProgressArea.style.display = 'block';

    for (const [peerId, entry] of peerProgressMap.entries()) {
        const percent = clampProgress(entry.percent);
        const isComplete = Boolean(entry.complete) || percent >= 100;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '0.45rem';
        row.style.padding = '0.7rem 0.75rem';
        row.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        row.style.borderRadius = '10px';
        row.style.background = 'rgba(255, 255, 255, 0.02)';

        if (isComplete) {
            row.style.borderColor = 'rgba(16, 185, 129, 0.28)';
        }

        const label = document.createElement('div');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.justifyContent = 'space-between';
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-main)';
        label.style.letterSpacing = '0.04em';
        label.textContent = `${getPeerProgressLabel(peerId)}: ${percent}%${isComplete ? ' ✓' : ''}`;

        const barOuter = document.createElement('div');
        barOuter.style.width = '100%';
        barOuter.style.height = '8px';
        barOuter.style.borderRadius = '999px';
        barOuter.style.overflow = 'hidden';
        barOuter.style.background = 'rgba(255, 255, 255, 0.05)';
        barOuter.style.border = '1px solid rgba(255, 255, 255, 0.06)';

        const barInner = document.createElement('div');
        barInner.style.height = '100%';
        barInner.style.width = `${percent}%`;
        barInner.style.borderRadius = '999px';
        barInner.style.transition = 'width 0.25s ease';
        barInner.style.background = isComplete
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, var(--text-main), rgba(255, 255, 255, 0.55))';

        barOuter.appendChild(barInner);
        row.appendChild(label);
        row.appendChild(barOuter);
        peerProgressList.appendChild(row);
    }
}

function setPeerProgress(peerId, percent, options = {}) {
    if (!peerId) return;
    const normalizedPercent = clampProgress(percent);
    peerProgressMap.set(peerId, {
        percent: normalizedPercent,
        complete: Boolean(options.complete) || normalizedPercent >= 100
    });
    getPeerProgressLabel(peerId);
    renderPeerProgress();
}

function removePeerProgress(peerId) {
    if (!peerId || !peerProgressMap.has(peerId)) return;
    const entry = peerProgressMap.get(peerId);
    if (entry && entry.complete) {
        renderPeerProgress();
        return;
    }
    peerProgressMap.delete(peerId);
    peerProgressLabels.delete(peerId);
    renderPeerProgress();
}

function clearPeerProgress() {
    peerProgressMap.clear();
    peerProgressLabels.clear();
    nextPeerProgressLabel = 1;
    renderPeerProgress();
}

function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${size} B`;
}

function renderSelectedFiles(files) {
    if (!selectedFilesPanel || !selectedFilesSummary || !selectedFilesList) return;

    selectedFilesList.innerHTML = '';

    if (!files || files.length === 0) {
        selectedFilesPanel.style.display = 'none';
        selectedFilesSummary.textContent = '';
        if (controlPanel) controlPanel.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        return;
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    selectedFilesSummary.textContent = `${files.length} file${files.length === 1 ? '' : 's'} staged · ${formatFileSize(totalBytes)} total`;

    files.forEach((file, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.gap = '0.75rem';
        row.style.padding = '0.65rem 0.75rem';
        row.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        row.style.borderRadius = '10px';
        row.style.background = 'rgba(255, 255, 255, 0.02)';

        const name = document.createElement('div');
        name.style.minWidth = '0';
        name.style.fontSize = '0.75rem';
        name.style.color = 'var(--text-main)';
        name.style.letterSpacing = '0.04em';
        name.style.wordBreak = 'break-word';
        name.textContent = `${index + 1}. ${file.name}`;

        const size = document.createElement('div');
        size.style.flexShrink = '0';
        size.style.fontSize = '0.7rem';
        size.style.color = 'var(--text-muted)';
        size.textContent = formatFileSize(file.size);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.style.flexShrink = '0';
        removeBtn.style.fontFamily = 'var(--font-mono)';
        removeBtn.style.fontSize = '0.65rem';
        removeBtn.style.letterSpacing = '0.05em';
        removeBtn.style.padding = '0.35rem 0.6rem';
        removeBtn.style.borderRadius = '999px';
        removeBtn.style.border = '1px solid rgba(255, 0, 60, 0.3)';
        removeBtn.style.background = 'transparent';
        removeBtn.style.color = 'var(--accent-red)';
        removeBtn.style.cursor = 'pointer';
        removeBtn.addEventListener('click', () => {
            removeStagedFile(index);
        });

        const meta = document.createElement('div');
        meta.style.display = 'flex';
        meta.style.alignItems = 'center';
        meta.style.gap = '0.6rem';
        meta.appendChild(size);
        meta.appendChild(removeBtn);

        row.appendChild(name);
        row.appendChild(meta);
        selectedFilesList.appendChild(row);
    });

    selectedFilesPanel.style.display = 'block';
    if (controlPanel) controlPanel.style.display = 'block';
    if (resetBtn) resetBtn.style.display = 'block';
}

function setStagedFiles(files) {
    selectionSessionId += 1;
    selectedFiles = Array.isArray(files) ? files.slice() : [];
    renderSelectedFiles(selectedFiles);
}

function removeStagedFile(index) {
    if (index < 0 || index >= selectedFiles.length) return;
    const nextFiles = selectedFiles.filter((_, currentIndex) => currentIndex !== index);
    if (nextFiles.length === 0) {
        resetSenderToPicker();
        return;
    }
    setStagedFiles(nextFiles);
    if (!activeSlug && window.uploaderState && typeof window.uploaderState.prepareHostingFromSelection === 'function') {
        window.uploaderState.prepareHostingFromSelection();
    }
}

function resetSenderToPicker(options = {}) {
    const keepSlug = Boolean(options.keepSlug);
    selectedFiles = [];
    selectedFile = null;
    isPaused = false;
    selectionSessionId += 1;

    if (fileInput) {
        fileInput.value = '';
        fileInput.disabled = false;
    }

    clearPeerProgress();
    renderSelectedFiles([]);

    if (!keepSlug) {
        activeSlug = null;
        localStorage.removeItem('active_share');
    }

    if (uploadWrapper) uploadWrapper.style.display = 'block';
    if (linkContainer) linkContainer.style.display = 'none';
    if (linkDiv) linkDiv.innerHTML = '';
    if (selectedFilesPanel) selectedFilesPanel.style.display = 'none';
    if (controlPanel) controlPanel.style.display = 'none';
    if (restoreBanner) restoreBanner.style.display = 'none';
    if (instructionText) {
        instructionText.style.display = 'block';
        instructionText.innerHTML = 'Select a file to start sharing. Senders must keep this tab open to allow peers to fetch files.';
    }
    if (streamAnimation) streamAnimation.style.display = 'none';
    if (pausePlayBtn) {
        pausePlayBtn.innerText = 'Pause Upload';
        pausePlayBtn.classList.remove('paused');
    }
    if (cancelTransferBtn) {
        cancelTransferBtn.innerText = 'Cancel Transfer';
    }
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }
}

async function buildZipFile(files, archiveName) {
    if (!window.JSZip) {
        throw new Error('JSZip is not available.');
    }

    const zip = new JSZip();
    for (const file of files) {
        zip.file(file.name, file);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return new File([blob], archiveName, { type: 'application/zip' });
}



peer.on('open', (id) => {
    status.innerText = 'Ready. Select a file.';
    console.log('My peer ID is: ' + id);
    checkRestoreSession();

    // Fade out page loader once PeerJS is open
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 500);
    }
});

function checkRestoreSession() {
    const saved = localStorage.getItem('active_share');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            activeSlug = data.slug;
            restoreMsg.innerHTML = `⚠️ <strong>Resuming Link</strong><br>You have an active sharing link for <strong>${data.name}</strong>. Please select this file again to resume hosting.`;
            restoreBanner.style.display = 'block';
            instructionText.style.display = 'none';
        } catch (e) {
            localStorage.removeItem('active_share');
        }
    }
}

window.uploaderState = {
    get selectedFiles() { return selectedFiles; },
    set selectedFiles(v) { setStagedFiles(v); },
    get selectedFile() { return selectedFile; },
    set selectedFile(v) { selectedFile = v || null; },
    get isPaused() { return isPaused; },
    set isPaused(v) { isPaused = v; },
    get activeSlug() { return activeSlug; },
    set activeSlug(v) { activeSlug = v; },
    get activeConnections() { return activeConnections; },
    get selectionSessionId() { return selectionSessionId; },
    removeStagedFile,
    get peer() { return peer; },
    sendFile,
    checkRestoreSession
};


peer.on('connection', (conn) => {
    console.log('Connected to peer: ' + conn.peer);
    activeConnections.add(conn);
    setPeerProgress(conn.peer, peerProgressMap.get(conn.peer)?.percent || 0, { complete: peerProgressMap.get(conn.peer)?.complete || false });
    status.innerText = `Connected peers: ${activeConnections.size}`;
    setStatusDot('green');

    conn.on('data', (data) => {
        if (data.type === 'REQUEST_INFO') {
            if (isPaused) {
                conn.send({ type: 'HOST_PAUSE' });
                return;
            }
            if (!selectedFile) {
                console.log('Peer requested info, but file is not selected yet.');
                conn.send({ type: 'NO_FILE_HOSTED' });
                return;
            }
            conn.send({
                type: 'INFO',
                name: selectedFile.name,
                size: selectedFile.size,
                fileType: selectedFile.type
            });
        } else if (data.type === 'START_DOWNLOAD') {
            if (isPaused) {
                conn.send({ type: 'HOST_PAUSE' });
                return;
            }
            if (!selectedFile) {
                conn.send({ type: 'NO_FILE_HOSTED' });
                return;
            }
            sendFile(conn, data.offset || 0);
        } else if (data.type === 'PAUSE_TRANSFER') {
            conn.isTransferPaused = true;
        } else if (data.type === 'CANCEL_TRANSFER') {
            conn.isTransferPaused = true;
            status.innerText = `Transfer cancelled by peer. Connected peers: ${activeConnections.size}`;
            setStatusDot('red');
        } else if (data.type === 'PROGRESS_UPDATE') {
            const peerId = data.peerId || conn.peer;
            const percent = clampProgress(data.percent);
            setPeerProgress(peerId, percent, { complete: Boolean(data.complete) || percent >= 100 });
        } else if (data.type === 'TRANSFER_COMPLETE') {
            setPeerProgress(conn.peer, 100, { complete: true });
        } else if (data.type === 'PING') {
            conn.send({ type: 'PONG' });
        }
    });

    conn.on('close', () => {
        activeConnections.delete(conn);
        removePeerProgress(conn.peer);
        if (activeConnections.size === 0) {
            status.innerText = 'Waiting for connections...';
            setStatusDot('red');
        } else {
            status.innerText = `Connected peers: ${activeConnections.size}`;
            setStatusDot('green');
        }
    });

    conn.on('error', (err) => {
        console.error('Connection error:', err);
        activeConnections.delete(conn);
        removePeerProgress(conn.peer);
        if (activeConnections.size === 0) {
            status.innerText = 'Waiting for connections...';
            setStatusDot('red');
        } else {
            status.innerText = `Connected peers: ${activeConnections.size}`;
            setStatusDot('green');
        }
    });
});

// Event listeners extracted to uploaderEvents.js



// Interactive grid canvas initialization is handled in common.js
