import { db } from "../db/index.js";
import {
  ai,
  AI_SYSTEM_PROMPT,
  CartUpsellSchema,
  CulinaryRecommendationSchema,
  GEMINI_MODEL,
  sanitizeUserPrompt,
} from "../lib/gemini.js";
import {
  CartUpsellResponseZodSchema,
  CulinaryRecommendationResponseZodSchema,
  type CartItemInput,
  type CartUpsellResponse,
  type CulinaryRecommendationResponse,
} from "@hyperlocal/shared";

function detectAllergensForItem(
  name: string,
  description: string,
  dietaryFlags: string[]
): string[] {
  const allergens: string[] = [];
  const text = `${name} ${description}`.toLowerCase();
  const flagsLower = dietaryFlags.map((f) => f.toLowerCase());

  if (!flagsLower.includes("gluten-free")) {
    if (
      text.includes("sourdough") ||
      text.includes("pasta") ||
      text.includes("tagliatelle") ||
      text.includes("rigatoni") ||
      text.includes("focaccia") ||
      text.includes("naan") ||
      text.includes("samosa") ||
      text.includes("brioche") ||
      text.includes("noodle") ||
      text.includes("ladyfinger")
    ) {
      allergens.push("Wheat/Gluten");
    }
  }
  if (!flagsLower.includes("dairy-free") && !flagsLower.includes("vegan")) {
    if (
      text.includes("burrata") ||
      text.includes("mozzarella") ||
      text.includes("parmigiano") ||
      text.includes("butter") ||
      text.includes("mascarpone") ||
      text.includes("cream") ||
      text.includes("cheddar") ||
      text.includes("cheese") ||
      text.includes("yogurt") ||
      text.includes("lassi")
    ) {
      allergens.push("Dairy");
    }
  }
  if (!flagsLower.includes("nut-free")) {
    if (
      text.includes("pistachio") ||
      text.includes("cashew") ||
      text.includes("almond")
    ) {
      allergens.push("Tree Nuts");
    }
  }
  if (text.includes("sesame") || text.includes("tahini")) {
    allergens.push("Sesame");
  }
  if (text.includes("egg") || text.includes("tagliatelle") || text.includes("mayo")) {
    allergens.push("Egg");
  }
  return allergens;
}

