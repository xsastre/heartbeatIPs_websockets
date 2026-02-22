# Classroom Monitor – Heartbeat IPs via WebSockets

A real-time classroom monitoring web app using Node.js, Express and Socket.IO.

## Features

- **Student page** – Join via QR token, enter name/surname/DNI, capture webcam photo, keep-alive heartbeat, and close session.
- **Teacher panel** – Monitor up to 25 students with traffic-light status, webcam thumbnail, IP and DNI.
- **Traffic light logic** (based on last heartbeat):
  - 🟢 **Green** – < 2 s
  - 🟡 **Amber** – 2–3 s
  - 🔴 **Red**   – ≥ 3 s
- **HTTPS** – Self-signed certificate support so `getUserMedia` works over LAN.

## Prerequisites

- Node.js ≥ 14
- npm
- openssl (for HTTPS certificate generation)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Generate a self-signed certificate (required for webcam over LAN)

```bash
# localhost only
bash scripts/generate-cert.sh

# with your LAN IP (recommended)
bash scripts/generate-cert.sh 192.168.1.10
```

This creates `certs/server.key` and `certs/server.cert` (gitignored).

> **First-time browser trust**: navigate to `https://<IP>:3000` (or `https://localhost:3000`) and click **Advanced → Proceed** to accept the self-signed certificate. Students must do the same on their devices before scanning the QR code.

### 3. Run the server

```bash
npm start
```

The server starts on port **3000** (HTTPS if certs exist, HTTP otherwise).

## Access

| Page              | URL                                    |
|-------------------|----------------------------------------|
| Teacher panel     | `https://<LAN-IP>:3000/panel`          |
| Student join page | Via QR code generated in the panel     |

## Usage

1. Open the teacher panel on your device.
2. Click **"Generar QR"** to create a 10-minute access token and display the QR code.
3. Students scan the QR, accept the certificate warning, allow camera access, take a photo and fill in their name/surname/DNI.
4. The panel updates in real-time.
5. Students click **"Tancar sessió"** to leave. The session is automatically removed after 30 s of inactivity.

## Project structure

```
├── server.js               # Express + Socket.IO server
├── public/
│   ├── student.html        # Student join page
│   ├── student.js          # Student-side logic (webcam, heartbeat, localStorage)
│   ├── panel.html          # Teacher monitoring dashboard
│   └── panel.js            # Panel-side logic (live grid, QR modal)
├── scripts/
│   └── generate-cert.sh    # Self-signed certificate generator
├── certs/                  # Generated certificates (gitignored)
└── package.json
```

## Environment variables

| Variable | Default | Description  |
|----------|---------|--------------|
| `PORT`   | `3000`  | Server port  |
