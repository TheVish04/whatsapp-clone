// call.js — WebRTC + Firebase Signaling for Voice/Video Calls

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
    ]
};

let peerConnection = null;
let localStream = null;
let callRoomRef = null;
let incomingCallRef = null;
let callTimerInterval = null;
let callSeconds = 0;
let isMuted = false;
let isCameraOff = false;
let currentCallType = 'voice';
let isCallee = false;
let ringAudio = null;
let noAnswerTimer = null;

const incomingOverlay    = document.getElementById('incoming-call-overlay');
const activeOverlay      = document.getElementById('active-call-overlay');
const incomingCallType   = document.getElementById('incoming-call-type');
const incomingCallerName = document.getElementById('incoming-caller-name');
const acceptBtn          = document.getElementById('accept-call-btn');
const declineBtn         = document.getElementById('decline-call-btn');
const endCallBtn         = document.getElementById('end-call-btn');
const muteBtn            = document.getElementById('mute-btn');
const cameraBtn          = document.getElementById('camera-btn');
const cameraToggleGroup  = document.getElementById('camera-toggle-group');
const activeCallName     = document.getElementById('active-call-name');
const activeCallStatus   = document.getElementById('active-call-status');
const activeCallAvatar   = document.getElementById('active-call-avatar');
const activeCallBg       = document.getElementById('active-call-bg');
const localVideo         = document.getElementById('local-video');
const remoteVideo        = document.getElementById('remote-video');
const iconMuteOff        = document.getElementById('icon-mute-off');
const iconMuteOn         = document.getElementById('icon-mute-on');
const iconCamOn          = document.getElementById('icon-cam-on');
const iconCamOff         = document.getElementById('icon-cam-off');
const muteLabel          = document.getElementById('mute-label');

// ─── Ringtone ────────────────────────────────────────────────────────────────
function startRingtone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        let playing = true;
        ringAudio = ctx;
        const playRing = () => {
            if (!playing) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(480, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
            osc.onended = () => { if (playing) setTimeout(playRing, 1000); };
        };
        playRing();
        ringAudio._stop = () => { playing = false; ctx.close().catch(() => {}); };
    } catch (e) { console.warn('Ringtone error:', e); }
}

function stopRingtone() {
    if (ringAudio && ringAudio._stop) { ringAudio._stop(); ringAudio = null; }
}

// ─── Call Timer ──────────────────────────────────────────────────────────────
function startCallTimer() {
    callSeconds = 0;
    callTimerInterval = setInterval(() => {
        callSeconds++;
        const m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
        const s = (callSeconds % 60).toString().padStart(2, '0');
        if (activeCallStatus) activeCallStatus.textContent = `${m}:${s}`;
    }, 1000);
}

function stopCallTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
function showActiveCallUI(partnerName, type) {
    currentCallType = type;
    if (activeCallName) activeCallName.textContent = partnerName;
    if (activeCallStatus) activeCallStatus.textContent = 'Connecting...';
    if (activeCallAvatar) activeCallAvatar.textContent = partnerName.charAt(0).toUpperCase();
    if (cameraToggleGroup) cameraToggleGroup.style.display = type === 'video' ? 'flex' : 'none';
    if (activeCallBg) activeCallBg.style.display = type === 'voice' ? 'flex' : 'none';
    activeOverlay.classList.remove('hidden');
}

function hideActiveCallUI() {
    activeOverlay.classList.add('hidden');
    if (localVideo) { localVideo.classList.add('hidden'); localVideo.srcObject = null; }
    if (remoteVideo) remoteVideo.srcObject = null;
}

function showIncomingCallUI(callerName, type) {
    if (incomingCallerName) incomingCallerName.textContent = callerName;
    if (incomingCallType) {
        incomingCallType.textContent = type === 'video' ? 'Incoming Video Call 📹' : 'Incoming Voice Call 📞';
    }
    incomingOverlay.classList.remove('hidden');
    startRingtone();
}

