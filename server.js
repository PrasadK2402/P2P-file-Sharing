const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');
require('dotenv').config();

const app = express();
const http = require('http');
const server = http.createServer(app);

const port = process.env.PORT || 3001;

// Signaling server (PeerServer)
const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory store for slugs to Peer IDs
const channels = new Map();

app.get('/', (req, res) => {
    res.render('index', {
        stunServer: process.env.STUN_SERVER,
        turnServer: process.env.TURN_SERVER,
        turnUser: process.env.TURN_USERNAME,
        turnPass: process.env.TURN_PASSWORD
    });
});

app.post('/api/create', (req, res) => {
    const { peerId, slug } = req.body;
    if (!peerId || !slug) return res.status(400).json({ error: 'PeerID and Slug required' });
    channels.set(slug, peerId);
    res.json({ success: true, slug });
});

app.get('/download/:slug', (req, res) => {
    const slug = req.params.slug;
    const peerId = channels.get(slug);
    if (!peerId) return res.status(404).send('Link expired or invalid');
    
    res.render('download', {
        uploaderPeerId: peerId,
        stunServer: process.env.STUN_SERVER,
        turnServer: process.env.TURN_SERVER,
        turnUser: process.env.TURN_USERNAME,
        turnPass: process.env.TURN_PASSWORD
    });
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
