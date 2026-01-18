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

const db = firebase.database();

// --- STATE ---
const PIN_CODE = "14082004"; // Hardcoded PIN
let currentUser = null;
let chatPartner = null;
let currentChatRef = null;

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
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');
const sound = document.getElementById('msg-sound');
// Image Elements
const imageInput = document.getElementById('image-input');
const attachBtn = document.getElementById('attach-btn');
// Modal Elements
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.getElementById('close-modal');

// --- EVENT LISTENERS ---

loginBtn.addEventListener('click', handleLogin);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
logoutBtn.addEventListener('click', () => location.reload()); // Simple logout
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
    chatPartner = currentUser === 'vishal' ? 'bhavesh' : 'vishal';

    // Switch UI
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    // Setup Chat
    chatHeaderName.textContent = chatPartner.charAt(0).toUpperCase() + chatPartner.slice(1);

    initializeChat();
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
        }
    });

    // 2. Listen for Message Changes (specifically 'seen' status)
    messagesRef.limitToLast(100).on('child_changed', (snapshot) => {
        const msg = snapshot.val();
        updateMessageStatus(snapshot.key, msg.seen);
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
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        sender: currentUser,
        receiver: chatPartner,
        text: text,
        timestamp: Date.now(),
        seen: false
    };

    db.ref('messages').push(messageData);
    messageInput.value = '';

    // Reset typing status immediately
    db.ref(`status/${currentUser}/typing`).set(false);
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
}

function markAsSeen(messageKey) {
    db.ref(`messages/${messageKey}`).update({ seen: true });
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

    msgDiv.innerHTML = `
        ${msg.image ? `<img src="${msg.image}" class="msg-image" alt="Image">` : `<div class="msg-text">${escapeHtml(msg.text)}</div>`}
        <div class="msg-meta">
            <span class="timestamp">${time}</span>
            ${statusIcon}
        </div>
    `;

    chatContainer.appendChild(msgDiv);
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
