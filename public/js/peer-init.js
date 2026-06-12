const iceServers = [];
if (window.config && window.config.stunServer) iceServers.push({ urls: window.config.stunServer });
if (window.config && window.config.turnServer) {
    iceServers.push({
        urls: window.config.turnServer,
        username: window.config.turnUser,
        credential: window.config.turnPass
    });
}

const peer = new Peer({
    host: window.location.hostname,
    port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    config: { iceServers }
});

peer.on('disconnected', () => {
    console.log('Disconnected from signaling server. Reconnecting...');
    peer.reconnect();
});
