# Trakie — Integration & API Overview

## What is Trakie?

Trakie is an invoice capture platform for cannabis retail. It pairs a **Chrome browser extension** with a **mobile Progressive Web App (PWA)** to let dispensary staff scan invoices directly from their phone and relay the captured data to their POS system — no manual entry, no desktop scanners.

## How It Works

```
┌──────────────┐       WebSocket        ┌───────────────┐       WebSocket        ┌──────────────┐
│   Mobile PWA │  ──────────────────►   │  Relay Server  │  ──────────────────►   │  Extension   │
│  (camera +   │    image:captured      │  (Socket.IO)   │    image:captured      │  (in-browser │
│  auto-scan)  │                        │                │                        │   POS tab)   │
└──────────────┘                        └───────────────┘                        └──────────────┘
     Phone                                  Cloud                                 Desktop / POS
```

1. **Staff opens the Trakie extension** inside their POS browser tab — a QR code appears.
2. **Staff scans the QR code** with their phone — the mobile PWA opens and pairs with the extension via a real-time relay.
3. **Staff points their phone camera at an invoice** — Trakie auto-detects document stability and captures the image hands-free.
4. **The captured image is relayed instantly** to the extension running alongside the POS, ready for processing.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Mobile PWA | Next.js, React 19, TypeScript |
| Browser Extension | Chrome Extension (Manifest V3), TypeScript |
| Relay Server | Node.js, Express, Socket.IO |
| Transport | WebSocket (Socket.IO) |
| Image Format | JPEG, base64-encoded |

## Real-Time API (Socket.IO Events)

Trakie uses **Socket.IO over WebSocket** for all real-time communication. The relay server acts as a stateless forwarder — it manages session rooms but holds no business logic.

### Session Management

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `session:join` | Client → Server | `{ sessionId: string, deviceType: "extension" \| "mobile" }` | Join a session room. Server responds with `{ ok: boolean, error?: string }`. |
| `session:paired` | Server → Client | `{ deviceType: "extension" \| "mobile" }` | Emitted to both devices when a session has two participants. |
| `session:device-disconnected` | Server → Client | `{ deviceType: "extension" \| "mobile" }` | Emitted to the remaining device when its partner disconnects. |

### Image Relay

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `image:captured` | Mobile → Server → Extension | `{ sessionId: string, imageData: string, captureType: "invoice" }` | Relays a captured invoice image. `imageData` is a base64 JPEG data URL. |

### Session Flow

```
Extension                    Relay Server                    Mobile PWA
    │                             │                              │
    │── session:join ────────────►│                              │
    │                             │◄──────────── session:join ───│
    │                             │                              │
    │◄─── session:paired ────────│──── session:paired ─────────►│
    │                             │                              │
    │                             │◄──────── image:captured ─────│
    │◄──── image:captured ───────│                              │
    │                             │                              │
```

## REST Endpoints

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| `GET` | `/health` | `{ status: "ok", timestamp: "<ISO 8601>" }` | Server health check |

## Image Capture Pipeline

The mobile PWA handles the full capture pipeline on-device:

1. **Camera Input** — Rear-facing camera, continuous frame analysis.
2. **Stability Detection** — Motion detection (pixel-level frame differencing) combined with document detection (edge density analysis). The system requires ~1 second of stability before auto-triggering.
3. **Compression** — Captured frame is scaled to max 1200px on the longest edge and encoded as JPEG at 85% quality.
4. **Relay** — Base64 image is sent over WebSocket to the paired extension.
5. **Feedback** — Haptic vibration (100ms) and visual flash confirm the capture to the user.

**Typical image payload:** 20–100 KB (base64-encoded JPEG).

## POS Integration (Proposed)

Trakie's extension runs alongside the POS in the same browser. The integration path with a POS partner like Dutchie would be:

- **Trakie captures** invoice images from the dispensary floor via mobile camera.
- **Trakie relays** the image to the browser extension in real time.
- **The extension** can pass the captured image data to the POS via:
  - DOM injection into the active POS tab
  - Dutchie's API endpoints (with partner API access)
  - A shared webhook or callback URL

### What Trakie Needs from a POS Partner

| Need | Description |
|------|-------------|
| Invoice upload endpoint | An API endpoint or UI entry point where Trakie can submit captured invoice images. |
| Authentication | API keys or OAuth credentials for authenticated access. |
| Product catalog access | Read access to the product catalog so Trakie can match scanned invoice line items to existing SKUs. |

### What Trakie Provides

| Capability | Description |
|------------|-------------|
| Hands-free invoice capture | Auto-detecting, auto-capturing mobile camera pipeline. |
| Real-time image relay | Sub-second delivery of captured images from phone to desktop browser. |
| In-browser extension | Runs alongside the POS — no separate app or hardware required. |
| Flexible image delivery | Base64 JPEG over WebSocket, adaptable to REST/webhook endpoints. |

## Architecture Principles

- **Stateless relay** — The server is a dumb forwarder; all intelligence lives on-device.
- **Room-based isolation** — Each session is a UUID-scoped room; no cross-session data leakage.
- **Type-safe contracts** — All Socket.IO events are defined via TypeScript interfaces.
- **No persistent storage** — The relay stores nothing; images pass through in transit only.
- **WebSocket-only transport** — Chosen for low latency and compatibility with real-time image relay.

## Contact

**Trakie, Inc.**
stevenfounder@trakie.ai
https://trakie.ai
