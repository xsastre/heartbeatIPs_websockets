(function () {
  'use strict';

  const socket       = io('/panel');
  const grid         = document.getElementById('students-grid');
  const emptyState   = document.getElementById('empty-state');
  const countEl      = document.getElementById('count');
  const btnQr        = document.getElementById('btn-qr');
  const qrModal      = document.getElementById('qr-modal');
  const qrImage      = document.getElementById('qr-image');
  const qrUrl        = document.getElementById('qr-url');
  const qrExpiry     = document.getElementById('qr-expiry');
  const btnClose     = document.getElementById('btn-close-modal');

  let expiryTimer = null;

  // ---- Socket events ----
  socket.on('panel:students', renderStudents);

  socket.on('panel:token', ({ url, qr, expiry }) => {
    qrImage.src = qr;
    qrUrl.textContent = url;
    openModal();
    startExpiryCountdown(expiry);
  });

  // ---- Buttons ----
  btnQr.addEventListener('click', () => socket.emit('panel:generate-token'));

  btnClose.addEventListener('click', closeModal);

  // close on backdrop click
  qrModal.addEventListener('click', (e) => { if (e.target === qrModal) closeModal(); });

  // ---- Modal helpers ----
  function openModal()  { qrModal.classList.add('open'); }
  function closeModal() {
    qrModal.classList.remove('open');
    if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }
  }

  function startExpiryCountdown(expiry) {
    if (expiryTimer) clearInterval(expiryTimer);
    function tick() {
      const remaining = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      qrExpiry.textContent = remaining > 0 ? `Caduca en ${remaining}s` : 'Caducat';
      if (remaining === 0) { clearInterval(expiryTimer); expiryTimer = null; }
    }
    tick();
    expiryTimer = setInterval(tick, 1000);
  }

  // ---- Student grid rendering ----
  function statusClass(status) {
    if (status === 'green') return 'green';
    if (status === 'amber') return 'amber';
    return 'red';
  }

  function renderStudents(students) {
    countEl.textContent = `${students.length} alumne${students.length !== 1 ? 's' : ''}`;

    // Index existing cards
    const existing = new Map();
    grid.querySelectorAll('.student-card').forEach(c => existing.set(c.dataset.sessionId, c));

    const current = new Set(students.map(s => s.sessionId));

    // Remove stale cards
    for (const [sid, card] of existing) {
      if (!current.has(sid)) card.remove();
    }

    // Show / hide empty state
    if (emptyState) emptyState.style.display = students.length === 0 ? '' : 'none';

    // Add / update cards (max 25)
    students.slice(0, 25).forEach(student => {
      let card = existing.get(student.sessionId);
      if (!card) {
        card = document.createElement('div');
        card.className            = 'student-card';
        card.dataset.sessionId    = student.sessionId;
        card.innerHTML =
          '<div class="traffic-light">' +
            '<div class="tl-dot tl-red"></div>' +
            '<div class="tl-dot tl-amber"></div>' +
            '<div class="tl-dot tl-green"></div>' +
          '</div>' +
          '<img class="student-photo" src="" alt="Foto">' +
          '<div class="student-name"></div>' +
          '<div class="student-meta student-dni"></div>' +
          '<div class="student-meta student-ip"></div>';
        grid.appendChild(card);
      }

      const cls = statusClass(student.status);
      card.className = `student-card ${cls}`;

      const img = card.querySelector('.student-photo');
      if (student.photo && img.src !== student.photo) img.src = student.photo;

      card.querySelector('.student-name').textContent = `${student.firstName} ${student.surname}`;
      card.querySelector('.student-dni').textContent  = `DNI: ${student.dni}`;
      card.querySelector('.student-ip').textContent   = `IP: ${student.ip}`;
    });
  }

}());
