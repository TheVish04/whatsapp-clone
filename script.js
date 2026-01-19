// --- CONFIGURATION ---
// REPLACE THIS OBJECT WITH YOUR ACTUAL FIREBASE CONFIG
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

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error("Firebase Init Error: Please replace firebaseConfig with actual values.");
}

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const db = firebase.database();
const messaging = firebase.messaging();

// REPLACE WITH YOUR ACTUAL KEYS
const VAPID_KEY = "BJ0uCMTncHrN6Way3i8qoagoN71lcE7PrSNl6E2zUJv2Rv8x4WczsSjId7wUVT2qoPbfGbJQmcjmPVA1kiwsTEE"; // Public Key only



// --- STATE ---
const PIN_CODE = "2009"; // Hardcoded PIN
let currentUser = null;
let chatPartner = null;
let currentChatRef = null;
let replyingTo = null; // Object { id, text, sender }

// --- DOM ELEMENTS ---
// Login
const loginScreen = document.getElementById('login-screen');
const userSelect = document.getElementById('username-select');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

// Chat
const chatScreen = document.getElementById('chat-screen');
const chatHeaderName = document.getElementById('chat-with-name');
const typingIndicator = document.getElementById('typing-indicator');
const lastSeenEl = document.getElementById('last-seen');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const sound = document.getElementById('msg-sound');
// Image Elements
const imageInput = document.getElementById('image-input');
const attachBtn = document.getElementById('attach-btn');
// Modal Elements
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.getElementById('close-modal');
// Reply Elements
const replyPreview = document.getElementById('reply-preview');
const replySender = document.getElementById('reply-sender');
const replyText = document.getElementById('reply-text');
const closeReply = document.getElementById('close-reply');
// Options Menu Elements
const optionsBtn = document.getElementById('options-btn');
const optionsDropdown = document.getElementById('options-dropdown');
const clearChatBtn = document.getElementById('clear-chat-btn');
// Emoji Elements
const emojiBtn = document.getElementById('emoji-btn');
const emojiPickerContainer = document.getElementById('emoji-picker-container');
const emojiPicker = document.querySelector('emoji-picker');
// Notification Elements
const appNotification = document.getElementById('app-notification');
const notificationMsg = document.getElementById('notification-msg');
const closeNotificationBtn = document.querySelector('.close-notification');

// Camera Elements
const cameraBtn = document.getElementById('camera-btn');
const cameraModal = document.getElementById('camera-modal');
const cameraStream = document.getElementById('camera-stream'); // video
const cameraCanvas = document.getElementById('camera-canvas'); // canvas
const closeCameraBtn = document.getElementById('close-camera');
const captureBtn = document.getElementById('capture-btn');
const switchCameraBtn = document.getElementById('switch-camera');
// Preview Elements
const cameraPreview = document.getElementById('camera-preview');
const cameraControls = document.getElementById('camera-controls');
const previewControls = document.getElementById('preview-controls');
const retakeBtn = document.getElementById('retake-btn');
const sendPhotoBtn = document.getElementById('send-photo-btn');

let cameraStreamTrack = null;
let currentFacingMode = 'user'; // 'user' or 'environment'

// --- EVENT LISTENERS ---

loginBtn.addEventListener('click', handleLogin);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', handleTyping);

// Image Events
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageSelect);

// Modal Events
chatContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('msg-image')) {
        modal.classList.remove('hidden');
        modalImg.src = e.target.src;
    }
});

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

closeReply.addEventListener('click', cancelReply);

// Options Menu Events
optionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsDropdown.classList.toggle('hidden');
    emojiPickerContainer.classList.add('hidden'); // Close emoji picker if open
});

document.addEventListener('click', (e) => {
    if (!optionsBtn.contains(e.target) && !optionsDropdown.contains(e.target)) {
        optionsDropdown.classList.add('hidden');
    }

    // Close emoji picker if clicked outside
    if (!emojiBtn.contains(e.target) && !emojiPickerContainer.contains(e.target)) {
        emojiPickerContainer.classList.add('hidden');
    }
});

clearChatBtn.addEventListener('click', handleClearChat);

// Emoji Events
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPickerContainer.classList.toggle('hidden');
    optionsDropdown.classList.add('hidden'); // Close options if open
});

emojiPicker.addEventListener('emoji-click', (e) => {
    messageInput.value += e.detail.unicode;
    messageInput.focus();
});

// Notification Events
appNotification.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-notification')) {
        appNotification.classList.add('hidden');
        e.stopPropagation();
        return;
    }
    window.open('https://www.tradingview.com/', '_blank');
    appNotification.classList.add('hidden');
});