function hideIncomingCallUI() {
    incomingOverlay.classList.add('hidden');
    stopRingtone();
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
function cleanupCall() {
    stopRingtone();
    stopCallTimer();
    clearTimeout(noAnswerTimer);
    if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    hideIncomingCallUI();
    hideActiveCallUI();
    if (incomingCallRef) { incomingCallRef.off(); incomingCallRef = null; }
    isMuted = false;
    isCameraOff = false;
    if (iconMuteOff) iconMuteOff.classList.remove('hidden');
    if (iconMuteOn) iconMuteOn.classList.add('hidden');
    if (iconCamOn) iconCamOn.classList.remove('hidden');
    if (iconCamOff) iconCamOff.classList.add('hidden');
    if (muteLabel) muteLabel.textContent = 'Mute';
}

// ─── Get User Media ───────────────────────────────────────────────────────────
async function getLocalStream(type) {
    const constraints = type === 'video'
        ? { audio: true, video: { facingMode: 'user' } }
        : { audio: true, video: false };
    return await navigator.mediaDevices.getUserMedia(constraints);
}

// ─── Create PeerConnection ────────────────────────────────────────────────────
function createPeerConnection(db, roomId, role) {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    const candidatePath = role === 'caller'
        ? `callRooms/${roomId}/callerCandidates`
        : `callRooms/${roomId}/calleeCandidates`;

    pc.onicecandidate = (event) => {
        if (event.candidate) db.ref(candidatePath).push(event.candidate.toJSON());
    };

    pc.ontrack = (event) => {
        if (remoteVideo && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            if (event.track.kind === 'video' && activeCallBg) activeCallBg.style.display = 'none';
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            if (activeCallStatus) activeCallStatus.textContent = '';
            startCallTimer();
            clearTimeout(noAnswerTimer);
        }
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            if (activeCallStatus) activeCallStatus.textContent = 'Connection lost...';
        }
    };
    return pc;
}

// ─── OUTGOING CALL ────────────────────────────────────────────────────────────
export async function startCall({ db, currentUser, chatPartner, type }) {
    if (!currentUser || !chatPartner) return;
    isCallee = false;
    currentCallType = type;

    try {
        localStream = await getLocalStream(type);
    } catch (err) {
        alert('Could not access microphone' + (type === 'video' ? '/camera' : '') + '. Please grant permission.');
        return;
    }

    const roomRef = db.ref('callRooms').push();
    const roomId = roomRef.key;
    callRoomRef = roomRef;

    peerConnection = createPeerConnection(db, roomId, 'caller');
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (type === 'video' && localVideo) {
        localVideo.srcObject = localStream;
        localVideo.classList.remove('hidden');
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await roomRef.set({ offer: { sdp: offer.sdp, type: offer.type }, callType: type });

    await db.ref(`calls/${chatPartner}`).set({
        callerId: currentUser, type, roomId, status: 'ringing'
    });

    showActiveCallUI(chatPartner, type);
    if (activeCallStatus) activeCallStatus.textContent = 'Calling...';

    noAnswerTimer = setTimeout(async () => {
        await db.ref(`calls/${chatPartner}`).update({ status: 'ended' });
        await roomRef.remove().catch(() => {});
        cleanupCall();
        alert('No answer.');
    }, 30000);

    const callStatusRef = db.ref(`calls/${chatPartner}`);
    callStatusRef.on('value', async (snap) => {
        const data = snap.val();
        if (!data) return;

        if (data.status === 'accepted') {
            const roomSnap = await roomRef.once('value');
            const roomData = roomSnap.val();
            if (roomData?.answer && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.answer));
            }
            db.ref(`callRooms/${roomId}/calleeCandidates`).on('child_added', (snap) => {
                if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(snap.val())).catch(console.warn);
            });
            clearTimeout(noAnswerTimer);
        }

        if (data.status === 'declined') {
            callStatusRef.off();
            await roomRef.remove().catch(() => {});
            cleanupCall();
        }

        if (data.status === 'ended' && data.callerId !== currentUser) {
            callStatusRef.off();
            await roomRef.remove().catch(() => {});
            cleanupCall();
        }
    });
}

