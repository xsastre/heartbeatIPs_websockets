(function () {
  'use strict';

  const socket       = io('/panel');
  const grid         = document.getElementById('students-grid');
  const emptyState   = document.getElementById('empty-state');
  const countEl      = document.getElementById('count');
  const joinCodeEl   = document.getElementById('join-code');
  const btnNewCode   = document.getElementById('btn-new-code');

  // ---- Socket events ----
  socket.on('panel:students', renderStudents);
  socket.on('panel:join-code', ({ code }) => {
    if (joinCodeEl) joinCodeEl.textContent = `Codi: ${code}`;
  });

  if (btnNewCode) {
    btnNewCode.addEventListener('click', () => socket.emit('panel:regenerate-code'));
  }

  // ---- Student grid rendering ----
  function statusClass(status) {
    if (status === 'green') return 'green';
    if (status === 'amber') return 'amber';
    return 'red';
  }

  function maskDni(dni) {
    const value = String(dni || '');
    if (value.length <= 2) return value;
    return `...${value.slice(-3)}`;
  }

  function formatAgeSeconds(lastSeen) {
    const age = Math.max(0, (Date.now() - lastSeen) / 1000);
    return `${age.toFixed(1)} s`;
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
          '<div class="student-meta student-ip"></div>' +
          '<div class="student-last-contact"></div>';
        grid.appendChild(card);
      }

      const cls = statusClass(student.status);
      card.className = `student-card ${cls}`;

      const img = card.querySelector('.student-photo');
      if (student.photo && img.src !== student.photo) img.src = student.photo;

      card.querySelector('.student-name').textContent = `${student.firstName} ${student.surname}`;
      card.querySelector('.student-dni').textContent  = `DNI: ${maskDni(student.dni)}`;
      card.querySelector('.student-ip').textContent   = `IP: ${student.ip}`;
      card.querySelector('.student-last-contact').textContent =
        `Ultim contacte: ${formatAgeSeconds(student.lastSeen)}`;
    });
  }

}());
