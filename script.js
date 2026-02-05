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

try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error("Firebase Init Error: Please replace firebaseConfig with actual values.");
}

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Motion } from '@capacitor/motion';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { initSearch } from './search.js';
import { createAuth } from './auth.js';
import { initMedia } from './media.js';
import { initNotifications } from './notifications.js';

if (Capacitor.isNativePlatform()) {
    import('@capacitor-community/privacy-screen').then(({ PrivacyScreen }) => {
        PrivacyScreen.enable().catch(() => { });
    }).catch(() => { });
}

const db = firebase.database();
const messaging = firebase.messaging();

const VAPID_KEY = "BJ0uCMTncHrN6Way3i8qoagoN71lcE7PrSNl6E2zUJv2Rv8x4WczsSjId7wUVT2qoPbfGbJQmcjmPVA1kiwsTEE";

// DOM elements
const loginScreen = document.getElementById('login-screen');
const userSelect = document.getElementById('username-select');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

const chatScreen = document.getElementById('chat-screen');
const chatHeaderName = document.getElementById('chat-with-name');
const typingIndicator = document.getElementById('typing-indicator');
const lastSeenEl = document.getElementById('last-seen');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const sound = document.getElementById('msg-sound');
const partnerBattery = document.getElementById('partner-battery');

const imageInput = document.getElementById('image-input');
const docInput = document.getElementById('doc-input');
const docBtn = document.getElementById('doc-btn');
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.getElementById('close-modal');
const replyPreview = document.getElementById('reply-preview');
const replySender = document.getElementById('reply-sender');
const replyText = document.getElementById('reply-text');
const closeReply = document.getElementById('close-reply');
const optionsBtn = document.getElementById('options-btn');
const optionsDropdown = document.getElementById('options-dropdown');
const clearChatBtn = document.getElementById('clear-chat-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPickerContainer = document.getElementById('emoji-picker-container');
const emojiPicker = document.querySelector('emoji-picker');
const appNotification = document.getElementById('app-notification');
const notificationMsg = document.getElementById('notification-msg');
const closeNotificationBtn = document.querySelector('.close-notification');

const searchBtn = document.getElementById('search-btn');
const searchBarContainer = document.getElementById('search-bar-container');
const searchInput = document.getElementById('search-input');
const searchBackBtn = document.getElementById('search-back-btn');
const searchClearBtn = document.getElementById('search-clear-btn');
const searchControls = document.getElementById('search-controls');
const searchCounter = document.getElementById('search-counter');
const searchUpBtn = document.getElementById('search-up-btn');
const searchDownBtn = document.getElementById('search-down-btn');
const chatHeader = document.getElementById('chat-header');
const headerDndIcon = document.getElementById('header-dnd-icon');
const dndModal = document.getElementById('dnd-confirm-modal');
const dndModalMessage = document.getElementById('dnd-modal-message');
const dndModalCancel = document.getElementById('dnd-modal-cancel');
const dndModalSend = document.getElementById('dnd-modal-send');
const ghostPreview = document.getElementById('ghost-preview');
const ghostText = document.getElementById('ghost-text');

// Camera / plus / drawing
const plusCameraBtn = document.getElementById('plus-camera-btn');
const plusBtn = document.getElementById('plus-btn');
const plusMenu = document.getElementById('plus-menu');
const plusDocBtn = document.getElementById('plus-doc-btn');
const plusGalleryBtn = document.getElementById('plus-gallery-btn');
const plusDrawingBtn = document.getElementById('plus-drawing-btn');
const plusSleepBtn = document.getElementById('plus-sleep-btn');
const plusSecretBtn = document.getElementById('plus-secret-btn');

const drawingModal = document.getElementById('drawing-modal');
const drawingCanvas = document.getElementById('drawing-canvas');
const closeDrawingBtn = document.getElementById('close-drawing');
const sendDrawingBtn = document.getElementById('send-drawing');
const clearDrawingBtn = document.getElementById('clear-drawing');
const colorSwatches = document.querySelectorAll('.color-swatch');

const cameraModal = document.getElementById('camera-modal');
const cameraStream = document.getElementById('camera-stream');
const cameraCanvas = document.getElementById('camera-canvas');
const closeCameraBtn = document.getElementById('close-camera');
const captureBtn = document.getElementById('capture-btn');
const switchCameraBtn = document.getElementById('switch-camera');
const cameraPreview = document.getElementById('camera-preview');
const cameraControls = document.getElementById('camera-controls');
const previewControls = document.getElementById('preview-controls');
const retakeBtn = document.getElementById('retake-btn');
const sendPhotoBtn = document.getElementById('send-photo-btn');

const panicBtn = document.getElementById('panic-btn');
const panicOverlay = document.getElementById('panic-overlay');

const PIN_CODE = "2009";
let currentUser = null;
let chatPartner = null;
let currentChatRef = null;
let replyingTo = null; // Object { id, text, sender }
const pendingKeys = new Set(); // Track messages being sent

const state = {
    get currentUser() {
        return currentUser;
    },
    set currentUser(val) {
        currentUser = val;
    },
    get chatPartner() {
        return chatPartner;
    },
    set chatPartner(val) {
        chatPartner = val;
    }
};

const ui = {
    loginScreen,
    userSelect,
    pinInput,
    loginError,
    chatScreen,
    chatHeaderName
};

// helpers that are passed into auth/media; some functions are defined later
const helpers = {
    scheduleScrollToBottom,
    initializeChat,
    initializePresence,
    activatePanicMode,
    renderMessage,
    updateMessageStatus,
    pendingKeys
};

// Notifications module
const { showSystemNotification } = initNotifications({
    appNotification,
    notificationMsg,
    closeNotificationBtn
});

// Auth module
const auth = createAuth({
    PIN_CODE,
    db,
    messaging,
    VAPID_KEY,
    ui,
    state,
    helpers
});

// Persistent notification setup using auth helper
const savedUser = localStorage.getItem('savedUser');
if (savedUser) {
    console.log("Restoring background notifications for:", savedUser);
    auth.setupPlatformPush(savedUser);
} else {
    auth.setupPlatformPush(null);
}

// Wire login button after auth is ready
loginBtn.addEventListener('click', auth.handleLogin);

// Initialize media (images, documents, camera, drawing)
const media = initMedia({
    db,
    state,
    elements: {
        imageInput,
        docInput,
        plusBtn,
        plusMenu,
        plusGalleryBtn,
        plusSecretBtn,
        plusDocBtn,
        plusCameraBtn,
        drawingModal,
        drawingCanvas,
        closeDrawingBtn,
        sendDrawingBtn,
        clearDrawingBtn,
        colorSwatches,
        cameraModal,
        cameraStream,
        cameraCanvas,
        closeCameraBtn,
        captureBtn,
        switchCameraBtn,
        cameraPreview,
        cameraControls,
        previewControls,
        sendPhotoBtn
    },
    helpers,
    dndHelper: { checkPartnerDndAndSend },
    pushHelper: { sendPushToPartner: auth.sendPushToPartner }
});

sendBtn.addEventListener('click', sendMessage);

// DND Modal handlers
let pendingDndSendCallback = null;
if (dndModalCancel) {
    dndModalCancel.addEventListener('click', () => {
        dndModal.classList.add('hidden');
        pendingDndSendCallback = null;
    });
}
if (dndModalSend) {
    dndModalSend.addEventListener('click', () => {
        if (pendingDndSendCallback) {
            pendingDndSendCallback({ highPriority: true });
            pendingDndSendCallback = null;
        }
        dndModal.classList.add('hidden');
    });
}
if (dndModal) {
    dndModal.addEventListener('click', (e) => {
        if (e.target === dndModal) {
            dndModal.classList.add('hidden');
            pendingDndSendCallback = null;
        }
    });
}
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', handleTyping);

// Sleep Mode (DND) toggle
if (plusSleepBtn) {
    plusSleepBtn.addEventListener('click', () => {
        if (!currentUser) return;
        const dndRef = db.ref(`status/${currentUser}/dnd`);
        dndRef.once('value').then((snapshot) => {
            const currentDnd = snapshot.val() === true;
            dndRef.set(!currentDnd);
            plusMenu.classList.add('hidden');
            plusBtn.classList.remove('active');
        });
    });
}

function lockApp() {
    if (!chatScreen.classList.contains('hidden')) {
        console.log("App Backgrounded: Auto-Locking...");

        chatScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        pinInput.value = '';
        console.log("Session locked. Re-entry required.");
    }
}

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

optionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsDropdown.classList.toggle('hidden');
    emojiPickerContainer.classList.add('hidden'); // Close emoji picker if open
});

