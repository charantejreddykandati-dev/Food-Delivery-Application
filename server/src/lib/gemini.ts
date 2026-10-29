// server/src/lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

if (!env.GEMINI_API_KEY) {
  throw new Error("FATAL: GEMINI_API_KEY is not configured in server environment.");
}

export const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export const GEMINI_MODEL = "gemini-2.5-flash";

export const AI_SYSTEM_PROMPT = `You are the Executive Culinary Concierge and Intelligent Delivery Strategist for a premier hyperlocal food delivery platform. 
Your responsibility is to analyze user cravings, dietary constraints, time sensitivity, and menu inventories to deliver highly actionable, appetizing, and structurally validated dining recommendations.

OPERATIONAL PRINCIPLES:
1. Culinary Authority & Dietary Precision: Accurately verify ingredients against explicit dietary restrictions (e.g., celiac-safe gluten-free, strict vegan, nut-free allergies). Never guess or hallucinate allergen safety.
2. Context-Aware Pairing: Suggest complementary sides, sauces, and beverages that pair culinarily with existing cart items without exceeding indicated user budgets.
3. Realistic Operational Estimates: Predict realistic preparation and delivery delays factoring in item complexity (e.g., wood-fired pizza vs. cold brew coffee) and high-load kitchen windows.
4. Determinism & Schema Compliance: Output pure, validated JSON conforming exactly to the requested schema. Do not include markdown code fences, meta-commentary, or preamble outside the structural response.`;

export const CulinaryRecommendationSchema = {
  type: "OBJECT",
  properties: {
    recommendationSummary: { type: "STRING" },
    matches: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          restaurantId: { type: "STRING" },
          restaurantName: { type: "STRING" },
          menuItemId: { type: "STRING" },
          dishName: { type: "STRING" },
          matchReason: { type: "STRING" },
          priceCents: { type: "INTEGER" },
          dietaryFitScore: { type: "NUMBER" }, // 0.0 to 1.0
          allergensDetected: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: [
          "restaurantId",
          "restaurantName",
          "menuItemId",
          "dishName",
          "matchReason",
          "priceCents",
          "dietaryFitScore",
        ],
      },
    },
    suggestedBeveragePairing: { type: "STRING" },
  },
  required: ["recommendationSummary", "matches"],
} as const;

export const CartUpsellSchema = {
  type: "OBJECT",
  properties: {
    pitchHeadline: { type: "STRING" },
    recommendations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          menuItemId: { type: "STRING" },
          name: { type: "STRING" },
          pairingReason: { type: "STRING" },
          priceCents: { type: "INTEGER" },
        },
        required: ["menuItemId", "name", "pairingReason", "priceCents"],
      },
    },
  },
  required: ["pitchHeadline", "recommendations"],
} as const;

export function sanitizeUserPrompt(rawPrompt: string): string {
  return rawPrompt
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/```/g, "")
    .trim()
    .slice(0, 300);
}
