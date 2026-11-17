const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck endpoint for Coolify / Docker
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'whatsapp-clone'
    });
});

// Mount Push Notification API endpoint
const sendPushHandler = require('./api/send-push');
app.all('/api/send-push', sendPushHandler);

// Serve static assets from Vite build output (dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback: Route all unmatched GET requests to index.html
app.use((req, res) => {
    if (req.method === 'GET') {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'Not Found' });
    }
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp Clone server running on port ${PORT}`);
});