document.addEventListener('click', (e) => {
    if (!optionsBtn.contains(e.target) && !optionsDropdown.contains(e.target)) {
        optionsDropdown.classList.add('hidden');
    }

    if (!emojiBtn.contains(e.target) && !emojiPickerContainer.contains(e.target)) {
        emojiPickerContainer.classList.add('hidden');
    }
});

clearChatBtn.addEventListener('click', handleClearChat);

emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPickerContainer.classList.toggle('hidden');
    optionsDropdown.classList.add('hidden'); // Close options if open
});

emojiPicker.addEventListener('emoji-click', (e) => {
    messageInput.value += e.detail.unicode;
    messageInput.focus();
});

initSearch({
    searchBtn,
    searchBarContainer,
    searchInput,
    searchBackBtn,
    searchClearBtn,
    searchControls,
    searchCounter,
    searchUpBtn,
    searchDownBtn,
    chatContainer
});


// Panic Mode
panicBtn.addEventListener('click', activatePanicMode);

window.downloadFile = (dataUrl, fileName) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

const DURESS_PIN = "0000";

function handleLogin() {
    const user = userSelect.value;
    const pin = pinInput.value;

    if (!user) {
        showError("Please select an exchange.");
        return;
    }

    // DURESS CHECK
    if (pin === DURESS_PIN) {
        // 1. Trigger Panic Logic
        activatePanicMode();

        // 2. Hide Login Screen explicitely (Panic Mode handles Chat Screen)
        loginScreen.classList.add('hidden');

        // 3. Clear inputs to look reset
        pinInput.value = '';
        userSelect.value = '';

        return;
    }

    if (pin !== PIN_CODE) {
        incorrectPinAttempts++;
        if (incorrectPinAttempts >= 3) {
            triggerIntruderCapture(pin);
            incorrectPinAttempts = 0;
        }
        showError("Invalid access code.");
        return;
    }

    incorrectPinAttempts = 0;
    // Success
    currentUser = user;
    chatPartner = currentUser === 'XAU/USD' ? 'BTC/USD' : 'XAU/USD';

    // Switch UI
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    // Setup Chat
    chatHeaderName.textContent = chatPartner;

    initializeChat();
    initializePresence();

    // Scroll to newest messages after login (multiple attempts for async Firebase load)
    scheduleScrollToBottom([0, 100, 400, 800, 1200]);

    // Persist user for next launch
    localStorage.setItem('savedUser', currentUser);

    // Explicitly re-register to link user to token
    setupPlatformPush(currentUser);
}

