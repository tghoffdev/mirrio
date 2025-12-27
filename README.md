# Doppelist

> Record. Test. Personalize. A sandbox for rich media ad creatives.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

---

## Overview

Doppelist streamlines the QA and asset capture workflow for digital advertising. Load MRAID tags or HTML5 zip bundles, preview at any size, inspect macros and events, edit DCO text live, and export screenshots or video recordings—all client-side.

## Features

**Preview & Rendering**
- MRAID 3.0 mock environment with full event simulation
- HTML5 zip upload via service worker (no server required)
- IAB standard size presets + custom dimensions
- Live background and border color controls

**Audit & Inspection**
- Automatic macro detection with inline editing
- DCO text scanning and live DOM manipulation
- Real-time MRAID event logging (clicks, expand, video, etc.)
- Vendor detection (Celtra, Google, Flashtalking, Sizmek)

**Capture & Export**
- Screenshot capture with batch multi-size export
- Video recording with region cropping (clip mode)
- Client-side MP4 conversion via FFmpeg WASM
- WebM and MP4 output formats

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI Primitives |
| Video Processing | FFmpeg WASM |
| Icons | Lucide React |

## Browser Support

- Chrome/Edge 90+ (recommended)
- Firefox 90+
- Safari 15+

Region capture (clip mode) requires Chromium-based browsers with `getDisplayMedia` crop target support.

## License

MIT

---

Built by [Tommy Hoffman](https://tommyhoffman.io) · [@tghoffdev](https://x.com/tghoffdev)
