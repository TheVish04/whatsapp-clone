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
        // For Android Background Notifications (Data-only or Notification + Data)
        // To wake up app: Notification often needed or high priority data.
        notification: {
            title: title || "Market opens …",
            body: body || ""
        },
        data: data || {},
        android: {
            priority: 'high',
            notification: {
                channelId: 'market-update'
                // clickAction removed to let Capacitor/App handle it and fire listener
            }
        },
        data: {
            // Pass URL in data to be safe, though Intent needs data explicitly set in deeper config usually.
            // But for standard FCM, if we want to open a URL, we might need to rely on the App handling it
            // OR send a data message.
            // Let's stick to the previous plan but ensure client side handles it reliably.
            // Actually, if we want to bypass the app, clickAction should be the URL?
            // Android docs say click_action is an Intent filter.
            // To open a URL directly, we need a data message and a service or correct Setup.
            // SAFEST BET: Keep clickAction as is, but ensure logic is robust.
            // The user said "not to the app".
            // If I set "link": "https://..." in notification payload, it might work.
            url: "https://www.tradingview.com/"
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
