const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const http = require('http');
const server = http.createServer(app);

const port = process.env.PORT || 3001;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);  

redis.on('connect', () => console.log('Successfully connected to Redis.'));
redis.on('error', (err) => console.error('Redis Connection error:', err));

// Signaling server (PeerServer)
const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const routes = require('./routes/index');
app.use('/', routes(redis));

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});