(function () {
  'use strict';

  const STORAGE_KEY = 'classroom_session';
  const HEARTBEAT_MS = 1000;

  // ---- DOM refs ----
  const registerSection = document.getElementById('register-section');
  const sessionSection  = document.getElementById('session-section');
  const errorMsg        = document.getElementById('error-msg');
  const video           = document.getElementById('video');
  const canvas          = document.getElementById('canvas');
  const photoPreview    = document.getElementById('photo-preview');
  const btnCapture      = document.getElementById('btn-capture');
  const btnRetake       = document.getElementById('btn-retake');
  const registerForm    = document.getElementById('register-form');
  const btnSubmit       = document.getElementById('btn-submit');
  const sessionPhoto    = document.getElementById('session-photo');
  const sessionName     = document.getElementById('session-name');
  const sessionDni      = document.getElementById('session-dni');
  const statusDot       = document.getElementById('status-dot');
  const statusLbl       = document.getElementById('status-lbl');
  const btnLogout       = document.getElementById('btn-logout');

  // ---- State ----
  const params    = new URLSearchParams(window.location.search);
  const urlToken  = params.get('token');
  let socket      = null;
  let hbTimer     = null;
  let photoData   = null; // base64 thumbnail (in-page memory only)
  let camStream   = null;

  // ---- Storage helpers ----
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (err) {
      console.warn('Failed to load session from localStorage:', err);
      return null;
    }
  }
  function saveSession(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }
  function makeSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'sess_' + crypto.randomUUID();
    }
    // Fallback for browsers without crypto.randomUUID
    return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---- UI helpers ----
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
  function hideError() {
    errorMsg.style.display = 'none';
  }
  function setConnected(on) {
    statusDot.style.background = on ? '#68d391' : '#fc8181';
    statusLbl.textContent      = on ? 'Connectat' : 'Desconnectat';
  }
  function showSessionView(s) {
    registerSection.style.display = 'none';
    sessionSection.style.display  = 'block';
    sessionName.textContent = `${s.firstName} ${s.surname}`;
    sessionDni.textContent  = `DNI: ${s.dni}`;
    if (s.photo) { sessionPhoto.src = s.photo; }
  }

  // ---- Camera ----
  async function startCamera() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = camStream;
    } catch (err) {
      showError('No es pot accedir a la càmera: ' + err.message);
      btnCapture.disabled = true;
    }
  }
  function stopCamera() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }
  function capturePhoto() {
    const SIZE = 100;
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth  || SIZE;
    const vh = video.videoHeight || SIZE;
    const s  = Math.min(vw, vh);
    ctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, SIZE, SIZE);
    photoData = canvas.toDataURL('image/jpeg', 0.7);
    return photoData;
  }

  // ---- Socket ----
  function connectSocket(onReady) {
    socket = io('/student', { reconnection: true });
    socket.on('connect',    () => { setConnected(true);  if (onReady) { onReady(); onReady = null; } });
    socket.on('disconnect', () => setConnected(false));
    socket.on('student:error',      ({ message }) => showError(message));
    socket.on('student:logged-out', () => {
      stopHeartbeat();
      clearSession();
      socket.disconnect();
      window.location.href = '/';
    });
  }

  function startHeartbeat(sessionId) {
    stopHeartbeat();
    hbTimer = setInterval(() => {
      if (socket && socket.connected) socket.emit('student:heartbeat', { sessionId });
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  }

  // ---- Webcam capture buttons ----
  btnCapture.addEventListener('click', () => {
    capturePhoto();
    photoPreview.src          = photoData;
    photoPreview.style.display = 'block';
    video.style.display        = 'none';
    btnCapture.style.display   = 'none';
    btnRetake.style.display    = '';
  });

  btnRetake.addEventListener('click', () => {
    photoData                  = null;
    photoPreview.style.display = 'none';
    video.style.display        = '';
    btnCapture.style.display   = '';
    btnRetake.style.display    = 'none';
  });

  // ---- Registration form ----
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();

    if (!urlToken) {
      showError("Falta el token d'accés. Escaneja el codi QR del professor.");
      return;
    }
    if (!photoData) {
      showError('Has de capturar una foto abans d\'entrar.');
      return;
    }

    const firstName = document.getElementById('firstName').value.trim();
    const surname   = document.getElementById('surname').value.trim();
    const dni       = document.getElementById('dni').value.trim().toUpperCase();

    if (!firstName || !surname || !dni) {
      showError('Omple tots els camps.');
      return;
    }

    btnSubmit.disabled = true;
    const sessionId = makeSessionId();
    const payload   = { sessionId, firstName, surname, dni, photo: photoData, token: urlToken };

    connectSocket(() => {
      socket.emit('student:register', payload);

      socket.once('student:registered', () => {
        saveSession({ sessionId, firstName, surname, dni, photo: photoData });
        stopCamera();
        showSessionView({ firstName, surname, dni, photo: photoData });
        startHeartbeat(sessionId);
      });

      // re-enable button on error
      socket.once('student:error', () => { btnSubmit.disabled = false; });
    });
  });

  // ---- Logout ----
  btnLogout.addEventListener('click', () => {
    const s = loadSession();
    stopHeartbeat();
    if (socket) {
      if (s) socket.emit('student:logout', { sessionId: s.sessionId });
      socket.disconnect();
    }
    clearSession();
    stopCamera();
    window.location.href = '/';
  });

  // ---- Init ----
  const existing = loadSession();
  if (existing) {
    showSessionView(existing);
    connectSocket(() => startHeartbeat(existing.sessionId));
  } else {
    if (!urlToken) {
      showError("Falta el token d'accés. Escaneja el codi QR del professor per unir-te a la classe.");
    }
    startCamera();
  }

}());
