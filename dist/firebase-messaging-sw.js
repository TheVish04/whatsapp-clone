// --- FIREBASE MESSAGING SERVICE WORKER ---
// This file handles background notifications when the app is closed or minimized.

importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// --- CONFIGURATION ---
// IMPORTANT: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDupdTnEuyuFOwypK7tqIuCgmU_tHDcYiY",
    authDomain: "private-dddb2.firebaseapp.com",
    projectId: "private-dddb2",
    storageBucket: "private-dddb2.firebasestorage.app",
    messagingSenderId: "93498096619",
    appId: "1:93498096619:web:c0ea372d7e6f86170a77ae",
    measurementId: "G-B5C8C34XT5",
    databaseURL: "https://private-dddb2-default-rtdb.firebaseio.com"
};

// Initialize Firebase in Service Worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/icon.png', // Fallback icon path
        // Ensure that clicking the notification opens the chat
        click_action: 'https://whatsapp-clone-v2.vercel.app/' // Or your actual URL
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle Notification Click
self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    event.notification.close();

    const urlToOpen = 'https://www.tradingview.com/';

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if there's already a tab open with this URL
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('tradingview.com') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
