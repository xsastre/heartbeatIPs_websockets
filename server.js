'use strict';

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;

// Limit page requests: 60 per minute per IP
const pageLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/join', pageLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/panel', pageLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

// ---- In-memory storage ----
// sessionId -> { sessionId, firstName, surname, dni, ip, photo, lastSeen, socketId }
const sessions = new Map();
const dniIndex = new Map(); // normalised-dni -> sessionId
const tokens   = new Map(); // token -> expiry timestamp (ms)

function getClientIP(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return socket.handshake.address;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function isTokenValid(token) {
  const expiry = tokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function getStatus(lastSeen) {
  const age = (Date.now() - lastSeen) / 1000;
  if (age < 2) return 'green';
  if (age < 3) return 'amber';
  return 'red';
}

function sessionToDTO(s) {
  return {
    sessionId: s.sessionId,
    firstName: s.firstName,
    surname:   s.surname,
    dni:       s.dni,
    ip:        s.ip,
    photo:     s.photo,
    lastSeen:  s.lastSeen,
    status:    getStatus(s.lastSeen),
  };
}

// ---- Server creation (HTTPS if certs exist, else HTTP) ----
const certPath = path.join(__dirname, 'certs', 'server.cert');
const keyPath  = path.join(__dirname, 'certs', 'server.key');
const useHTTPS = fs.existsSync(certPath) && fs.existsSync(keyPath);

let server;
if (useHTTPS) {
  server = https.createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    app
  );
  console.log('Starting with HTTPS');
} else {
  server = http.createServer(app);
  console.log(
    'Starting with HTTP (no certs in ./certs/). ' +
    'Run `bash scripts/generate-cert.sh` to enable HTTPS for getUserMedia over LAN.'
  );
}

const io = new Server(server);

// ---- Namespaces ----
const panelNS   = io.of('/panel');
const studentNS = io.of('/student');

function broadcastStudents() {
  const list = Array.from(sessions.values()).map(sessionToDTO);
  panelNS.emit('panel:students', list);
}

// ---- Panel namespace ----
panelNS.on('connection', (socket) => {
  // Send current list immediately to the newly connected panel
  socket.emit('panel:students', Array.from(sessions.values()).map(sessionToDTO));

  socket.on('panel:generate-token', async () => {
    const token  = generateToken();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    tokens.set(token, expiry);

    const host     = socket.handshake.headers.host || `localhost:${PORT}`;
    const protocol = useHTTPS ? 'https' : 'http';
    const url      = `${protocol}://${host}/join?token=${token}`;

    try {
      const qr = await QRCode.toDataURL(url);
      socket.emit('panel:token', { token, url, qr, expiry });
    } catch (err) {
      console.error('QR generation error:', err);
    }
  });
});

// ---- Student namespace ----
studentNS.on('connection', (socket) => {
  const ip = getClientIP(socket);

  socket.on('student:register', ({ sessionId, firstName, surname, dni, photo, token }) => {
    if (!isTokenValid(token)) {
      socket.emit('student:error', {
        message: 'Token invàlid o caducat. Demana un nou codi QR al professor.',
      });
      return;
    }

    const normDNI = (dni || '').trim().toUpperCase();

    // DNI uniqueness: allow if same sessionId is re-registering
    if (dniIndex.has(normDNI) && dniIndex.get(normDNI) !== sessionId) {
      socket.emit('student:error', {
        message: 'Aquest DNI ja està registrat en una altra sessió activa.',
      });
      return;
    }

    const session = {
      sessionId,
      firstName: (firstName || '').trim(),
      surname:   (surname   || '').trim(),
      dni:       normDNI,
      ip,
      photo,        // base64 thumbnail — kept in memory only, never written to disk
      lastSeen:  Date.now(),
      socketId:  socket.id,
    };

    sessions.set(sessionId, session);
    dniIndex.set(normDNI, sessionId);

    socket.emit('student:registered', { sessionId });
    broadcastStudents();
  });

  socket.on('student:heartbeat', ({ sessionId }) => {
    const s = sessions.get(sessionId);
    if (s) {
      s.lastSeen = Date.now();
      s.socketId = socket.id;
      s.ip       = ip; // refresh IP on reconnect
    }
  });

  socket.on('student:logout', ({ sessionId }) => {
    const s = sessions.get(sessionId);
    if (s) {
      dniIndex.delete(s.dni);
      sessions.delete(sessionId);
      broadcastStudents();
    }
    socket.emit('student:logged-out');
  });
});

// ---- Periodic tasks ----

// Broadcast status updates every second
setInterval(broadcastStudents, 1000);

// Cleanup sessions silent for > 30 s
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [sid, s] of sessions) {
    if (now - s.lastSeen > 30000) {
      dniIndex.delete(s.dni);
      sessions.delete(sid);
      changed = true;
    }
  }
  if (changed) broadcastStudents();
}, 10000);

// ---- Start listening ----
server.listen(PORT, '0.0.0.0', () => {
  const proto = useHTTPS ? 'https' : 'http';
  console.log(`Server running at ${proto}://localhost:${PORT}`);
  console.log(`Panel: ${proto}://localhost:${PORT}/panel`);
});
