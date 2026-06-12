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
const streamAnimation = document.getElementById('streamAnimation');
const instructionText = document.getElementById('instructionText');

let selectedFile = null;
let isPaused = false;
let activeSlug = null;
let activeConnections = new Set();

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
    get selectedFile() { return selectedFile; },
    set selectedFile(v) { selectedFile = v; },
    get isPaused() { return isPaused; },
    set isPaused(v) { isPaused = v; },
    get activeSlug() { return activeSlug; },
    set activeSlug(v) { activeSlug = v; },
    get activeConnections() { return activeConnections; },
    get peer() { return peer; },
    sendFile,
    checkRestoreSession
};


peer.on('connection', (conn) => {
    console.log('Connected to peer: ' + conn.peer);
    activeConnections.add(conn);
    status.innerText = `Connected peers: ${activeConnections.size}`;
    setStatusDot('green');

    conn.on('data', (data) => {
        if (data.type === 'REQUEST_INFO') {
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
        } else if (data.type === 'PING') {
            conn.send({ type: 'PONG' });
        }
    });

    conn.on('close', () => {
        activeConnections.delete(conn);
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
