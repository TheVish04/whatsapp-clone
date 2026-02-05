// notifications.js
// Handles in-app banner click logic and system notifications via Service Worker.

export function initNotifications({
  appNotification,
  notificationMsg,
  closeNotificationBtn
}) {
  function showSystemNotification(title, body) {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: '/icon.png',
        tag: `market-${Date.now()}`,
        renotify: true,
        data: {
          url: 'https://www.tradingview.com/'
        }
      });
    });
  }

  if (appNotification) {
    appNotification.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-notification')) {
        appNotification.classList.add('hidden');
        e.stopPropagation();
        return;
      }
      window.open('https://www.tradingview.com/', '_blank');
      appNotification.classList.add('hidden');
    });
  }

  return { showSystemNotification };
}