async function sendPushToPartner() {
    if (!chatPartner) return;

    // 1. Get tokens for partner
    const snapshot = await db.ref(`tokens/users/${chatPartner}`).once('value');
    if (!snapshot.exists()) return;

    const tokensMap = snapshot.val();
    const tokens = Object.values(tokensMap);

    // 2. Send to all
    const API_URL = import.meta.env.VITE_API_URL || '/api/send-push';
    console.log(`[Push] Sending to ${tokens.length} devices via ${API_URL}`);

    tokens.forEach(token => {
        fetch(API_URL, { // Update URL in production
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                title: "Market opens …",
                body: " "
            })
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => console.log("[Push] Success:", data))
            .catch(err => console.error("[Push] API Error:", err));
    });
}

function showError(msg) {
    loginError.textContent = msg;
    setTimeout(() => loginError.textContent = '', 3000);
}

/**
 * Intruder Selfie: After 3 wrong PINs, silently capture camera frame (if permission already granted)
 * and upload to Firebase security_logs. Does not prompt for permission.
 */
async function triggerIntruderCapture(pinEntered) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    // Only proceed if camera permission is already granted (avoid revealing trap via prompt)
    // Permissions API has poor support on iOS/mobile WebViews; on native, try getUserMedia directly
    if (!Capacitor.isNativePlatform()) {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const perm = await navigator.permissions.query({ name: 'camera' });
                if (perm.state !== 'granted') return;
            }
        } catch (_) {
            return;
        }
    }

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    Object.assign(video.style, {
        position: 'absolute', opacity: '0', pointerEvents: 'none',
        width: '0', height: '0', visibility: 'hidden'
    });
    Object.assign(canvas.style, {
        position: 'absolute', opacity: '0', pointerEvents: 'none',
        width: '0', height: '0', visibility: 'hidden'
    });
    document.body.appendChild(video);
    document.body.appendChild(canvas);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
        });
        video.srcObject = stream;

        // Must play before we can capture frames (required on mobile WebViews)
        await video.play();

        // Wait for video to have valid dimensions and frames
        await new Promise((resolve) => {
            const onReady = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    resolve();
                }
            };
            video.addEventListener('loadeddata', onReady, { once: true });
            video.addEventListener('playing', onReady, { once: true });
            setTimeout(resolve, 800);
        });

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        if (w === 0 || h === 0) return;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);

        stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;

        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        const key = Date.now() + '_intruder';
        await db.ref('security_logs/' + key).set({
            timestamp: Date.now(),
            pinEntered: String(pinEntered),
            imageBase64: base64
        });

        // Save to device gallery on mobile (Photos/Camera Roll)
        if (Capacitor.isNativePlatform()) {
            try {
                const { Media } = await import('@capacitor-community/media');
                await Media.savePhoto({ path: base64, fileName: `intruder_${key}` });
            } catch (_) {
                // Silently fail - permission denied or plugin issue
            }
        }
    } catch (_) {
        // Silently fail - permission denied, no camera, etc.
    } finally {
        document.body.removeChild(video);
        document.body.removeChild(canvas);
    }
}

