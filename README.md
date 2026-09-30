# Scalio — USDT Card

**Spend crypto in real time, directly from your Trust Wallet.**

Scalio is a non-custodial USDT crypto payment card. Instead of preloading or converting crypto into fiat, the card debits USDT from the user's self-custody Trust Wallet at the moment of purchase, over the Visa / Mastercard network. This repository is the product's marketing and activation website.

---

## Overview

| | |
|---|---|
| **Product** | Non-custodial USDT payment card |
| **Wallet** | Trust Wallet (TRC-20, ERC-20, BEP-20) |
| **Fees** | $0 joining fee, $0 annual fee (lifetime free) |
| **Payments** | Apple Pay and Google Pay, worldwide POS and online |
| **Rewards** | Instant USDT joining bonus on activation, plus cashback on every spend |

### Card tiers

| | Scalio Core | Scalio Pro | Scalio Max |
|---|---|---|---|
| Trust Wallet balance | $1,000 USDT | $5,000 USDT | $10,000 USDT |
| Instant joining bonus | 10% | 15% | 20% |
| Everyday cashback | 2% | 5% | 10% |
| Support | Standard | 24/7 Priority | Dedicated VIP Concierge |

### Why Scalio

- **100% non-custodial:** funds stay under the user's keys until the moment of payment.
- **No top-ups or preloading:** direct, real-time settlement at the point of sale.
- **Zero maintenance fees:** $0 joining and $0 annual fee on every tier.

---

## The website

A single-page site with a scroll-driven 3D hero and a glassmorphism UI in a dark theme.

- **Hero:** a WebGL stack of the three tier cards that fans, slides, spreads in depth and turns as you scroll through six frames (cover, card, tiers, zero fees, tap & pay, activate). The cards always stay in separate parallel planes, so they never intersect.
- **Site-wide background:** a full-screen light-trail effect (Covelight, rendered with three.js) fixed behind every section.
- **Sections:** stats, comparison table, tier cards, how it works, security, FAQ, call to action and footer.
- **Glassmorphism and hover effects:** frosted cards with 3D tilt and a cursor-following spotlight, magnetic buttons, card shine sweeps.
- **Dark theme:** black and white with Scalio blue (`#2C3480`) as the accent colour.
- **Responsive:** laid out and tested for phone widths, with touch-friendly behaviour (no sticky hover states).
- **Accessible motion:** animations stop or simplify for visitors who prefer reduced motion.

---

## Tech stack

**Front end**
- React 19 and Vite
- TypeScript (for the UI components) with JavaScript for the page shell
- GSAP with ScrollTrigger and `@gsap/react` for scroll reveals, counters, parallax and magnetic buttons
- Raw WebGL (hand-written shaders) for the 3D card stack
- three.js for the light-trail background
- Tailwind CSS v4 (utilities only) and plain CSS variables for theming
- shadcn-style project structure (`@/components/ui`, `@/lib/utils`)

**Back end**
- Node.js with Express 5
- REST API for tier data, FAQs and card-activation sign-ups
- Serves the built front end in production

---

## Project structure

```
scalio card/
├── client/                      React + Vite front end
│   ├── public/scalio-logo.webp  Brand logo
│   └── src/
│       ├── App.jsx              Page, sections, GSAP animations
│       ├── index.css            Design tokens, dark theme, responsive styles
│       ├── components/
│       │   ├── Card.jsx         CSS card used in tier boxes and security section
│       │   ├── Badge.jsx        Rotating text badge
│       │   └── ui/
│       │       ├── scalio-card-specimen.tsx   Scroll-scrubbed 3D card hero (WebGL)
│       │       └── covelight.tsx              Light-trail background (three.js)
│       └── lib/utils.ts
└── server/
    └── index.js                 Express API + static hosting
```

---

## Getting started

Requires Node.js 20 or later.

```bash
# 1. install dependencies
cd client && npm install
cd ../server && npm install

# 2. build the front end
cd ../client && npm run build

# 3. start the server (serves the site and the API)
cd ../server && npm start
```

Open http://localhost:5000.

For development with hot reload, run `npm run dev` in `server` (API on port 5000) and `npm run dev` in `client` (site on http://localhost:5173, which proxies `/api` to the server).

### API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/tiers` | The three card tiers |
| `GET` | `/api/faqs` | Frequently asked questions |
| `POST` | `/api/activate` | Join the activation list: `{ "tier": "core" \| "pro" \| "max", "email": "..." }` |

Sign-ups are kept in memory only; connect a database before using this in production.

---

## Deploying to Vercel

1. Import the repo in Vercel and set **Root Directory** to `client`. The framework (Vite), build command (`npm run build`) and output (`dist`) are then detected automatically.
2. The API is deployed as serverless functions from `client/api/` (`/api/tiers`, `/api/faqs`, `/api/activate`), so the Express server in `server/` is only needed for local development.
3. Sign-ups are validated but not stored on Vercel (functions have no shared memory); connect a database to keep them.

---

## My contribution

I designed and built this website end to end:

- Turned the supplied UI / UX design and the Scalio product specification into a working React and Node.js application.
- Built the scroll-driven 3D card hero in raw WebGL: procedural card geometry, custom shaders, card faces painted from live tier data, and a motion system that keeps the cards in parallel planes so they never intersect.
- Ported a Framer light-trail component (Covelight) to a standalone React + three.js component and used it as the site-wide background.
- Implemented the animation layer with GSAP: scroll-triggered reveals, parallax, counters, magnetic buttons and 3D tilt.
- Designed the glassmorphism design system and its dark theme using CSS variables.
- Made the whole site responsive and touch-friendly, and verified it at phone width.
- Built the Express API for tiers, FAQs and activation sign-ups, and integrated it with the front end.

---

## Author

**Harsh Raj**
SDE · AI Engineer

---

© 2026 Scalio. All rights reserved.
