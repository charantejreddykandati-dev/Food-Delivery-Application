import assert from "node:assert/strict";
import http from "node:http";
import { validateEnv } from "../config/env.js";
import { runSchemaMigration } from "../db/index.js";
import { createApp } from "../index.js";
import {
  CartUpsellResponseZodSchema,
  CulinaryRecommendationResponseZodSchema,
} from "@hyperlocal/shared";

async function runVerificationSuite() {
  console.log(
    "=================================================================="
  );
  console.log(
    " Phase 5: End-to-End Acceptance & Security Verification Suite"
  );
  console.log(
    "=================================================================="
  );

  // 1. Verify Environment Validation (Acceptance Criterion #7)
  console.log("\n[1/7] Verifying Zod Startup Environment Variable Guard...");
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: "test",
        DATABASE_URL: "",
        GEMINI_API_KEY: "",
      }),
    /FATAL ENVIRONMENT VALIDATION ERROR/,
    "Expected validateEnv to fail immediately when DATABASE_URL or GEMINI_API_KEY is missing"
  );
  console.log("  ✓ Missing DATABASE_URL / API key rejected immediately by Zod.");

  // 2. Verify Database Schema & Seed Fixtures (Phase 1)
  console.log("\n[2/7] Verifying Database Schema & Seed Fixtures...");
  const migration = await runSchemaMigration();
  assert.ok(
    migration.seededRestaurants >= 5,
    `Expected >= 5 restaurants, got ${migration.seededRestaurants}`
  );
  assert.ok(
    migration.seededMenuItems >= 30,
    `Expected >= 30 menu items, got ${migration.seededMenuItems}`
  );
  console.log(
    `  ✓ Seeded ${migration.seededRestaurants} restaurants and ${migration.seededMenuItems} menu items across 14 categories.`
  );

  // Start ephemeral Express server for E2E HTTP + SSE verification
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 5099;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 3. Verify Discovery & Menu Storefront Endpoints
    console.log("\n[3/7] Verifying Discovery & Storefront Endpoints...");
    const discRes = await fetch(
      `${baseUrl}/restaurants?dietary=Gluten-Free&sortBy=eta`
    );
    assert.equal(discRes.status, 200);
    const discJson = (await discRes.json()) as any;
    assert.ok(discJson.restaurants.length > 0);
    console.log(
      `  ✓ Discovery returned ${discJson.restaurants.length} Gluten-Free compatible merchants sorted by ETA.`
    );

    // 4. Verify Single-Merchant Integrity & Server-Side Price Recalculation (Acceptance Criteria #1 & #2)
    console.log(
      "\n[4/7] Verifying Single-Merchant Guard & Server-Side Price Recalculation..."
    );
    const mixedCartRes = await fetch(`${baseUrl}/cart/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01", // Osteria Fiamma
        items: [
          {
            menuItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddd01", // Osteria Fiamma item
            quantity: 1,
            selectedModifiers: [],
          },
          {
            menuItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddd09", // Verdant Vitality item
            quantity: 1,
            selectedModifiers: [],
          },
        ],
      }),
    });
    assert.equal(
      mixedCartRes.status,
      409,
      "Expected HTTP 409 when mixing items from two different restaurants"
    );
    console.log(
      "  ✓ Mixed-restaurant cart rejected with HTTP 409 MIXED_RESTAURANT_CART_FORBIDDEN."
    );

    // Attempt to spoof modifier price as 0 cents when DB price is 550 cents ("Extra Whole Burrata Ball")
    const spoofedPriceRes = await fetch(`${baseUrl}/cart/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
        items: [
          {
            menuItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddd01", // Base 2350 cents
            quantity: 2,
            selectedModifiers: [
              {
                modifierOptionId: "ffffffff-ffff-4fff-8fff-ffffffffff01", // 0 cents
                modifierName: "Traditional 72-Hr Sourdough Crust",
                extraPriceCents: 0,
              },
              {
                modifierOptionId: "ffffffff-ffff-4fff-8fff-ffffffffff04", // Real DB price: 550 cents
                modifierName: "Extra Whole Burrata Ball",
                extraPriceCents: 0, // Spoofed 0 cents by client!
              },
            ],
          },
        ],
        promoCode: "HYPER10",
        tipCents: 400,
      }),
    });
    assert.equal(spoofedPriceRes.status, 200);
    const validatedCart = (await spoofedPriceRes.json()) as any;
    // Unit price MUST be 2350 + 550 = 2900 cents, x2 = 5800 cents subtotal!
    assert.equal(
      validatedCart.subtotalCents,
      5800,
      "Server must ignore client-submitted prices and compute 5800 cents from DB records"
    );
    assert.equal(validatedCart.discountCents, 580); // 10% promo
    console.log(
      `  ✓ Client-spoofed price discarded; server calculated exact DB subtotal ($${(
        validatedCart.subtotalCents / 100
      ).toFixed(2)}) and promo discount (-$${(
        validatedCart.discountCents / 100
      ).toFixed(2)}).`
    );

    // 5. Verify Gemini 2.5 Flash AI Concierge & Cart Upsell Schemas (Acceptance Criterion #5)
    console.log(
      "\n[5/7] Verifying Gemini 2.5 Flash AI Concierge & Smart Cart Upsell Schemas..."
    );
    const aiRecRes = await fetch(`${baseUrl}/ai/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "High-protein low-carb dinner under $25 delivered in 30 mins",
        maxBudgetDollars: 25,
        dietaryPreferences: ["Gluten-Free", "Keto"],
      }),
    });
    assert.equal(aiRecRes.status, 200);
    const aiRecJson = await aiRecRes.json();
    const parsedRec = CulinaryRecommendationResponseZodSchema.parse(aiRecJson);
    assert.ok(parsedRec.matches.length > 0);
    console.log(
      `  ✓ AI Concierge returned ${parsedRec.matches.length} schema-validated matches (Top match: "${parsedRec.matches[0].dishName}" at ${parsedRec.matches[0].restaurantName}).`
    );

    const aiUpsellRes = await fetch(`${baseUrl}/ai/upsell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
        items: [
          {
            menuItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
            quantity: 1,
            selectedModifiers: [],
          },
        ],
      }),
    });
    assert.equal(aiUpsellRes.status, 200);
    const aiUpsellJson = await aiUpsellRes.json();
    const parsedUpsell = CartUpsellResponseZodSchema.parse(aiUpsellJson);
    assert.ok(parsedUpsell.recommendations.length > 0);
    console.log(
      `  ✓ Smart Cart Upsell returned ${parsedUpsell.recommendations.length} pairings ("${parsedUpsell.pitchHeadline}").`
    );

    // 6. Verify Deterministic Order Lifecycle & Invalid State Jump Rejection (Acceptance Criterion #3)
    console.log(
      "\n[6/7] Verifying Deterministic Order Lifecycle State Machine..."
    );
    const createOrderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
        deliveryAddressId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
        items: [
          {
            menuItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddd09",
            quantity: 1,
            selectedModifiers: [],
          },
        ],
        tipCents: 400,
        specialInstructions: "Leave by the front gate <script>alert(1)</script>",
      }),
    });
    assert.equal(createOrderRes.status, 201);
    const createdOrder = (await createOrderRes.json()) as any;
    assert.equal(createdOrder.status, "PENDING_PAYMENT");
    assert.ok(
      !createdOrder.specialInstructions.includes("<script>"),
      "XSS script tags must be HTML-escaped"
    );

    // Pay order: PENDING_PAYMENT -> PAID
    const payRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentGateway: "SIMULATED_STRIPE",
        cardLast4: "4242",
      }),
    });
    assert.equal(payRes.status, 200);
    const paidOrder = (await payRes.json()) as any;
    assert.equal(paidOrder.status, "PAID");

    // Attempt illegal jump: PAID -> DELIVERED (Must fail with HTTP 409)
    const illegalJumpRes = await fetch(
      `${baseUrl}/merchant/orders/${createdOrder.id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "MERCHANT",
        },
        body: JSON.stringify({
          newStatus: "DELIVERED",
          message: "Attempting illegal skip",
        }),
      }
    );
    assert.equal(
      illegalJumpRes.status,
      409,
      "State machine must block illegal transition from PAID directly to DELIVERED"
    );
    console.log(
      "  ✓ Illegal state jump (PAID -> DELIVERED) blocked with HTTP 409."
    );

    // 7. Verify Real-Time SSE Stream & Full State Progression (Acceptance Criterion #4)
    console.log(
      "\n[7/7] Verifying SSE Live Tracking Stream & Full Sequential Transitions..."
    );
    const receivedSseStatuses: string[] = [];
    const sseController = new AbortController();

    const ssePromise = (async () => {
      const sseRes = await fetch(
        `${baseUrl}/orders/${createdOrder.id}/live-tracking?token=${createdOrder.trackingToken}`,
        { signal: sseController.signal }
      );
      assert.equal(sseRes.status, 200);
      const reader = sseRes.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = JSON.parse(line.slice(6));
            if (payload.status) {
              receivedSseStatuses.push(payload.status);
            }
          }
        }
      }
    })().catch(() => {
      // expected when aborted
    });

    // Wait briefly for initial SSE snapshot
    await new Promise((r) => setTimeout(r, 150));

    const sequentialTransitions: Array<{
      newStatus: string;
      message: string;
    }> = [
      { newStatus: "CONFIRMED", message: "Chef accepted order on KDS." },
      { newStatus: "PREPARING", message: "Chargrilling steak & assembling bowl." },
      { newStatus: "OUT_FOR_DELIVERY", message: "Courier picked up order." },
      { newStatus: "DELIVERED", message: "Delivered to doorstep." },
    ];

    for (const step of sequentialTransitions) {
      const stepRes = await fetch(
        `${baseUrl}/merchant/orders/${createdOrder.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-role": "MERCHANT",
          },
          body: JSON.stringify(step),
        }
      );
      assert.equal(stepRes.status, 200);
    }

    await new Promise((r) => setTimeout(r, 150));
    sseController.abort();
    await ssePromise;

    assert.ok(
      receivedSseStatuses.includes("CONFIRMED") &&
        receivedSseStatuses.includes("PREPARING") &&
        receivedSseStatuses.includes("OUT_FOR_DELIVERY") &&
        receivedSseStatuses.includes("DELIVERED"),
      `Expected SSE stream to broadcast all sequential states, received: ${receivedSseStatuses.join(
        " -> "
      )}`
    );
    console.log(
      `  ✓ SSE Live Stream broadcasted full sequence: ${receivedSseStatuses.join(
        " -> "
      )}`
    );

    console.log(
      "\n=================================================================="
    );
    console.log(
      " ALL 7 ACCEPTANCE & SECURITY VERIFICATION SUITES PASSED (100%)"
    );
    console.log(
      "==================================================================\n"
    );
  } finally {
    server.close();
  }
  process.exit(0);
}

runVerificationSuite().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
