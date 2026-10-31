# REALTIME ARCHITECTURE

## WebSocket Responsibilities
The WebSocket (`ws`) layer handles strictly volatile, real-time event dissemination. It is NOT a replacement for standard CRUD REST APIs.

Future WebSocket domains:
- Global broadcast notifications
- Social chat and typing indicators
- User presence tracking
- Live emulator telemetry (heartbeats and session updates)
- Owner live dashboard event streaming

Authentication on the WebSocket layer is derived from the standard HTTP-Only session cookie passed during the initial connection handshake.

