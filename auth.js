// auth.js
// Handles PIN-based login, duress PIN, intruder capture, and push token setup.

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Browser } from '@capacitor/browser';
import { LocalNotifications } from '@capacitor/local-notifications';

const DURESS_PIN = '0000';

export function createAuth({
  PIN_CODE,
  db,
  messaging,
  VAPID_KEY,
  ui,
  state,
  helpers
}) {
  const {
    loginScreen,
    userSelect,
    pinInput,
    loginError,
    chatScreen,
    chatHeaderName
  } = ui;

  const { scheduleScrollToBottom, initializeChat, initializePresence, activatePanicMode } = helpers;

  let incorrectPinAttempts = 0;

  function showError(msg) {
    loginError.textContent = msg;
    setTimeout(() => (loginError.textContent = ''), 3000);
  }

  async function setupNativePush(user) {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('User denied permissions!');
      return;
    }

    await PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', (token) => {
      console.log('Push Registration Token (native): ', token.value);
      saveTokenToDatabase(token.value, user);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Error on registration (native): ', err);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push received (native): ', notification);

      try {
        // Capacitor wraps the original payload under `notification.notification` for some events.
        const payload = notification.notification || notification;

        // Use the disguised title from the payload if present, otherwise fall back.
        const title = payload.title || 'Market Update';
        // Preserve privacy-friendly body (often a single space) if provided.
        const body = typeof payload.body === 'string' ? payload.body : ' ';

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title,
              body,
              // Fire immediately; small offset avoids edge-case race conditions.
              schedule: { at: new Date(Date.now() + 10) }
            }
          ]
        });
      } catch (err) {
        console.error('Local notification schedule failed:', err);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
      console.log('Push action performed (native): ', notification);
      const data = notification.notification.data;
      const targetUrl = (data && data.url) ? data.url : 'https://www.tradingview.com/';
      await Browser.open({ url: targetUrl });
    });

    await PushNotifications.register();
  }

  function setupFCM(user) {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    navigator.serviceWorker
      .register('./firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
        return messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      })
      .then((currentToken) => {
        if (currentToken) {
          console.log('FCM Token:', currentToken);
          saveTokenToDatabase(currentToken, user);
        } else {
          console.log('No registration token available. Request permission to generate one.');
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              console.log('Notification permission granted.');
            }
          });
        }
      })
      .catch((err) => {
        console.log('An error occurred while retrieving token. ', err);
      });

    messaging.onMessage((payload) => {
      console.log('Message received. ', payload);
    });
  }

  function saveTokenToDatabase(token, user) {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }

    db.ref(`tokens/devices/${deviceId}`).set(token);

    const targetUser = user || state.currentUser;
    if (targetUser) {
      db.ref(`tokens/users/${targetUser}/${deviceId}`).set(token);
    }
  }

  function setupPlatformPush(user) {
    if (Capacitor.isNativePlatform()) {
      setupNativePush(user);
    } else {
      setupFCM(user);
    }
  }

  async function triggerIntruderCapture(pinEntered) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

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
      position: 'absolute',
      opacity: '0',
      pointerEvents: 'none',
      width: '0',
      height: '0',
      visibility: 'hidden'
    });
    Object.assign(canvas.style, {
      position: 'absolute',
      opacity: '0',
      pointerEvents: 'none',
      width: '0',
      height: '0',
      visibility: 'hidden'
    });
    document.body.appendChild(video);
    document.body.appendChild(canvas);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      video.srcObject = stream;

      await video.play();

      await new Promise((resolve) => {
        const onReady = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            requestAnimationFrame(onReady);
          }
        };
        onReady();
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      const logRef = db.ref('security_logs').push();
      await logRef.set({
        timestamp: Date.now(),
        pinEntered,
        image: dataUrl,
        userAgent: navigator.userAgent || 'unknown'
      });

      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.error('Intruder capture failed:', err);
    } finally {
      if (video.parentNode) video.parentNode.removeChild(video);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  function handleLogin() {
    const user = userSelect.value;
    const pin = pinInput.value;

    if (!user) {
      showError('Please select an exchange.');
      return;
    }

    if (pin === DURESS_PIN) {
      activatePanicMode();
      loginScreen.classList.add('hidden');
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
      showError('Invalid access code.');
      return;
    }

    incorrectPinAttempts = 0;
    state.currentUser = user;
    state.chatPartner = state.currentUser === 'XAU/USD' ? 'BTC/USD' : 'XAU/USD';

    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    chatHeaderName.textContent = state.chatPartner;

    initializeChat();
    initializePresence();

    scheduleScrollToBottom([0, 100, 400, 800, 1200]);

    localStorage.setItem('savedUser', state.currentUser);

    setupPlatformPush(state.currentUser);
  }

  function getPublicApi() {
    return {
      handleLogin,
      setupPlatformPush,
      sendPushToPartner: async () => {
        if (!state.chatPartner) return;

        const snapshot = await db.ref(`tokens/users/${state.chatPartner}`).once('value');
        if (!snapshot.exists()) return;

        const tokensMap = snapshot.val();
        const tokens = Object.values(tokensMap);

        const API_URL = import.meta.env.VITE_API_URL || '/api/send-push';
        console.log(`[Push] Sending to ${tokens.length} devices via ${API_URL}`);

        tokens.forEach((token) => {
          fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              title: 'Market opens …',
              body: ' '
            })
          })
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => console.log('[Push] Success:', data))
            .catch((err) => console.error('[Push] API Error:', err));
        });
      }
    };
  }

  return getPublicApi();
}