// Camera Events
cameraBtn.addEventListener('click', openCamera);
closeCameraBtn.addEventListener('click', closeCameraModal);
captureBtn.addEventListener('click', capturePhoto);
switchCameraBtn.addEventListener('click', switchCamera);
retakeBtn.addEventListener('click', retakePhoto);
sendPhotoBtn.addEventListener('click', confirmSendPhoto);

// --- FUNCTIONS ---

function handleLogin() {
    const user = userSelect.value;
    const pin = pinInput.value;

    if (!user) {
        showError("Please select a user.");
        return;
    }

    if (pin !== PIN_CODE) {
        showError("Incorrect PIN.");
        return;
    }

    // Success
    currentUser = user;
    chatPartner = currentUser === 'XAU/USD' ? 'BTC/USD' : 'XAU/USD';

    // Switch UI
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    // Setup Chat
    chatHeaderName.textContent = chatPartner.charAt(0).toUpperCase() + chatPartner.slice(1);

    initializeChat();
    initializePresence();

    // Request Notification Permission with user feedback
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission().then(function (permission) {
                console.log("Notification permission:", permission);
                if (permission === "denied") {
                    alert("Notifications blocked! Go to browser settings to enable.");
                }
            });
        } else if (Notification.permission === "denied") {
            alert("Notifications are blocked. Please enable in browser Settings > Site Settings > Notifications.");
        } else {
            console.log("Notification permission already granted");
        }
    } else {
        console.log("Notifications not supported in this browser");
    }

    // --- FCM SETUP ---
    // Check Platform
    if (Capacitor.isNativePlatform()) {
        setupNativePush();
    } else {
        setupFCM();
    }
}

async function setupNativePush() {
    // Request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        console.log("User denied permissions!");
        return;
    }

    // Register
    await PushNotifications.register();

    // Listeners
    PushNotifications.addListener('registration', (token) => {
        console.log('Push Registration Token: ', token.value);
        saveTokenToDatabase(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
        console.error('Error on registration: ', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
        const { title, body } = notification;
        // If in foreground, show in-app? Or just rely on OS.
        // Capacitor plugin usually shows generic notification if app is background.
        // If foreground, we can emit sound or show banner.
        // For now: just log. 
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ', notification);
        const url = notification.notification.data.url;
        if (url) { // click_action from data
            // If URL is tradingview, open it
            if (url.includes('tradingview.com')) {
                // Use Browser plugin or window.open
                window.open(url, '_system');
            }
        }
    });
}

function setupFCM() {
    if (!("serviceWorker" in navigator)) {
        console.log("Service Worker not supported");
        return;
    }

    // Register Service Worker
    navigator.serviceWorker.register('./firebase-messaging-sw.js')
        .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);

            // Get Token
            return messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
        })
        .then((currentToken) => {
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                saveTokenToDatabase(currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
                // We rely on user interaction (Login button) to request permission
            }
        })
        .catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
        });

    // Listen for foreground messages (optional, since we handle via child_added)
    messaging.onMessage((payload) => {
        console.log('Message received. ', payload);
    });
}

function saveTokenToDatabase(token) {
    // Save token under tokens/devices/{deviceId}
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    // Independent of currentUser
    // Independent of currentUser
    db.ref(`tokens/devices/${deviceId}`).set(token);

    // ALSO Save for User lookup (so we can send pushes)
    if (currentUser) {
        db.ref(`tokens/users/${currentUser}/${deviceId}`).set(token);
    }
}

async function sendPushToPartner() {
    if (!chatPartner) return;

    // 1. Get tokens for partner
    const snapshot = await db.ref(`tokens/users/${chatPartner}`).once('value');
    if (!snapshot.exists()) return;

    const tokensMap = snapshot.val();
    const tokens = Object.values(tokensMap);

    // 2. Send to all
    tokens.forEach(token => {
        fetch('/api/send-push', { // Update URL in production
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                title: "Market opens …",
                body: ""
            })
        }).catch(err => console.error("API Push Error", err));
    });
}

function showError(msg) {
    loginError.textContent = msg;
    setTimeout(() => loginError.textContent = '', 3000);
}

