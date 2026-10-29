# CravePulse AI — Hyperlocal Food Discovery, Ordering, and Real-Time Tracking Platform

A production-grade, end-to-end TypeScript full-stack web application powered by **Gemini 2.5 Flash** (`@google/genai`) for personalized culinary recommendations, intelligent cart upsells, and predictive delivery window estimations.

---

## Core Architecture & Security Guarantees

1. **Dynamic Merchant & Menu Catalog (`/`, `/restaurant/:id`)**:
   - Geolocation-aware radial Haversine restaurant discovery across 8 culinary taxonomies (`Italian`, `South Asian`, `Pan-Asian`, `Mexican`, `American/Burgers`, `Middle Eastern`, `Healthy/Bowls`, `Artisanal Bakery`) and 8 strict dietary/lifestyle flags (`Vegan`, `Halal`, `Gluten-Free`, `Keto`, `Nut-Free`, `Dairy-Free`, `Low-FODMAP`, `Organic`).
   - Multi-category digital menus with required and optional modifier groups and real-time merchant inventory toggling.
2. **Zero-Trust Cart & Checkout Engine (`/cart`, `/checkout`, `server/src/services/order.service.ts`)**:
   - **Single-Merchant Integrity Enforcement**: Rejects mixed-restaurant carts on both client (with an explicit confirmation dialog to clear previous items) and server (`HTTP 409 MIXED_RESTAURANT_CART_FORBIDDEN`).
   - **Server-Side Price Recalculation**: Completely discards client-submitted prices and recalculates all dish base prices, modifier sums, promo codes (`HYPER10`, `WELCOME5`, `FREEDEL`), radial delivery fees, and sales tax strictly from database records.
3. **Deterministic Order Lifecycle State Machine & Live SSE Tracking (`/orders/:id/tracking`, `/merchant/portal`)**:
   - Enforces strict sequential transitions: `PENDING_PAYMENT -> PAID -> CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED | CANCELLED` with immutable database audit logging (`order_events`).
   - Streams real-time stage changes and live GPS courier telemetry over authenticated Server-Sent Events (`/api/orders/:id/live-tracking`).
4. **Gemini 2.5 Flash Culinary Concierge & Smart Cart Upsell (`/ai-concierge`, `server/src/services/ai.service.ts`)**:
   - Uses `@google/genai` (`gemini-2.5-flash`) with `responseMimeType: "application/json"` and `responseSchema` (`CulinaryRecommendationSchema` and `CartUpsellSchema`).

---

## Project Structure

```text
food-delivery-platform/
├── server/
│   ├── src/
│   │   ├── config/env.ts              # Zod startup environment validation
│   │   ├── controllers/               # Express REST & SSE controllers
│   │   ├── db/
│   │   │   ├── index.ts               # PostgreSQL pool + embedded relational store
│   │   │   ├── schema.sql             # Production DDL & Row-Level Security (RLS) policies
│   │   │   ├── seed-data.ts           # 6 restaurants, 14 categories, 34 menu items
│   │   │   └── migrate.ts             # Migration & seed runner
│   │   ├── lib/
│   │   │   ├── gemini.ts              # @google/genai initialization & response schemas
│   │   │   └── sse.ts                 # Authenticated SSE broadcast hub
│   │   ├── middleware/security.ts     # Auth context, AI rate limiter, error handler
│   │   ├── routes/api.routes.ts       # Express API route definitions
│   │   ├── services/
│   │   │   ├── order.service.ts       # Order state machine & zero-trust calculation engine
│   │   │   └── ai.service.ts          # Gemini 2.5 Flash recommendations & cart upsells
│   │   ├── tests/verify-platform.ts   # Phase 5 E2E acceptance & security test suite
│   │   └── index.ts                   # Express server entry point
├── client/
│   ├── src/
│   │   ├── api/client.ts              # Typed API client
│   │   ├── components/
│   │   │   ├── common/                # Navbar.tsx, AICulinaryConciergeModal.tsx
│   │   │   ├── discovery/             # RestaurantCard.tsx
│   │   │   ├── menu/                  # MenuSection.tsx, ItemCustomizerModal.tsx
│   │   │   ├── cart/                  # CartDrawer.tsx
│   │   │   ├── checkout/              # CheckoutForm.tsx
│   │   │   ├── tracking/              # OrderTrackingTimeline.tsx, LiveDriverMapSimulator.tsx
│   │   │   └── merchant/              # MerchantKanbanBoard.tsx
│   │   ├── context/store.ts           # Zustand persistent cart & location store
│   │   ├── pages/                     # 7 application routes
│   │   ├── App.tsx
│   │   └── main.tsx
└── shared/
    └── src/
        ├── types/index.ts             # Shared TypeScript domain contracts
        └── validators/order.ts        # Shared Zod v3 validation schemas
```

---

## Quickstart & Verification

```bash
# 1. Install workspace dependencies
npm install

# 2. Run PostgreSQL schema migration & seed fixtures
npm run db:migrate

# 3. Run Phase 5 End-to-End Acceptance & Security Verification Suite
npm test

# 4. Run Backend & Frontend Development Servers
npm run dev:server
npm run dev:client
```
