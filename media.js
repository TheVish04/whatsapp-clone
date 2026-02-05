// media.js
// Image upload, document upload, camera, secret photo, and drawing-board logic.

export function initMedia({
  db,
  state,
  elements,
  helpers,
  dndHelper,
  pushHelper
}) {
  const {
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
  } = elements;

  const {
    renderMessage,
    scheduleScrollToBottom,
    updateMessageStatus
  } = helpers;

  const { checkPartnerDndAndSend } = dndHelper;
  const { sendPushToPartner } = pushHelper;

  // ------------- IMAGE UPLOAD -------------
  let isImageProcessing = false;
  let lastImageSelectTime = 0;
  let isSecretMode = false;

  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const now = Date.now();
    if (now - lastImageSelectTime < 1000) return;
    if (isImageProcessing) return;

    isImageProcessing = true;
    lastImageSelectTime = now;

    const selectedSecret = isSecretMode;
    imageInput.value = '';
    isSecretMode = false;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        sendImageMessage(dataUrl, selectedSecret);
        isImageProcessing = false;
      };
      img.onerror = () => {
        isImageProcessing = false;
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      isImageProcessing = false;
    };
    reader.readAsDataURL(file);
  }

  function sendImageMessage(base64Data, isSecret = false) {
    checkPartnerDndAndSend((opts) => doSendImageMessage(base64Data, opts, isSecret));
  }

  function doSendImageMessage(base64Data, opts = {}, isSecret = false) {
    const messageData = {
      sender: state.currentUser,
      receiver: state.chatPartner,
      text: '📷 Photo',
      image: base64Data,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      seen: false,
      type: 'image',
      isSecret,
      highPriority: opts.highPriority || false
    };

    const messagesRef = db.ref('messages');
    const newMsgRef = messagesRef.push();
    const key = newMsgRef.key;
    helpers.pendingKeys.add(key);

    renderMessage({ ...messageData, timestamp: Date.now() }, key);
    scheduleScrollToBottom([0, 150, 400]);

    newMsgRef
      .set(messageData)
      .then(() => {
        helpers.pendingKeys.delete(key);
        const msgEl = document.getElementById('msg-' + key);
        if (msgEl) {
          msgEl.classList.remove('pending');
          const statusIcon = msgEl.querySelector('.status-icon');
          if (statusIcon) {
            statusIcon.classList.remove('pending-icon');
            statusIcon.innerHTML =
              '<svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033L4.023 6.045a.364.364 0 0 0-.513.041l-.383.432a.364.364 0 0 0 .046.513l4.743 4.31a.318.318 0 0 0 .484-.033l6.59-8.498a.363.363 0 0 0-.063-.51l.083.016z"/><path d="M11.383 1.36l-.478-.372a.365.365 0 0 0-.51.063L4.566 8.679a.32.32 0 0 1-.484.033L1.09 5.86a.418.418 0 0 0-.541.036L.141 6.314a.319.319 0 0 0 .032.484l3.52 2.953c.143.14.361.125.473-.018l6.837-7.234a.418.418 0 0 0-.063-.526z"/></svg>';
          }
          const imgLoading = msgEl.querySelector('.img-loading-overlay');
          if (imgLoading) imgLoading.remove();
          const secretSpinner = msgEl.querySelector('.secret-bubble .spinner');
          if (secretSpinner) secretSpinner.remove();
        }
      })
      .catch((err) => {
        console.error('Image Send Error', err);
        helpers.pendingKeys.delete(key);
      });

    db.ref(`status/${state.currentUser}/typing`).set(false);
    sendPushToPartner();
  }

  // ------------- DOCUMENT UPLOAD -------------
  let isDocumentProcessing = false;

  function handleDocumentSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (isDocumentProcessing) return;

    isDocumentProcessing = true;
    docInput.value = '';

    if (file.size > 100 * 1024 * 1024) {
      alert('File size exceeds 100MB limit.');
      isDocumentProcessing = false;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      sendDocumentMessage(file, base64Data);
      isDocumentProcessing = false;
    };
    reader.onerror = () => {
      isDocumentProcessing = false;
    };
    reader.readAsDataURL(file);
  }

  function sendDocumentMessage(file, base64Data) {
    checkPartnerDndAndSend((opts) => doSendDocumentMessage(file, base64Data, opts));
  }

  function doSendDocumentMessage(file, base64Data, opts = {}) {
    const messageData = {
      sender: state.currentUser,
      receiver: state.chatPartner,
      text: `📄 ${file.name}`,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data
      },
      timestamp: Date.now(),
      seen: false,
      highPriority: opts.highPriority || false
    };

    const messagesRef = db.ref('messages');
    const newMsgRef = messagesRef.push();
    const newKey = newMsgRef.key;

    helpers.pendingKeys.add(newKey);
    scheduleScrollToBottom([150, 400]);

    newMsgRef
      .set(messageData)
      .then(() => {
        helpers.pendingKeys.delete(newKey);
        const msgRow = document.getElementById('msg-' + newKey);
        if (msgRow) {
          const spinner = msgRow.querySelector('.doc-loading-spinner');
          if (spinner) spinner.remove();
          updateMessageStatus(newKey, false);
        }
      })
      .catch((err) => {
        console.error('Doc Send Error', err);
        const statusEl = document.getElementById(`status-${newKey}`);
        if (statusEl) statusEl.innerHTML = '<span style="color:red">!</span>';
      });

    db.ref(`status/${state.currentUser}/typing`).set(false);
    sendPushToPartner();
  }

  // ------------- PLUS MENU & SECRET MODE -------------
  if (plusBtn) {
    plusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      plusMenu.classList.toggle('hidden');
      plusBtn.classList.toggle('active');
      isSecretMode = false;
    });
  }

  if (plusGalleryBtn) {
    plusGalleryBtn.addEventListener('click', () => {
      isSecretMode = false;
      imageInput.click();
      plusMenu.classList.add('hidden');
    });
  }

  if (plusSecretBtn) {
    plusSecretBtn.addEventListener('click', () => {
      isSecretMode = true;
      imageInput.click();
      plusMenu.classList.add('hidden');
    });
  }

  if (plusDocBtn) {
    plusDocBtn.addEventListener('click', () => {
      docInput.click();
      plusMenu.classList.add('hidden');
    });
  }

  if (plusCameraBtn) {
    plusCameraBtn.addEventListener('click', () => {
      openCamera();
      plusMenu.classList.add('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (plusMenu && !plusMenu.classList.contains('hidden') && plusBtn && !plusBtn.contains(e.target) && !plusMenu.contains(e.target)) {
      plusMenu.classList.add('hidden');
      plusBtn.classList.remove('active');
    }
  });

  // ------------- CAMERA -------------
  let cameraStreamTrack = null;
  let currentFacingMode = 'user';

  function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported or permission denied.');
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

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        cameraStream.srcObject = stream;
        cameraStreamTrack = stream.getTracks()[0];
      })
      .catch((err) => {
        console.error('Camera Error: ' + err);
        alert('Could not access camera: ' + err.message);
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

    cameraCanvas.width = cameraStream.videoWidth;
    cameraCanvas.height = cameraStream.videoHeight;

    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraStream, 0, 0, cameraCanvas.width, cameraCanvas.height);

    const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.8);
    cameraPreview.src = dataUrl;

    cameraStream.classList.add('hidden');
    cameraPreview.classList.remove('hidden');

    cameraControls.classList.add('hidden');
    previewControls.classList.remove('hidden');
  }

  function retakePhoto() {
    cameraPreview.classList.add('hidden');
    cameraStream.classList.remove('hidden');

    previewControls.classList.add('hidden');
    cameraControls.classList.remove('hidden');

    cameraPreview.src = '';
  }

  function confirmSendPhoto() {
    const dataUrl = cameraPreview.src;
    try {
      if (dataUrl) {
        sendImageMessage(dataUrl);
      }
    } catch (e) {
      console.error('Error sending photo:', e);
    } finally {
      closeCameraModal();
      const modal = document.getElementById('camera-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        setTimeout(() => {
          modal.style.display = '';
        }, 500);
      }
      setTimeout(retakePhoto, 300);
    }
  }

  // Wire camera events
  if (plusCameraBtn) plusCameraBtn.addEventListener('click', openCamera);
  if (closeCameraBtn) closeCameraBtn.addEventListener('click', closeCameraModal);
  if (captureBtn) captureBtn.addEventListener('click', capturePhoto);
  if (switchCameraBtn) switchCameraBtn.addEventListener('click', switchCamera);
  if (sendPhotoBtn) {
    const handleSend = (e) => {
      e.preventDefault();
      confirmSendPhoto();
    };
    sendPhotoBtn.addEventListener('click', handleSend);
    sendPhotoBtn.addEventListener('touchstart', handleSend, { passive: true });
  }

  // ------------- DRAWING BOARD -------------
  let drawingCtx;
  let isDrawing = false;

  function setupCanvas() {
    const container = drawingModal.querySelector('.drawing-area');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    drawingCanvas.width = width;
    drawingCanvas.height = height;

    drawingCtx = drawingCanvas.getContext('2d');
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.lineWidth = 3;
    drawingCtx.strokeStyle = '#000000';

    colorSwatches.forEach((s) => s.classList.remove('active'));
    if (colorSwatches[0]) colorSwatches[0].classList.add('active');
  }

  if (drawingModal && drawingCanvas) {
    drawingCanvas.addEventListener('mousedown', startPosition);
    drawingCanvas.addEventListener('mouseup', finishedPosition);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseleave', finishedPosition);

    drawingCanvas.addEventListener('touchstart', startPosition, { passive: true });
    drawingCanvas.addEventListener('touchend', finishedPosition, { passive: true });
    drawingCanvas.addEventListener('touchmove', draw, { passive: true });
  }

  function startPosition(e) {
    isDrawing = true;
    draw(e);
  }

  function finishedPosition() {
    isDrawing = false;
    if (drawingCtx) drawingCtx.beginPath();
  }

  function draw(e) {
    if (!isDrawing || !drawingCtx) return;

    const rect = drawingCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    drawingCtx.lineTo(x, y);
    drawingCtx.stroke();
    drawingCtx.beginPath();
    drawingCtx.moveTo(x, y);
  }

  if (clearDrawingBtn) {
    clearDrawingBtn.addEventListener('click', () => {
      if (drawingCtx) drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    });
  }

  if (closeDrawingBtn) {
    closeDrawingBtn.addEventListener('click', () => {
      drawingModal.classList.add('hidden');
    });
  }

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', (e) => {
      colorSwatches.forEach((s) => s.classList.remove('active'));
      e.target.classList.add('active');
      const color = e.target.getAttribute('data-color');
      if (drawingCtx) drawingCtx.strokeStyle = color;
    });
  });

  if (sendDrawingBtn) {
    sendDrawingBtn.addEventListener('click', () => {
      try {
        const dataUrl = drawingCanvas.toDataURL('image/png');
        sendImageMessage(dataUrl);
      } catch (e) {
        console.error('Critical Error sending drawing:', e);
      } finally {
        const modal = document.getElementById('drawing-modal');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
          setTimeout(() => {
            modal.style.display = '';
          }, 500);
        }
        if (drawingCtx) {
          drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        }
      }
    });
  }

  window.addEventListener('resize', () => {
    if (!drawingModal.classList.contains('hidden')) {
      setupCanvas();
    }
  });

  // Expose some functions for global HTML bindings if needed
  window.capturePhoto = capturePhoto;
  window.openCamera = openCamera;
  window.retakePhoto = retakePhoto;
  window.switchCamera = switchCamera;
  window.confirmSendPhoto = () => {
    closeCameraModal();
    const dataUrl = cameraPreview.src;
    if (dataUrl) sendImageMessage(dataUrl);
    setTimeout(retakePhoto, 300);
  };
  window.imageInput = imageInput;

  // Wire core input listeners
  if (imageInput) imageInput.addEventListener('change', handleImageSelect);
  if (docInput) docInput.addEventListener('change', handleDocumentSelect);

  return {
    sendImageMessage,
    sendDocumentMessage,
    openCamera,
    closeCameraModal
  };
}

