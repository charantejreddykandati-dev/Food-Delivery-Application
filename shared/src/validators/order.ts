// shared/src/validators/order.ts
import { z } from "zod";

export const CartItemModifierSelectionSchema = z.object({
  modifierOptionId: z.string().uuid(),
  modifierName: z.string().min(1),
  extraPriceCents: z.number().int().nonnegative(),
});

export const CartItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
  selectedModifiers: z.array(CartItemModifierSelectionSchema).default([]),
  specialNotes: z.string().max(250).optional(),
});

export const DeliveryModeSchema = z.enum([
  "STANDARD",
  "PRIORITY_EXPRESS",
  "SCHEDULED",
]);

export const ValidateCartRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(CartItemSchema).min(1, "Cart must contain at least one item"),
  customerLatitude: z.number().min(-90).max(90).optional(),
  customerLongitude: z.number().min(-180).max(180).optional(),
  deliveryMode: DeliveryModeSchema.default("STANDARD"),
  scheduledWindow: z.string().max(100).optional(),
  promoCode: z.string().max(50).optional(),
  tipCents: z.number().int().nonnegative().default(0),
});

export const CreateOrderRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  deliveryAddressId: z.string().uuid(),
  items: z.array(CartItemSchema).min(1, "Order must contain at least one item"),
  tipCents: z.number().int().nonnegative().default(0),
  specialInstructions: z.string().max(500).optional(),
  deliveryMode: DeliveryModeSchema.default("STANDARD"),
  scheduledWindow: z.string().max(100).optional(),
  promoCode: z.string().max(50).optional(),
  paymentGateway: z
    .enum(["SIMULATED_STRIPE", "WALLET_BALANCE", "CASH_ON_DELIVERY"])
    .default("SIMULATED_STRIPE"),
});

export const PayOrderRequestSchema = z.object({
  paymentGateway: z
    .enum(["SIMULATED_STRIPE", "WALLET_BALANCE", "CASH_ON_DELIVERY"])
    .default("SIMULATED_STRIPE"),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  newStatus: z.enum([
    "CONFIRMED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]),
  message: z.string().min(2).max(255),
  metadata: z.record(z.any()).optional(),
});

export const AICravingSearchRequestSchema = z.object({
  query: z.string().min(3).max(300),
  maxBudgetDollars: z.number().positive().optional(),
  dietaryPreferences: z.array(z.string()).default([]),
  groupHeadcount: z.number().int().min(1).max(20).default(1),
  calorieTarget: z.number().int().min(100).max(5000).optional(),
  spiceTolerance: z.number().int().min(0).max(5).default(2),
  maxPrepMinutes: z.number().int().min(10).max(90).optional(),
});

export const AICartUpsellRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(CartItemSchema).min(1),
  maxBudgetDollars: z.number().positive().optional(),
});

export const RestaurantQuerySchema = z.object({
  search: z.string().optional(),
  cuisine: z.string().optional(),
  dietary: z.string().optional(),
  serviceTier: z.string().optional(),
  sortBy: z
    .enum(["rating", "distance", "eta", "price_asc"])
    .default("rating"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const OrderFeedbackRequestSchema = z.object({
  foodRating: z.number().int().min(1).max(5),
  deliveryRating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const CulinaryRecommendationResponseZodSchema = z.object({
  recommendationSummary: z.string(),
  matches: z.array(
    z.object({
      restaurantId: z.string(),
      restaurantName: z.string(),
      menuItemId: z.string(),
      dishName: z.string(),
      matchReason: z.string(),
      priceCents: z.number().int(),
      dietaryFitScore: z.number().min(0).max(1),
      allergensDetected: z.array(z.string()).default([]),
    })
  ),
  suggestedBeveragePairing: z.string().optional(),
});

export const CartUpsellResponseZodSchema = z.object({
  pitchHeadline: z.string(),
  recommendations: z.array(
    z.object({
      menuItemId: z.string(),
      name: z.string(),
      pairingReason: z.string(),
      priceCents: z.number().int(),
    })
  ),
});
