# Monitor de Classe – Heartbeat IPs via WebSockets

Aplicacio web de monitoratge de classe en temps real amb Node.js, Express i Socket.IO.

## Funcionalitats

- **Pagina de l'alumne** – Entrar amb codi d'acces, nom/cognom/DNI, captura de webcam, heartbeat i tancament de sessio.
- **Panell del professorat** – Monitoratge de fins a 25 alumnes amb estat tipus semafor, foto de webcam, IP i DNI (emmascarat).
- **Logica del semafor** (segons l'ultim heartbeat):
  - 🟢 **Verd** – < 2 s
  - 🟡 **Ambre** – 2–3 s
  - 🔴 **Vermell** – ≥ 3 s
- **HTTPS** – Suport per certificat autosignat perque `getUserMedia` funcioni a la LAN.

## Requisits previs

- Node.js ≥ 14
- npm
- openssl (per generar el certificat HTTPS)

## Configuracio

### 1. Instal·la dependencies

```bash
npm install
```

### 2. Genera un certificat autosignat (necessari per a la webcam a la LAN)

```bash
# nomes localhost
bash scripts/generate-cert.sh

# amb la IP de la teva LAN (recomanat)
bash scripts/generate-cert.sh 192.168.1.10
```

Aixo crea `certs/server.key` i `certs/server.cert` (gitignored).

> **Primera vegada al navegador**: ves a `https://<IP>:3000` (o `https://localhost:3000`) i accepta el certificat autosignat. Els alumnes han de fer el mateix als seus dispositius.

### 3. Engega el servidor

```bash
npm start
```

El servidor s'inicia al port **3000** (HTTPS si hi ha certificats; HTTP si no n'hi ha).

## Accessos

| Pagina            | URL                            |
|-------------------|--------------------------------|
| Panell professor  | `https://<LAN-IP>:3000/panel`  |
| Pagina alumne     | `https://<LAN-IP>:3000/join`   |

## Us

1. Obre el panell del professorat.
2. Llegeix el **codi d'acces** que apareix al capçal i comparteix-lo amb la classe.
3. Els alumnes entren a `/join`, accepten el certificat, permeten la camera i introdueixen el codi.
4. El panell s'actualitza en temps real.
5. Si cal, prem **"Nou codi"** per regenerar-lo i invalidar l'anterior.
6. Els alumnes poden **"Tancar sessio"**. La sessio s'elimina despres de 30 s d'inactivitat.

## Estructura del projecte

```
├── server.js               # Servidor Express + Socket.IO
├── public/
│   ├── student.html        # Pagina d'entrada de l'alumne
│   ├── student.js          # Logica de l'alumne (webcam, heartbeat, localStorage)
│   ├── panel.html          # Tauler de monitoratge del professorat
│   └── panel.js            # Logica del panell (graella en temps real)
├── scripts/
│   └── generate-cert.sh    # Generador de certificat autosignat
├── certs/                  # Certificats generats (gitignored)
└── package.json
```

## Variables d'entorn

| Variable | Defecte | Descripcio   |
|----------|---------|--------------|
| `PORT`   | `3000`  | Port del servidor |
