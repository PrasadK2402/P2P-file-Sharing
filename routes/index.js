const express = require('express');
const router = express.Router();

module.exports = (redis) => {
    router.get('/', (req, res) => {
        res.render('index', {
            stunServer: process.env.STUN_SERVER,
            turnServer: process.env.TURN_SERVER,
            turnUser: process.env.TURN_USERNAME,
            turnPass: process.env.TURN_PASSWORD
        });
    });

    router.post('/api/create', async (req, res) => {
        const { peerId, slug } = req.body;
        if (!peerId || !slug) return res.status(400).json({ error: 'PeerID and Slug required' });

        try {
            // Store key link with 1-hour expiration window
            await redis.set(`slug:${slug}`, peerId, 'EX', 3600);
            res.json({ success: true, slug });
        } catch (err) {
            res.status(500).json({ error: 'Database write error' });
        }
    });

    router.get('/download/:slug', async (req, res) => {
        const slug = req.params.slug;
        
        try {
            const peerId = await redis.get(`slug:${slug}`);
            if (!peerId) return res.status(404).send('Link expired or invalid');
            
            res.render('download', {
                slug: slug,
                uploaderPeerId: peerId,
                stunServer: process.env.STUN_SERVER,
                turnServer: process.env.TURN_SERVER,    
                turnUser: process.env.TURN_USERNAME,
                turnPass: process.env.TURN_PASSWORD
            });
        } catch (err) {
            res.status(500).send('Database read error');
        }
    });

    router.get('/api/peer/:slug', async (req, res) => {
        const slug = req.params.slug;
        try {
            const peerId = await redis.get(`slug:${slug}`);
            if (!peerId) return res.status(404).json({ error: 'Link expired or invalid' });
            res.json({ peerId });
        } catch (err) {
            res.status(500).json({ error: 'Database read error' });
        }
    });

    router.post('/api/delete', async (req, res) => {
        const { slug } = req.body;
        if (!slug) return res.status(400).json({ error: 'Slug required' });
        try {
            await redis.del(`slug:${slug}`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Database delete error' });
        }
    });

    return router;
};