function initializeChat() {
    const messagesRef = db.ref('messages');

    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        renderMessage(msg, snapshot.key);

        if (msg.sender !== currentUser && !msg.seen) {
            markAsSeen(snapshot.key);
        }

        if (msg.sender !== currentUser) {
            sound.play().catch(() => { });

            if (!msg.seen) {
                if (document.visibilityState === 'hidden') {
                    showSystemNotification("Market opens …", ""); // Title ONLY, No body
                }
            }
        }
    });

    messagesRef.limitToLast(100).on('child_changed', (snapshot) => {
        const msg = snapshot.val();
        const key = snapshot.key;

        const existingMsg = document.getElementById('msg-' + key);
        if (existingMsg) {
            if (existingMsg.classList.contains('pending')) {
                existingMsg.classList.remove('pending');
                const timeEl = existingMsg.querySelector('.timestamp');
                const date = new Date(msg.timestamp);
                const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (timeEl) timeEl.textContent = time;
                const imgLoading = existingMsg.querySelector('.img-loading-overlay');
                if (imgLoading) imgLoading.remove();
                const secretSpinner = existingMsg.querySelector('.secret-bubble .spinner');
                if (secretSpinner) secretSpinner.remove();
                const docSpinner = existingMsg.querySelector('.doc-loading-spinner');
                if (docSpinner) docSpinner.remove();
                // Update status icon to double-check (sent)
                const statusIconEl = existingMsg.querySelector('.status-icon');
                if (statusIconEl) {
                    statusIconEl.classList.remove('pending-icon');
                    statusIconEl.classList.add(msg.seen ? 'seen' : '');
                    statusIconEl.innerHTML = `<svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033L4.023 6.045a.364.364 0 0 0-.513.041l-.383.432a.364.364 0 0 0 .046.513l4.743 4.31a.318.318 0 0 0 .484-.033l6.59-8.498a.363.363 0 0 0-.063-.51l.083.016z"/><path d="M11.383 1.36l-.478-.372a.365.365 0 0 0-.51.063L4.566 8.679a.32.32 0 0 1-.484.033L1.09 5.86a.418.418 0 0 0-.541.036L.141 6.314a.319.319 0 0 0 .032.484l3.52 2.953c.143.14.361.125.473-.018l6.837-7.234a.418.418 0 0 0-.063-.526z"/></svg>`;
                }
                return;
            }
        }

        // 1. Check for Deletion Update
        if (msg.deleted) {
            const msgDiv = document.getElementById('msg-' + snapshot.key);
            if (msgDiv) {
                // Update content to "Deleted" style
                const textNode = msgDiv.querySelector('.msg-text');
                if (textNode) {
                    textNode.textContent = "🚫 This message was deleted";
                    textNode.className = "msg-text deleted-msg";
                    textNode.setAttribute('data-original', "This message was deleted"); // Update search cache
                }

                // Remove Images/Documents/Game if they exist
                const img = msgDiv.querySelector('.msg-image');
                if (img) img.remove();

                const doc = msgDiv.querySelector('.document-bubble');
                if (doc) doc.remove();

                const reactions = msgDiv.querySelector('.msg-reactions');
                if (reactions) reactions.remove(); // Also remove reactions

                // Remove interaction listeners (context menu / touch) to prevent deleting again
                const newClone = msgDiv.cloneNode(true);
                msgDiv.parentNode.replaceChild(newClone, msgDiv);

                // Re-attach basic swipe (optional, but deleted messages usually rely-able?)
                // Actually if we cloneNode, we lose swipe listeners. That's good.
                // We might want to re-attach basic timestamp logic? No, its static.
            }
        } else {
            // 3. Update Reactions (Only if not deleted)
            updateMessageReactions(snapshot.key, msg.reactions);
        }

        // 2. Update Status (Seen/Delivered) (Always update this)
        // Only update status if it's not currently pending (i.e., the set() promise hasn't resolved yet)
        if (!pendingKeys.has(snapshot.key)) {
            updateMessageStatus(snapshot.key, msg.seen);
        }
    });

    messagesRef.on('child_removed', (snapshot) => {
        const msgDiv = document.getElementById('msg-' + snapshot.key);
        if (msgDiv) {
            msgDiv.remove();
        }
    });

    // 3. Listen for Typing Status & Ghost Text of Partner
    const partnerStatusRef = db.ref(`status/${chatPartner}`);
    partnerStatusRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Typing Indicator
        if (data.typing) {
            typingIndicator.textContent = "Signal incoming...";
        } else {
            typingIndicator.textContent = "";
        }

        // Ghost Text (Draft)
        if (data.draft && data.draft.trim() !== "") {
            ghostText.textContent = data.draft;
            ghostPreview.classList.remove('hidden');
        } else {
            ghostPreview.classList.add('hidden');
            ghostText.textContent = "";
        }

        // Battery Status
        if (data.battery) {
            const { level, isCharging } = data.battery;
            partnerBattery.classList.remove('hidden');
            // Round to integer
            const pct = Math.round(level);

            // Content: Icon + Text
            // Bolt icon if charging
            const icon = isCharging ? '⚡' : (pct < 20 ? '🪫' : '🔋');
            partnerBattery.textContent = `${icon} ${pct}%`;

            // Styling
            partnerBattery.classList.toggle('charging', isCharging);
            partnerBattery.classList.toggle('low', !isCharging && pct < 20);
        } else {
            partnerBattery.classList.add('hidden');
        }
    });

    // 4. Presence Listener
    db.ref(`status/${chatPartner}`).on('value', (snapshot) => {
        const status = snapshot.val();
        if (!status) return;

        if (status.online) {
            lastSeenEl.textContent = "Live";
        } else if (status.lastOnline) {
            const date = new Date(status.lastOnline);
            lastSeenEl.textContent = `Closed ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            lastSeenEl.textContent = "";
        }
    });
}

function initializePresence() {
    const userStatusDatabaseRef = db.ref(`status/${currentUser}`);

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

    userStatusDatabaseRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const dnd = data && data.dnd === true;
        updateDndUI(dnd);
    });
}

function updateDndUI(dnd) {
    if (!chatHeader || !headerDndIcon) return;
    if (dnd) {
        chatHeader.classList.add('sleep-mode');
        headerDndIcon.classList.remove('hidden');
        if (plusSleepBtn) plusSleepBtn.classList.add('active');
    } else {
        chatHeader.classList.remove('sleep-mode');
        headerDndIcon.classList.add('hidden');
        if (plusSleepBtn) plusSleepBtn.classList.remove('active');
    }
}

function getPartnerDisplayName() {
    return chatPartner ? (chatPartner.charAt(0).toUpperCase() + chatPartner.slice(1)) : 'Partner';
}

function checkPartnerDndAndSend(sendFn) {
    if (!chatPartner) {
        sendFn({ highPriority: false });
        return;
    }
    db.ref(`status/${chatPartner}/dnd`).once('value').then((snapshot) => {
        const partnerDnd = snapshot.val() === true;
        if (!partnerDnd) {
            sendFn({ highPriority: false });
            return;
        }
        // Partner is in DND - show confirmation modal
        const partnerName = getPartnerDisplayName();
        if (dndModalMessage) dndModalMessage.textContent = `${partnerName} is in Do Not Disturb. Send signal anyway?`;
        pendingDndSendCallback = () => sendFn({ highPriority: true });
        if (dndModal) dndModal.classList.remove('hidden');
    }).catch(() => {
        sendFn({ highPriority: false });
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    checkPartnerDndAndSend((opts) => doSendMessage(text, opts));
}

function doSendMessage(text, opts = {}) {
    const messageData = {
        sender: currentUser,
        receiver: chatPartner,
        text: text,
        timestamp: Date.now(),
        seen: false,
        replyTo: replyingTo ? replyingTo : null,
        highPriority: opts.highPriority || false
    };

    db.ref('messages').push(messageData);

    // Scroll to show sent message (child_added fires async)
    scheduleScrollToBottom([150, 400]);

    messageInput.value = '';

    replyingTo = null;
    replyPreview.classList.add('hidden');

    db.ref(`status/${currentUser}/typing`).set(false);
    db.ref(`status/${currentUser}/draft`).set(null);

    setTimeout(() => messageInput.focus(), 50);

    auth.sendPushToPartner();
}

// Typing Handler (Throttled)
let typingTimeout;
let draftTimeout;

function handleTyping() {
    db.ref(`status/${currentUser}/typing`).set(true);

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`status/${currentUser}/typing`).set(false);
    }, 2000);

    if (draftTimeout) return;

    draftTimeout = setTimeout(() => {
        const text = messageInput.value;
        db.ref(`status/${currentUser}/draft`).set(text);
        draftTimeout = null;
    }, 150);
}

function markAsSeen(messageKey) {
    db.ref(`messages/${messageKey}`).update({ seen: true });
}
// --- RENDERING ---

function renderMessage(msg, key) {
    const isOutgoing = msg.sender === currentUser;

    let msgDiv = document.getElementById('msg-' + key);
    const isUpdate = !!msgDiv;

    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'msg-' + key;
        msgDiv.classList.add('message');
        msgDiv.classList.add(isOutgoing ? 'outgoing' : 'incoming');
        msgDiv.setAttribute('data-key', key);
    }
    if (pendingKeys.has(key)) {
        msgDiv.classList.add('pending');
    } else {
        msgDiv.classList.remove('pending');
    }

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Determine Status Icon
    let statusIcon = '';
    if (msg.sender === currentUser) {
        if (pendingKeys.has(key)) {
            // CLOCK ICON (Pending)
            statusIcon = `<span id="status-${key}" class="status-icon pending-icon">🕒</span>`;
        } else {
            // DOUBLE TICKS (Black for Sent, Blue for Seen)
            // We use the same SVG for both, CSS handles the color via 'seen' class
            const seenClass = msg.seen ? 'seen' : '';
            statusIcon = `<span id="status-${key}" class="status-icon ${seenClass}">
                <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
                    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033L4.023 6.045a.364.364 0 0 0-.513.041l-.383.432a.364.364 0 0 0 .046.513l4.743 4.31a.318.318 0 0 0 .484-.033l6.59-8.498a.363.363 0 0 0-.063-.51l.083.016z"/>
                    <path d="M11.383 1.36l-.478-.372a.365.365 0 0 0-.51.063L4.566 8.679a.32.32 0 0 1-.484.033L1.09 5.86a.418.418 0 0 0-.541.036L.141 6.314a.319.319 0 0 0 .032.484l3.52 2.953c.143.14.361.125.473-.018l6.837-7.234a.418.418 0 0 0-.063-.526z"/>
                </svg>
            </span>`;
        }
    }

    // Reply Preview in Bubble
    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `
            <div class="reply-quote" data-reply-id="${msg.replyTo.id}">
                <div class="reply-quote-sender">${msg.replyTo.sender === currentUser ? "You" : msg.replyTo.sender}</div>
                <div class="reply-quote-text">${msg.replyTo.text}</div>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        ${replyHtml}
        ${(() => {
            if (msg.deleted) {
                return `<div class="msg-text deleted-msg">🚫 This message was deleted</div>`;
            }

            if (msg.file) {
                const isPending = pendingKeys.has(key);
                const ext = (msg.file.name && msg.file.name.includes('.')) ? msg.file.name.split('.').pop().toUpperCase() : 'FILE';
                const sizeKb = msg.file.size / 1024;
                const sizeStr = sizeKb >= 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb.toFixed(1) + ' KB';
                return `
                <div class="document-bubble" onclick="downloadFile('${msg.file.data}', '${msg.file.name}')">
                    <div class="doc-icon">${escapeHtml(ext)}</div>
                    <div class="doc-info">
                        <span class="doc-name">${escapeHtml(msg.file.name)}</span>
                        <span class="doc-meta">${sizeStr} • ${escapeHtml(ext)}</span>
                    </div>
                    ${isPending ? '<div class="doc-loading-spinner" style="margin-left: 5px;">⏳</div>' :
                        `<div class="doc-download">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
                        </svg>
                    </div>`
                    }
                </div>`;

            } else if (msg.image) {
                const isPending = pendingKeys.has(key);

                // SECRET PHOTO HANDLING
                if (msg.isSecret) {
                    return `
                        <div class="secret-bubble" onclick="viewSecretPhoto('${key}', '${msg.image}')">
                            <div class="secret-icon">🔥</div>
                            <div class="secret-text">Secret Photo</div>
                            ${isPending ? '<div class="spinner" style="width:15px; height:15px; margin-left:10px;"></div>' : ''}
                        </div>
                    `;
                }

                // Standard Image
                return `
                <div style="position:relative; display:inline-block;">
                    <img src="${msg.image}" class="msg-image" alt="Image">
                    ${isPending ? '<div class="img-loading-overlay"><div class="spinner"></div></div>' : ''}
                </div>
                `;
            } else {
                return `<div class="msg-text">${escapeHtml(msg.text)}</div>`;
            }
        })()}
        <div class="msg-meta">
            <span class="timestamp">${time}</span>
            ${statusIcon}
        </div>
        <!-- Reactions Container -->
        <div class="msg-reactions ${!msg.reactions ? 'hidden' : ''}" id="reactions-${key}">
            ${msg.reactions ? '❤️' + (Object.keys(msg.reactions).length > 1 ? ' ' + Object.keys(msg.reactions).length : '') : ''}
        </div>
    `;

    if (!isUpdate) {
        const wasAtBottom = isAtBottom();
        chatContainer.appendChild(msgDiv);
        updateBubbleGrouping();
        if (wasAtBottom) scrollToBottom(true);
    }

    // Save initial text for search
    const textNode = msgDiv.querySelector('.msg-text');
    if (textNode) {
        textNode.setAttribute('data-original', msg.deleted ? "This message was deleted" : msg.text);
    }

    // Only add interactive listeners when message is first rendered (prevents duplicate alerts)
    const isMobile = Capacitor.isNativePlatform();

    if (!isUpdate) {
        // --- MOBILE: Swipe = Reply, Double-tap = Like, Long-press = Delete ---
        if (isMobile) {
            if (!msg.deleted) addSwipeHandler(msgDiv, msg, key);
            addMobileDoubleTapLike(msgDiv, key, () => msg.reactions);
            if (!msg.deleted && msg.sender === currentUser) addMobileLongPressDelete(msgDiv, key, msg.timestamp);
        } else {
            // --- WEB: Dblclick = Reply, Triple-click = Like, Contextmenu = Delete ---
            msgDiv.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!msg.deleted) triggerReply(msg, key);
            });
            msgDiv.addEventListener('click', (e) => {
                if (e.detail === 3) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!msg.deleted) {
                        toggleReaction(key, msg.reactions);
                        cancelReply();
                    }
                }
            });
            if (!msg.deleted) addSwipeHandler(msgDiv, msg, key);
            if (!msg.deleted && msg.sender === currentUser) {
                const DELETE_WINDOW_MS = 10 * 60 * 1000;
                msgDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const timeSinceSent = Date.now() - msg.timestamp;
                    if (timeSinceSent > DELETE_WINDOW_MS) {
                        alert("You can only delete messages within 10 minutes of sending.");
                        return;
                    }
                    if (confirm("Delete this message for everyone?")) deleteMessage(key);
                });
            }
        }
    }

    if (msg.image && !msg.deleted) {
        const img = msgDiv.querySelector('img');
        if (img) img.onload = () => { if (isAtBottom()) scrollToBottom(true); };
    }

    // Click to Scroll on Reply
    if (msg.replyTo) {
        const replyQuote = msgDiv.querySelector('.reply-quote');
        replyQuote.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            const targetId = msg.replyTo.id;
            const targetEl = document.getElementById('msg-' + targetId);

            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.classList.add('highlight-message');
                setTimeout(() => {
                    targetEl.classList.remove('highlight-message');
                }, 1000);
            }
        });
    }
}

function activatePanicMode() {
    // 1. NUCLEAR WIPE - No Confirmation per User Request
    console.log("INITIATING PANIC PROTOCOL");

    // Wipe Database
    db.ref('messages').set(null).then(() => {
        console.log("Database Wiped.");
    });

    // Remove all listeners to stop incoming updates
    db.ref('messages').off();

    // 2. VISUAL LOCKOUT
    panicOverlay.classList.remove('hidden');

    // Clear DOM immediately
    chatContainer.innerHTML = '';
    document.getElementById('chat-screen').classList.add('hidden');

    // Change Title
    document.title = "BTC/USD Chart";

    // 3. HARDWARE HANDLING (Mobile)
    if (Capacitor.isNativePlatform()) {
        // Close Keyboard
        Keyboard.hide().catch(console.error);

        // Match StatusBar to Dark Theme
        StatusBar.setStyle({ style: Style.Dark }).catch(console.error);
        StatusBar.setBackgroundColor({ color: '#131722' }).catch(console.error);
    }

    // Haptic Feedback if valid
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// -------------------------
// DRAWING BOARD LOGIC MOVED TO media.js
// -------------------------

// ------------------
// BATTERY STATUS
// ------------------
function setupBatteryStatus() {
    // Determine platform
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
        // Use Capacitor Device Plugin
        // We can poll? Or is there a listener? 
        // @capacitor/device usually doesn't emit events for battery easily without polling or specific plugin versions.
        // Actually, HTML5 Battery API might work in WebView on Android? 
        // Let's try HTML5 first, fallback to polling Device.getBatteryInfo if needed.
        // But for this demo, let's stick to standard navigator.getBattery() which works on Android WebViews usually.

    }

    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            updateBattery(battery);

            battery.addEventListener('levelchange', () => updateBattery(battery));
            battery.addEventListener('chargingchange', () => updateBattery(battery));
        });
    }
}

let lastBatteryLevel = -1;
let lastChargingState = null;

function updateBattery(battery) {
    console.log("Battery Update Triggered", battery.level, battery.charging);
    const level = battery.level * 100;
    const isCharging = battery.charging;

    // Throttle: Only update if level changes by >= 1% or charging state changes
    if (Math.abs(level - lastBatteryLevel) >= 1 || isCharging !== lastChargingState) {
        lastBatteryLevel = level;
        lastChargingState = isCharging;

        console.log("Pushing Battery Update to DB:", level, isCharging);
        db.ref(`status/${currentUser}/battery`).set({
            level: level,
            isCharging: isCharging,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).catch(e => console.error("Battery DB Error", e));
    }
}

// ------------------
// HARDWARE TRIGGER (SHAKE)
// ------------------
let lastX = 0, lastY = 0, lastZ = 0;
// Threshold: ~15-20 is moderate, 30+ is violent. 
// Standard gravity is ~9.8. We need significantly more than just tilting.
const SHAKE_THRESHOLD = 40;
let lastShakeTime = 0;

async function setupShakeDetection() {
    try {
        // We use acceleration (without gravity) if available as it isolates user movement
        await Motion.addListener('accel', event => {
            const { x, y, z } = event.acceleration;

            // Some devices might return null/undefined for 'acceleration', fallback to 'accelerationIncludingGravity'
            // But 'acceleration' is best for shake.
            if (x === null) return;

            // Calculate magnitude of change (simple manhattan distance or magnitude)
            // Using magnitude of vector: sqrt(x^2 + y^2 + z^2) is total force.
            // But we want 'change' detection or just raw force detection?
            // "Violent" means high acceleration.

            const totalAccel = Math.abs(x) + Math.abs(y) + Math.abs(z);

            if (totalAccel > SHAKE_THRESHOLD) {
                const now = Date.now();
                if (now - lastShakeTime > 1000) { // 1 sec cooldown
                    console.log("Violent Shake Detected! Magnitude:", totalAccel);
                    lastShakeTime = now;

                    // Only trigger if logged in
                    if (!chatScreen.classList.contains('hidden')) {
                        activatePanicMode();
                    }
                }
            }
        });
        console.log("Shake detection armed.");
    } catch (e) {
        console.error("Shake Support Error:", e);
    }
}

// Initialize Shake Detection
setupShakeDetection();

// Initialize Battery Status
setupBatteryStatus();

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



function isAtBottom(threshold = 80) {
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    return scrollHeight - scrollTop - clientHeight <= threshold;
}

function scrollToBottom(smooth = true) {
    // Double rAF ensures layout has run (new messages measured) before scrolling
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const top = chatContainer.scrollHeight - chatContainer.clientHeight;
            if (smooth) {
                chatContainer.scrollTo({ top, behavior: 'smooth' });
            } else {
                chatContainer.scrollTop = top;
            }
        });
    });
}

function scheduleScrollToBottom(delays = [0, 150, 400, 800]) {
    delays.forEach((ms) => {
        if (ms === 0) {
            scrollToBottom(false);
        } else {
            setTimeout(() => scrollToBottom(ms < 300 ? false : true), ms);
        }
    });
}

function updateBubbleGrouping() {
    const messages = Array.from(chatContainer.querySelectorAll('.message'));
    messages.forEach((el, i) => {
        el.classList.remove('group-start', 'group-mid', 'group-end');
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const isOutgoing = el.classList.contains('outgoing');
        const prevSame = prev && prev.classList.contains(isOutgoing ? 'outgoing' : 'incoming');
        const nextSame = next && next.classList.contains(isOutgoing ? 'outgoing' : 'incoming');
        if (!prevSame) el.classList.add('group-start');
        if (!nextSame) el.classList.add('group-end');
        if (prevSame && nextSame) el.classList.add('group-mid');
    });
}

// Security: Prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- MOBILE: Double-tap to LIKE (only on native) ---
function addMobileDoubleTapLike(el, key, getReactions) {
    let lastTap = 0;
    const DOUBLE_TAP_MS = 400;

    el.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < DOUBLE_TAP_MS) {
            lastTap = 0;
            e.preventDefault();
            toggleReaction(key, getReactions ? getReactions() : null);
            cancelReply();
        } else {
            lastTap = now;
        }
    }, { passive: false });
}

// --- MOBILE: Long-press to DELETE (only on native) ---
function addMobileLongPressDelete(el, key, timestamp) {
    const DELETE_WINDOW_MS = 10 * 60 * 1000;
    let pressTimer;

    el.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            const timeSinceSent = Date.now() - timestamp;
            if (timeSinceSent > DELETE_WINDOW_MS) {
                alert("You can only delete messages within 10 minutes of sending.");
                return;
            }
            if (confirm("Delete this message for everyone?")) deleteMessage(key);
        }, 800);
    }, { passive: true });

    el.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
    el.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
}

// --- SWIPE TO REPLY (1:1 finger movement, elastic snap-back) ---
function addSwipeHandler(el, msgData, key) {
    let startX = 0;
    let currentX = 0;

    el.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX;
        el.classList.add('swiping');
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        // 1:1 movement; only allow swipe right up to 120px
        const clamped = Math.max(0, Math.min(diff, 120));
        el.style.transform = `translate3d(${clamped}px, 0, 0)`;
    }, { passive: true });

    el.addEventListener('touchend', () => {
        const diff = currentX - startX;
        el.classList.remove('swiping');
        if (diff > 50) triggerReply(msgData, key);
        el.style.transform = 'translate3d(0, 0, 0)';
        startX = 0;
        currentX = 0;
    });
}

function triggerReply(msgData, key) {
    replyingTo = {
        id: key, // Use actual Firebase key
        text: msgData.image ? "📷 Photo" : msgData.text,
        sender: msgData.sender
    };

    replySender.textContent = msgData.sender === currentUser ? "You" : msgData.sender;
    replyText.textContent = replyingTo.text;

    replyPreview.classList.remove('hidden');
    messageInput.focus();
}

function deleteMessage(key) {
    db.ref(`messages/${key}`).update({
        deleted: true,
        text: "🚫 This message was deleted",
        image: null,
        file: null
    }).then(() => {
        console.log("Message deleted successfully.");
    }).catch(err => {
        console.error("Error deleting message:", err);
    });
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


// --- CAMERA FUNCTIONS MOVED TO media.js ---

// Attach globals to window for HTML access (auth / typing / messaging)
window.handleTyping = handleTyping;
window.handleClearChat = handleClearChat;
window.sendMessage = sendMessage;

// ---------------------------
// VIEW SECRET PHOTO LOGIC
// ---------------------------
window.viewSecretPhoto = (key, url) => {
    // 1. Show the image modal
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    if (!modal || !modalImg) return;

    modalImg.src = url;
    modalImg.src = url;
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Force display flex (centered)

    // 2. Add Timer Overlay if not exists
    let timerOverlay = document.getElementById('secret-timer-overlay');
    if (!timerOverlay) {
        timerOverlay = document.createElement('div');
        timerOverlay.id = 'secret-timer-overlay';
        timerOverlay.style.cssText = `
            position: absolute; top: 20px; right: 20px; 
            background: rgba(0,0,0,0.7); color: #ff5252; 
            font-size: 24px; font-weight: bold; 
            padding: 10px 20px; border-radius: 30px;
            pointer-events: none; z-index: 1010;
        `;
        modal.appendChild(timerOverlay);
    }

    // 3. Start Countdown
    let timeLeft = 10;
    timerOverlay.textContent = `🔥 ${timeLeft}s`;

    const interval = setInterval(() => {
        timeLeft--;
        timerOverlay.textContent = `🔥 ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            // Close Modal
            modal.classList.add('hidden');
            timerOverlay.remove();
            modalImg.src = "";

            // 4. DESTROY MESSAGE
            console.log("Self-destructing message:", key);
            db.ref('messages/' + key).remove();
        }
    }, 1000);

    // Handle manual close before timer ends (User closed it early)
    // We should probably destroy it anyway if they saw it? 
    // Snapchat style: if you view it, it's gone regardless.
    // Let's attach a "once" listener to close-modal or click-outside.
    const closeHandler = () => {
        clearInterval(interval);
        // Destroy it anyway
        db.ref('messages/' + key).remove();
        if (timerOverlay) timerOverlay.remove();
        modal.removeEventListener('click', closeHandler);
    };

    // Simple close on click (Modal usually closes on click)
    // We hook into the existing 'click' on modal, but we need our own
    // or we assume user clicks the 'X' or outside. 
    // Actually our modal setup onclick just hides it.
    // Let's add a specialized listener.
    modal.onclick = (e) => {
        if (e.target === modal || e.target.id === 'close-modal') {
            closeHandler();
            modal.classList.add('hidden'); // Ensure closes
        }
    };
};
window.retakePhoto = retakePhoto;
window.switchCamera = switchCamera;
window.confirmSendPhoto = function () {
    // 1. UI FIRST: Close immediately
    window.closeCameraModal();

    // 2. Logic Later
    const dataUrl = cameraPreview.src;
    if (dataUrl) {
        sendImageMessage(dataUrl);
    }

    // 3. Reset Preview
    setTimeout(retakePhoto, 300);
};
window.imageInput = imageInput; // for click()
// ------------------
// REACTIONS
// ------------------
function toggleReaction(key, ignoredStaleReactions) {
    // Use transaction to atomically toggle status based on REAL latest value
    const userReactionRef = db.ref(`messages/${key}/reactions/${currentUser}`);

    userReactionRef.transaction((currentValue) => {
        if (currentValue) {
            return null; // Delete (Unlike)
        } else {
            return "❤️"; // Set (Like)
        }
    });
}

function updateMessageReactions(key, reactions) {
    const reactionEl = document.getElementById(`reactions-${key}`);
    if (reactionEl) {
        if (reactions) {
            const count = Object.keys(reactions).length;
            reactionEl.textContent = "❤️" + (count > 1 ? " " + count : "");
            reactionEl.classList.remove('hidden');
        } else {
            reactionEl.textContent = "";
            reactionEl.classList.add('hidden');
        }
    }
}