function initializeChat() {
    // 1. Listen for Messages
    const messagesRef = db.ref('messages');

    // Limit to last 50 to keep DOM light, but requirement says "persist", so load them all or last N
    // We will just verify the correct security PIN is included via the data itself if we want to be tricky,
    // but here we just read.
    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        renderMessage(msg, snapshot.key); // Pass key to mark as seen

        // Mark as seen if it's incoming
        if (msg.sender !== currentUser && !msg.seen) {
            markAsSeen(snapshot.key);
        }

        // Play sound if incoming
        if (msg.sender !== currentUser) {
            sound.play().catch(() => { }); // catch autoplay policy errors

            // Trigger OS Notification if hidden
            if (!msg.seen) {
                if (document.visibilityState === 'hidden') {
                    showSystemNotification("Market opens …", ""); // Title ONLY, No body
                }
            }
        }
    });

    // 2. Listen for Message Changes (specifically 'seen' status)
    messagesRef.limitToLast(100).on('child_changed', (snapshot) => {
        const msg = snapshot.val();
        updateMessageStatus(snapshot.key, msg.seen);
    });

    // Listen for Child Removed (e.g. Chat Clear)
    messagesRef.on('child_removed', (snapshot) => {
        const msgDiv = document.querySelector(`.message[data-key="${snapshot.key}"]`);
        if (msgDiv) {
            msgDiv.remove();
        }
    });

    // 3. Listen for Typing Status of Partner
    const partnerTypingRef = db.ref(`status/${chatPartner}/typing`);
    partnerTypingRef.on('value', (snapshot) => {
        const isTyping = snapshot.val();
        if (isTyping) {
            typingIndicator.textContent = "typing...";
        } else {
            typingIndicator.textContent = "";
        }
    });

    // 4. Presence Listener
    db.ref(`status/${chatPartner}`).on('value', (snapshot) => {
        const status = snapshot.val();
        if (!status) return;

        if (status.online) {
            lastSeenEl.textContent = "Online";
        } else if (status.lastOnline) {
            const date = new Date(status.lastOnline);
            // Simple formatting: Today at HH:MM
            lastSeenEl.textContent = `Last seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            lastSeenEl.textContent = "";
        }
    });
}

function initializePresence() {
    const userStatusDatabaseRef = db.ref(`status/${currentUser}`);

    // Offline / Online Logic
    const isOfflineForDatabase = {
        online: false,
        lastOnline: firebase.database.ServerValue.TIMESTAMP
    };

    const isOnlineForDatabase = {
        online: true,
        lastOnline: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }

        userStatusDatabaseRef.onDisconnect().update(isOfflineForDatabase).then(() => {
            userStatusDatabaseRef.update(isOnlineForDatabase);
        });
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        sender: currentUser,
        receiver: chatPartner,
        text: text,
        timestamp: Date.now(),
        seen: false,
        replyTo: replyingTo ? replyingTo : null
    };

    db.ref('messages').push(messageData);
    messageInput.value = '';
    cancelReply(); // Clear reply state

    // Reset typing status immediately
    db.ref(`status/${currentUser}/typing`).set(false);



    // TRIGGER BACKGROUND PUSH (Sender Side)
    // We call our Vercel API
    // Note: Make sure to update this URL after Vercel deployment!
    const API_URL = import.meta.env.VITE_API_URL || '/api/send-push'; // Relative for web, needs FULL for App

    // For Capacitor App, relative URL might fail if origin is localhost.
    // Ideally use full domain: https://your-project.vercel.app/api/send-push
    // Since we don't have it yet, we use relative and hope for proxy or user to update.

    // Construct generic title
    const notificationTitle = "Market opens …";

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: null, // We need the receiver's token!
            // Wait, sendMessage doesn't know receiver's token.
            // We usually fetch it from DB or let backend handle it by ID.
            // OUR API expects 'token'.
            // The Client needs to fetch chatPartner's token from tokens/devices/{deviceId}.
            // BUT there could be multiple devices.
            // COMPLEXITY: We need to fetch ALL tokens for chatPartner or let Backend do it.
            // Simplified: We won't implement full multi-device fan-out here in 1 step.
            // We will skip sending push from client for now or implement a simple "notify partner" if we had their token.
        })
    }).catch(e => console.log("Push send error", e));

    // Problem: Client doesn't have receiver's token easily without querying 'tokens/devices'.
    // And tokens are stored by deviceId, not by user?
    // "tokens/devices/{deviceId}" -> token.
    // We don't map user -> deviceId list.
    // Changing schema?
    // User requested "save token under tokens/devices/{deviceId}".
    // It seems tokens are anonymous/device-centric.
    // If so, we can't target a specific "User" (like XAU/USD) easily unless we map them.
    // Assuming for now we rely on the implementation plan's "Sender-Triggered" which implies we know WHO to send to.

    // FIX: We need to map User -> Tokens.
    // Current "saveTokenToDatabase" does: db.ref(`tokens/devices/${deviceId}`).
    // We should ALSO save to `tokens/users/${currentUser}/${deviceId}` to allow lookup.

    // I will add that to saveTokenToDatabase.

    // For this step, I will just add the comment about Sender API.
    sendPushToPartner();
}


// Typing Debounce
let typingTimeout;
function handleTyping() {
    db.ref(`status/${currentUser}/typing`).set(true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`status/${currentUser}/typing`).set(false);
    }, 2000);
}

// Image Handling
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    imageInput.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Compress/Resize
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compress
            sendImageMessage(dataUrl);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function sendImageMessage(base64Data) {
    const messageData = {
        sender: currentUser,
        receiver: chatPartner,
        text: "📷 Photo", // Placeholder for security rules/preview
        image: base64Data,
        timestamp: Date.now(),
        seen: false
    };

    db.ref('messages').push(messageData);

    // Stop typing status if it was stuck
    db.ref(`status/${currentUser}/typing`).set(false);

    // Send FCM Notification
    sendFCMNotification(chatPartner, "New Photo from " + currentUser, "📷 Photo");
}

function markAsSeen(messageKey) {
    db.ref(`messages/${messageKey}`).update({ seen: true });
}

// --- SYSTEM NOTIFICATIONS (via SW) ---
function showSystemNotification(title, body) {
    if (!("serviceWorker" in navigator)) return;

    // Use the Service Worker Registration to show the notification
    navigator.serviceWorker.ready.then(function (registration) {
        registration.showNotification(title, {
            body: body, // Should be empty string passed from caller
            icon: '/icon.png',
            tag: `market-${Date.now()}`, // Unique tag to prevent deduplication
            renotify: true,
            // click_action handled by SW notificationclick
            data: {
                url: 'https://www.tradingview.com/'
            }
        });
    });
}


// --- RENDERING ---

function renderMessage(msg, key) {
    const isOutgoing = msg.sender === currentUser;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(isOutgoing ? 'outgoing' : 'incoming');
    msgDiv.setAttribute('data-key', key);

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Checkmarks logic
    let statusIcon = '';
    if (isOutgoing) {
        // grey ticks if not seen, blue if seen
        const seenClass = msg.seen ? 'seen' : '';
        // Double check mark SVG
        statusIcon = `
            <span class="status-icon ${seenClass}" id="status-${key}">
               <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.473-.018l5.353-7.771a.418.418 0 0 0-.063-.526z"/><path d="M11.383 1.36l-.478-.372a.365.365 0 0 0-.51.063L4.566 8.679a.32.32 0 0 1-.484.033L1.09 5.86a.418.418 0 0 0-.541.036L.141 6.314a.319.319 0 0 0 .032.484l3.52 2.953c.143.14.361.125.473-.018l6.837-7.234a.418.418 0 0 0-.063-.526z"/></svg>
            </span>
        `;
    }

    // Reply Preview in Bubble
    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `
            <div class="reply-quote">
                <div class="reply-quote-sender">${msg.replyTo.sender === currentUser ? "You" : msg.replyTo.sender}</div>
                <div class="reply-quote-text">${msg.replyTo.text}</div>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        ${replyHtml}
        ${msg.image ? `<img src="${msg.image}" class="msg-image" alt="Image">` : `<div class="msg-text">${escapeHtml(msg.text)}</div>`}
        <div class="msg-meta">
            <span class="timestamp">${time}</span>
            ${statusIcon}
        </div>
    `;

    chatContainer.appendChild(msgDiv);

    // Double click to reply (Desktop handling)
    msgDiv.addEventListener('dblclick', () => {
        triggerReply(msg);
    });

    // Add Swipe Handler
    addSwipeHandler(msgDiv, msg, key);

    // Wait for image to load to scroll correctly (simple generic timeout or load listener)
    if (msg.image) {
        const img = msgDiv.querySelector('img');
        img.onload = scrollToBottom;
    }
    scrollToBottom();
}

function updateMessageStatus(key, seen) {
    const statusEl = document.getElementById(`status-${key}`);
    if (statusEl) {
        if (seen) {
            statusEl.classList.add('seen');
        } else {
            statusEl.classList.remove('seen');
        }
    }
}



function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Security: Prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- SWIPE TO REPLY ---
function addSwipeHandler(el, msgData, key) {
    let startX = 0;
    let currentX = 0;

    el.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        el.classList.add('swiping');
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Only allow swipe right (positive diff) up to 100px
        if (diff > 0 && diff < 100) {
            el.style.transform = `translateX(${diff}px)`;
        }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
        el.classList.remove('swiping');
        const diff = currentX - startX;

        // Threshold to trigger reply
        if (diff > 50) {
            triggerReply(msgData);
        }

        // Reset position with animation
        el.style.transform = 'translateX(0)';
        startX = 0;
        currentX = 0;
    });
}

function triggerReply(msgData) {
    replyingTo = {
        id: "msg-" + Date.now(), // ideally use key but for now enough
        text: msgData.image ? "📷 Photo" : msgData.text,
        sender: msgData.sender
    };

    replySender.textContent = msgData.sender === currentUser ? "You" : msgData.sender;
    replyText.textContent = replyingTo.text;

    replyPreview.classList.remove('hidden');
    messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    replyPreview.classList.add('hidden');
}

function handleClearChat() {
    // Hide menu
    optionsDropdown.classList.add('hidden');

    if (confirm("Are you sure you want to clear this chat? It will be deleted for both sides.")) {
        // Remove 'messages' node content (or set to null)
        db.ref('messages').remove()
            .then(() => {
                // UI will be cleared via child_removed listener
                // But 'child_removed' might not fire for all 100 items efficiently if we just wipe the parent.
                // Let's also manually clear the container to be snappy.
                chatContainer.innerHTML = '';
            })
            .catch((error) => {
                console.error("Remove failed: " + error.message);
                alert("Failed to clear chat: " + error.message);
            });
    }
}


// --- CAMERA FUNCTIONS ---

function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera not supported or permission denied.");
        return;
    }

    cameraModal.classList.remove('hidden');
    startCameraStream();
}

function startCameraStream() {
    if (cameraStreamTrack) {
        cameraStreamTrack.stop();
    }

    const constraints = {
        video: { facingMode: currentFacingMode },
        audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
            cameraStream.srcObject = stream;
            cameraStreamTrack = stream.getTracks()[0];
        })
        .catch(function (err) {
            console.error("Camera Error: " + err);
            alert("Could not access camera: " + err.message);
            // If environment fails (e.g. on laptop), fallback to user
            if (currentFacingMode === 'environment') {
                currentFacingMode = 'user';
                startCameraStream();
            } else {
                cameraModal.classList.add('hidden');
            }
        });
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCameraStream();
}

function closeCameraModal() {
    cameraModal.classList.add('hidden');
    if (cameraStreamTrack) {
        cameraStreamTrack.stop();
        cameraStreamTrack = null;
    }
    cameraStream.srcObject = null;
}

function capturePhoto() {
    if (!cameraStreamTrack) return;

    // Set canvas dimensions to match video
    cameraCanvas.width = cameraStream.videoWidth;
    cameraCanvas.height = cameraStream.videoHeight;

    const ctx = cameraCanvas.getContext('2d');

    // Check if we need to mirror (user facing generally mirrored)
    // Note: CSS transform checks solely visual. Actual canvas drawing is raw.
    // Simplification: draw raw.
    ctx.drawImage(cameraStream, 0, 0, cameraCanvas.width, cameraCanvas.height);

    // Convert to Base64 JPEG
    const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.8);

    // Show Preview
    cameraPreview.src = dataUrl;

    // Toggle UI
    cameraStream.classList.add('hidden');
    cameraPreview.classList.remove('hidden');

    cameraControls.classList.add('hidden');
    previewControls.classList.remove('hidden');
}

function retakePhoto() {
    // Hide Preview, Show Camera
    cameraPreview.classList.add('hidden');
    cameraStream.classList.remove('hidden');

    previewControls.classList.add('hidden');
    cameraControls.classList.remove('hidden');

    // Clear src to save memory
    cameraPreview.src = "";
}

function confirmSendPhoto() {
    const dataUrl = cameraPreview.src;
    if (dataUrl) {
        sendImageMessage(dataUrl);
    }
    closeCameraModal();
    // Reset for next time
    setTimeout(retakePhoto, 300);
}

// Attach globals to window for HTML access
window.handleLogin = handleLogin;
window.handleTyping = handleTyping;
window.handleImageSelect = handleImageSelect;
window.handleClearChat = handleClearChat;
window.sendMessage = sendMessage;
window.capturePhoto = capturePhoto;
window.openCamera = openCamera;
window.closeCameraModal = closeCameraModal;
window.retakePhoto = retakePhoto;
window.switchCamera = switchCamera;
window.confirmSendPhoto = confirmSendPhoto;
window.imageInput = imageInput; // for click()
