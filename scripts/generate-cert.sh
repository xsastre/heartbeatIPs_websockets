#!/usr/bin/env bash
# Generates a self-signed TLS certificate for development.
# Usage: bash scripts/generate-cert.sh [LAN_IP]
#   LAN_IP  Optional LAN IP to add as a Subject Alternative Name.
#           Example: bash scripts/generate-cert.sh 192.168.1.10

set -e

LAN_IP="${1:-}"
CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERT_DIR"

SAN="DNS:localhost,IP:127.0.0.1"
if [ -n "$LAN_IP" ]; then
  SAN="${SAN},IP:${LAN_IP}"
fi

openssl req -x509 -newkey rsa:2048 \
  -keyout "${CERT_DIR}/server.key" \
  -out    "${CERT_DIR}/server.cert" \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=${SAN}"

echo ""
echo "✅  Certificate generated in ${CERT_DIR}/"
echo "    Key:  ${CERT_DIR}/server.key"
echo "    Cert: ${CERT_DIR}/server.cert"
if [ -n "$LAN_IP" ]; then
  echo "    Includes SAN for IP: ${LAN_IP}"
fi


