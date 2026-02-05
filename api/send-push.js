const admin = require('firebase-admin');

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://private-dddb2-default-rtdb.firebaseio.com"
        });
    } else {
        console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token, title, body, data } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Missing token' });
    }

    const message = {
        token: token,
        notification: {
            title: title || "Market opens …",
            body: body || ""
        },
        data: { url: "https://www.tradingview.com/", ...(data || {}) },
        android: {
            priority: 'high',
            notification: {
                channelId: 'market-update'
            }
        }
    };

    // If generic "Market opens..." requested
    if (title === "Market opens …") {
        message.notification.title = "Market opens …";
        message.notification.body = "";
    }

    try {
        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ error: error.message });
    }
};
