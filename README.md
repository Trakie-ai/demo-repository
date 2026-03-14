# Trakie

AI-powered inventory receiving assistant for cannabis dispensaries. Trakie bridges a Chrome extension (on the POS workstation) with a mobile PWA (for scanning/photographing shipments) through a real-time relay server.

## Architecture

| Package | Stack | Purpose |
|---------|-------|---------|
| `extension/` | Chrome Extension (Manifest V3), TypeScript, Socket.IO | Runs on the POS workstation, reads/writes to Dutchie backoffice |
| `mobile/` | Next.js PWA, Tailwind CSS, Socket.IO | Phone-based camera interface for scanning & photographing inventory |
| `relay/` | Express, Socket.IO, Claude Vision API | Real-time relay between extension & mobile, AI-powered label reading |

## Getting Started

### Prerequisites
- Node.js 22+
- npm

### Relay Server
```bash
cd relay
cp .env.example .env   # Fill in ANTHROPIC_API_KEY
npm install
npm run dev             # Starts on http://localhost:3001
```

### Mobile PWA
```bash
cd mobile
cp .env.example .env
npm install
npm run dev             # Starts on http://localhost:3000
```

### Chrome Extension
```bash
cd extension
npm install
npm run build
# Load unpacked from extension/dist in chrome://extensions
```

## Environment Variables

See `.env.example` in the root and each package directory.