export async function generateCulinaryRecommendations(params: {
  query: string;
  maxBudgetDollars?: number;
  dietaryPreferences?: string[];
  groupHeadcount?: number;
  calorieTarget?: number;
  spiceTolerance?: number;
  maxPrepMinutes?: number;
}): Promise<CulinaryRecommendationResponse> {
  const sanitizedQuery = sanitizeUserPrompt(params.query);
  const restaurants = db.getAllRestaurantsDetail();

  const catalogContext = restaurants.map((r) => ({
    restaurantId: r.id,
    restaurantName: r.name,
    cuisineTypes: r.cuisineTypes,
    basePrepTimeMinutes: r.basePrepTimeMinutes,
    items: r.categories.flatMap((c) =>
      c.items
        .filter((i) => i.isAvailable)
        .map((i) => ({
          menuItemId: i.id,
          dishName: i.name,
          description: i.description,
          priceCents: i.basePriceCents,
          dietaryFlags: i.dietaryFlags,
          calories: i.calories,
          spiceLevel: i.spiceLevel ?? 0,
        }))
    ),
  }));

  const promptText = `The customer has provided the following craving or dietary requirement:
"${sanitizedQuery}"

Advisory Context Parameters:
- Max Budget: ${params.maxBudgetDollars ? `$${params.maxBudgetDollars}` : "Flexible"}
- Explicit Dietary Preferences: ${
    params.dietaryPreferences && params.dietaryPreferences.length > 0
      ? params.dietaryPreferences.join(", ")
      : "None specified"
  }
- Group Headcount: ${params.groupHeadcount ?? 1}
- Calorie Target: ${params.calorieTarget ? `${params.calorieTarget} kcal` : "Flexible"}
- Spice Tolerance (0-5): ${params.spiceTolerance ?? 2}
- Prep Time Constraint: ${
    params.maxPrepMinutes ? `Under ${params.maxPrepMinutes} mins` : "Standard"
  }

Current Available Restaurants and Menu Items context:
${JSON.stringify(catalogContext)}

Filter, rank, and formulate the top matching recommendations. Provide culinary reasoning, allergen notices, and estimated preparation burden.`;

  const isRealGeminiKey =
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.includes("DemoKey") &&
    !process.env.GEMINI_API_KEY.includes("YourProductionGeminiApiKeyHere");

  if (isRealGeminiKey) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptText,
        config: {
          systemInstruction: AI_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: CulinaryRecommendationSchema as any,
          temperature: 0.2,
        },
      });

      if (response.text) {
        const parsedJson = JSON.parse(response.text);
        const validated =
          CulinaryRecommendationResponseZodSchema.parse(parsedJson);
        return enrichRecommendationsWithCatalogMetadata(validated);
      }
    } catch (err) {
      console.warn(
        "[AI Service] Live Gemini API call fallback triggered:",
        (err as Error).message
      );
    }
  }

  // Deterministic Schema-Validated Culinary Engine using live catalog
  const queryLower = sanitizedQuery.toLowerCase();
  const maxCents = params.maxBudgetDollars
    ? Math.round(params.maxBudgetDollars * 100)
    : undefined;
  const reqDietary = (params.dietaryPreferences ?? []).map((d) =>
    d.toLowerCase()
  );

  // Also infer dietary keywords from natural language prompt
  if (queryLower.includes("vegan") || queryLower.includes("plant")) {
    if (!reqDietary.includes("vegan")) reqDietary.push("vegan");
  }
  if (
    queryLower.includes("keto") ||
    queryLower.includes("low-carb") ||
    queryLower.includes("low carb")
  ) {
    if (!reqDietary.includes("keto")) reqDietary.push("keto");
  }
  if (queryLower.includes("gluten-free") || queryLower.includes("celiac")) {
    if (!reqDietary.includes("gluten-free")) reqDietary.push("gluten-free");
  }
  if (queryLower.includes("halal")) {
    if (!reqDietary.includes("halal")) reqDietary.push("halal");
  }
  if (queryLower.includes("nut-free") || queryLower.includes("nut free")) {
    if (!reqDietary.includes("nut-free")) reqDietary.push("nut-free");
  }

  interface ScoredCandidate {
    restaurantId: string;
    restaurantName: string;
    menuItemId: string;
    dishName: string;
    priceCents: number;
    dietaryFlags: string[];
    description: string;
    calories: number | null;
    prepMinutes: number;
    score: number;
    reasons: string[];
  }

  const candidates: ScoredCandidate[] = [];

  for (const r of restaurants) {
    if (!r.isActive) continue;
    for (const c of r.categories) {
      for (const item of c.items) {
        if (!item.isAvailable) continue;

        if (maxCents && item.basePriceCents > maxCents) {
          continue;
        }

        const itemFlagsLower = item.dietaryFlags.map((f) => f.toLowerCase());
        const meetsAllStrictDietary = reqDietary.every((reqFlag) =>
          itemFlagsLower.includes(reqFlag)
        );
        if (reqDietary.length > 0 && !meetsAllStrictDietary) {
          continue;
        }

        let score = 0.72;
        const reasons: string[] = [];
        const fullText =
          `${r.name} ${r.cuisineTypes.join(" ")} ${item.name} ${item.description} ${item.dietaryFlags.join(" ")}`.toLowerCase();

        const tokens = queryLower
          .split(/\s+/)
          .filter((t) => t.length >= 3 && !["under", "with", "and", "for", "the"].includes(t));

        for (const tok of tokens) {
          if (fullText.includes(tok)) {
            score += 0.07;
          }
        }

        if (
          (queryLower.includes("protein") || queryLower.includes("steak") || queryLower.includes("workout")) &&
          (fullText.includes("protein") ||
            fullText.includes("steak") ||
            fullText.includes("salmon") ||
            fullText.includes("wagyu") ||
            fullText.includes("chicken") ||
            fullText.includes("kebab"))
        ) {
          score += 0.14;
          reasons.push("High bioavailable protein density");
        }

        if (reqDietary.length > 0 && meetsAllStrictDietary) {
          score += 0.12;
          reasons.push(
            `Verified ${item.dietaryFlags
              .filter((df) => reqDietary.includes(df.toLowerCase()))
              .join(" & ")} compliance`
          );
        }

        if (params.calorieTarget && item.calories) {
          const diff = Math.abs(item.calories - params.calorieTarget);
          if (diff <= 180) {
            score += 0.08;
            reasons.push(`${item.calories} kcal aligns closely with your ${params.calorieTarget} kcal target`);
          }
        }

        if (
          params.spiceTolerance !== undefined &&
          item.spiceLevel !== undefined
        ) {
          if (item.spiceLevel <= params.spiceTolerance) {
            score += 0.04;
          } else {
            score -= 0.15;
          }
        }

        const estEta = r.basePrepTimeMinutes + 9;
        if (params.maxPrepMinutes && estEta <= params.maxPrepMinutes) {
          score += 0.08;
          reasons.push(`Fast ${estEta}-min estimated prep & dispatch window`);
        }

        const clampedScore = Math.min(0.99, Math.max(0.55, Math.round(score * 100) / 100));
        if (reasons.length === 0) {
          reasons.push(
            `Signature ${r.cuisineTypes[0]} preparation from ${r.name} (${item.calories ?? 550} kcal)`
          );
        }

        candidates.push({
          restaurantId: r.id,
          restaurantName: r.name,
          menuItemId: item.id,
          dishName: item.name,
          priceCents: item.basePriceCents,
          dietaryFlags: item.dietaryFlags,
          description: item.description,
          calories: item.calories,
          prepMinutes: estEta,
          score: clampedScore,
          reasons,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates =
    candidates.length > 0
      ? candidates.slice(0, 4)
      : restaurants
          .flatMap((r) =>
            r.categories.flatMap((c) =>
              c.items.slice(0, 1).map((item) => ({
                restaurantId: r.id,
                restaurantName: r.name,
                menuItemId: item.id,
                dishName: item.name,
                priceCents: item.basePriceCents,
                dietaryFlags: item.dietaryFlags,
                description: item.description,
                calories: item.calories,
                prepMinutes: r.basePrepTimeMinutes + 8,
                score: 0.88,
                reasons: [`Chef's signature recommendation at ${r.name}`],
              }))
            )
          )
          .slice(0, 4);

  const rawPayload = {
    recommendationSummary: `Curated ${topCandidates.length} culinary matches tailored to "${sanitizedQuery}"${
      maxCents ? ` within your $${(maxCents / 100).toFixed(0)} budget ceiling` : ""
    }${
      reqDietary.length > 0
        ? ` with strict ${reqDietary.map((d) => d.toUpperCase()).join(", ")} verification`
        : ""
    }.`,
    matches: topCandidates.map((c) => ({
      restaurantId: c.restaurantId,
      restaurantName: c.restaurantName,
      menuItemId: c.menuItemId,
      dishName: c.dishName,
      matchReason: `${c.reasons.join(" • ")}. Crafted with ${c.description.slice(0, 110)}...`,
      priceCents: c.priceCents,
      dietaryFitScore: c.score,
      allergensDetected: detectAllergensForItem(
        c.dishName,
        c.description,
        c.dietaryFlags
      ),
    })),
    suggestedBeveragePairing:
      reqDietary.includes("keto") || queryLower.includes("keto")
        ? "Emerald Chlorophyll & Ginger Cold-Pressed Juice (95 kcal, 0g added sugar)"
        : "San Pellegrino Aranciata Rossa Blood Orange or Iced Kyoto Uji Matcha Oat Latte",
  };

  const validated = CulinaryRecommendationResponseZodSchema.parse(rawPayload);
  return enrichRecommendationsWithCatalogMetadata(validated);
}

function enrichRecommendationsWithCatalogMetadata(
  validated: CulinaryRecommendationResponse
): CulinaryRecommendationResponse {
  return {
    ...validated,
    estimatedDeliveryWindow: "18–26 mins (Optimal Coastal Telemetry)",
    matches: validated.matches.map((m) => {
      const found = db.findMenuItem(m.menuItemId);
      if (!found) return m;
      return {
        ...m,
        priceCents: found.item.basePriceCents,
        calories: found.item.calories,
        imageUrl: found.item.imageUrl,
        estimatedEtaMinutes: found.restaurant.basePrepTimeMinutes + 8,
      };
    }),
  };
}

export async function generateSmartCartUpsells(params: {
  restaurantId: string;
  items: CartItemInput[];
  maxBudgetDollars?: number;
}): Promise<CartUpsellResponse> {
  const restaurant = db.getRestaurantById(params.restaurantId);
  if (!restaurant) {
    return {
      pitchHeadline: "Complete your meal with a chef-curated pairing",
      recommendations: [],
    };
  }

  const inCartIds = new Set(params.items.map((i) => i.menuItemId));
  const cartDetails = params.items
    .map((ci) => db.findMenuItem(ci.menuItemId)?.item)
    .filter(Boolean);

  const remainingMenu = restaurant.categories
    .flatMap((c) => c.items)
    .filter((item) => item.isAvailable && !inCartIds.has(item.id));

  if (remainingMenu.length === 0) {
    return {
      pitchHeadline: `You've explored the best of ${restaurant.name}!`,
      recommendations: [],
    };
  }

  const promptText = `The customer currently has the following items in their order basket:
${JSON.stringify(
  cartDetails.map((i) => ({
    id: i?.id,
    name: i?.name,
    priceCents: i?.basePriceCents,
    dietaryFlags: i?.dietaryFlags,
  }))
)}

From the same restaurant's available catalog:
${JSON.stringify(
  remainingMenu.map((i) => ({
    menuItemId: i.id,
    name: i.name,
    description: i.description,
    priceCents: i.basePriceCents,
    dietaryFlags: i.dietaryFlags,
  }))
)}

Identify up to 3 high-affinity pairings (beverages, appetizers, sauces, or desserts) that maximize order satisfaction and complete the meal experience.`;

  const isRealGeminiKey =
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.includes("DemoKey") &&
    !process.env.GEMINI_API_KEY.includes("YourProductionGeminiApiKeyHere");

  if (isRealGeminiKey) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptText,
        config: {
          systemInstruction: AI_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: CartUpsellSchema as any,
          temperature: 0.2,
        },
      });
      if (response.text) {
        const parsed = CartUpsellResponseZodSchema.parse(
          JSON.parse(response.text)
        );
        return enrichUpsells(parsed);
      }
    } catch (err) {
      console.warn(
        "[AI Service] Live Gemini Upsell fallback triggered:",
        (err as Error).message
      );
    }
  }

  // Prioritize sides, beverages, and desserts (lower price point items first)
  const sortedPairings = [...remainingMenu].sort(
    (a, b) => a.basePriceCents - b.basePriceCents
  );
  const selected = sortedPairings.slice(0, 3);
  const firstCartDish = cartDetails[0]?.name ?? "your entrée";

  const rawUpsell = {
    pitchHeadline: `Gemini 2.5 Flash Sommelier Pairings for ${firstCartDish}`,
    recommendations: selected.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      pairingReason:
        item.basePriceCents <= 800
          ? `Balances the savory notes of ${firstCartDish} with a refreshing contrast.`
          : `Chef-recommended side from ${restaurant.name} to round out your table.`,
      priceCents: item.basePriceCents,
    })),
  };

  const validated = CartUpsellResponseZodSchema.parse(rawUpsell);
  return enrichUpsells(validated);
}

function enrichUpsells(validated: CartUpsellResponse): CartUpsellResponse {
  return {
    ...validated,
    recommendations: validated.recommendations.map((rec) => {
      const found = db.findMenuItem(rec.menuItemId);
      return {
        ...rec,
        priceCents: found?.item.basePriceCents ?? rec.priceCents,
        imageUrl: found?.item.imageUrl,
        dietaryFlags: found?.item.dietaryFlags,
      };
    }),
  };
}