// ─── ACCEPT CALL ──────────────────────────────────────────────────────────────
export async function acceptCall({ db, currentUser, chatPartner, roomId, type }) {
    isCallee = true;
    currentCallType = type;

    try {
        localStream = await getLocalStream(type);
    } catch (err) {
        alert('Could not access microphone/camera.');
        await db.ref(`calls/${currentUser}`).update({ status: 'declined' });
        hideIncomingCallUI();
        return;
    }

    callRoomRef = db.ref(`callRooms/${roomId}`);
    peerConnection = createPeerConnection(db, roomId, 'callee');
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (type === 'video' && localVideo) {
        localVideo.srcObject = localStream;
        localVideo.classList.remove('hidden');
    }

    const roomSnap = await callRoomRef.once('value');
    const roomData = roomSnap.val();
    if (!roomData?.offer) { cleanupCall(); return; }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await callRoomRef.update({ answer: { sdp: answer.sdp, type: answer.type } });
    await db.ref(`calls/${currentUser}`).update({ status: 'accepted' });

    db.ref(`callRooms/${roomId}/callerCandidates`).on('child_added', (snap) => {
        if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(snap.val())).catch(console.warn);
    });

    hideIncomingCallUI();
    showActiveCallUI(chatPartner, type);

    incomingCallRef = db.ref(`calls/${currentUser}`);
    incomingCallRef.on('value', async (snap) => {
        const data = snap.val();
        if (data?.status === 'ended') {
            incomingCallRef.off();
            await callRoomRef.remove().catch(() => {});
            cleanupCall();
        }
    });
}

// ─── DECLINE CALL ─────────────────────────────────────────────────────────────
export async function declineCall({ db, currentUser }) {
    await db.ref(`calls/${currentUser}`).update({ status: 'declined' });
    hideIncomingCallUI();
}

// ─── END CALL ─────────────────────────────────────────────────────────────────
export async function endCall({ db, currentUser, chatPartner }) {
    const target = isCallee ? currentUser : chatPartner;
    await db.ref(`calls/${target}`).update({ status: 'ended' }).catch(() => {});
    if (callRoomRef) await callRoomRef.remove().catch(() => {});
    cleanupCall();
}

// ─── MUTE TOGGLE ─────────────────────────────────────────────────────────────
export function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    if (iconMuteOff) iconMuteOff.classList.toggle('hidden', isMuted);
    if (iconMuteOn) iconMuteOn.classList.toggle('hidden', !isMuted);
    if (muteLabel) muteLabel.textContent = isMuted ? 'Unmute' : 'Mute';
    if (muteBtn) muteBtn.classList.toggle('active-ctrl', isMuted);
}

// ─── CAMERA TOGGLE ────────────────────────────────────────────────────────────
export function toggleCamera() {
    if (!localStream) return;
    isCameraOff = !isCameraOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !isCameraOff; });
    if (iconCamOn) iconCamOn.classList.toggle('hidden', isCameraOff);
    if (iconCamOff) iconCamOff.classList.toggle('hidden', !isCameraOff);
    const cameraLabel = document.getElementById('camera-label');
    if (cameraLabel) cameraLabel.textContent = isCameraOff ? 'Show Cam' : 'Camera';
    if (cameraBtn) cameraBtn.classList.toggle('active-ctrl', isCameraOff);
}

// ─── LISTEN FOR INCOMING CALLS ────────────────────────────────────────────────
export function listenForIncomingCalls({ db, currentUser, chatPartner, onIncoming }) {
    const ref = db.ref(`calls/${currentUser}`);
    ref.on('value', (snap) => {
        const data = snap.val();
        if (data && data.status === 'ringing' && data.callerId === chatPartner) {
            onIncoming(data);
        }
    });
    return () => ref.off();
}
