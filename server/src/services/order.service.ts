import crypto from "node:crypto";
import {
  calculateDeliveryFeeByDistanceCents,
  calculateDistanceKm,
  db,
} from "../db/index.js";
import { env } from "../config/env.js";
import { sseHub } from "../lib/sse.js";
import type {
  CartItemInput,
  CartValidationResponse,
  DeliveryMode,
  OrderEventRecord,
  OrderItemModifierRecord,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
  PaymentGateway,
  ValidatedCartLineItem,
} from "@hyperlocal/shared";

export function escapeHtml(unsafe?: string | null): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const VALID_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function isValidStatusTransition(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  return VALID_STATE_TRANSITIONS[current]?.includes(next) ?? false;
}

const PROMO_CODES: Record<
  string,
  {
    description: string;
    computeDiscount: (subtotalCents: number, deliveryFeeCents: number) => number;
  }
> = {
  HYPER10: {
    description: "10% off food subtotal",
    computeDiscount: (subtotalCents) => Math.round(subtotalCents * 0.1),
  },
  WELCOME5: {
    description: "$5.00 off orders $15+",
    computeDiscount: (subtotalCents) => (subtotalCents >= 1500 ? 500 : 0),
  },
  FREEDEL: {
    description: "Free standard delivery up to $5.00",
    computeDiscount: (_subtotalCents, deliveryFeeCents) =>
      Math.min(500, deliveryFeeCents),
  },
};

export class OrderDomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "ORDER_DOMAIN_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function validateAndCalculateCart(params: {
  restaurantId: string;
  items: CartItemInput[];
  customerLatitude?: number;
  customerLongitude?: number;
  deliveryMode?: DeliveryMode;
  scheduledWindow?: string;
  promoCode?: string;
  tipCents?: number;
}): CartValidationResponse {
  const restaurant = db.getRestaurantById(params.restaurantId);
  if (!restaurant || !restaurant.isActive) {
    throw new OrderDomainError(
      "Selected restaurant is unavailable or inactive.",
      404,
      "RESTAURANT_NOT_FOUND"
    );
  }

  if (!params.items || params.items.length === 0) {
    throw new OrderDomainError(
      "Cart must contain at least one item.",
      400,
      "EMPTY_CART"
    );
  }

  const validatedItems: ValidatedCartLineItem[] = [];
  let subtotalCents = 0;
  let maxItemPrepComplexity = restaurant.basePrepTimeMinutes;

  for (const cartItem of params.items) {
    const found = db.findMenuItem(cartItem.menuItemId);
    if (!found) {
      throw new OrderDomainError(
        `Menu item ${cartItem.menuItemId} does not exist in catalog.`,
        404,
        "MENU_ITEM_NOT_FOUND"
      );
    }

    // Security Requirement: Single-Merchant Integrity Enforcement
    if (found.restaurant.id !== restaurant.id) {
      throw new OrderDomainError(
        `Single-merchant boundary violation: Item "${found.item.name}" belongs to "${found.restaurant.name}", not "${restaurant.name}".`,
        409,
        "MIXED_RESTAURANT_CART_FORBIDDEN"
      );
    }

    if (!found.item.isAvailable) {
      throw new OrderDomainError(
        `Menu item "${found.item.name}" is currently out of stock.`,
        409,
        "ITEM_OUT_OF_STOCK"
      );
    }

    // Recalculate modifier prices strictly from DB records
    const resolvedModifiers: {
      modifierOptionId: string;
      modifierName: string;
      extraPriceCents: number;
    }[] = [];

    for (const selMod of cartItem.selectedModifiers ?? []) {
      const dbMod = db.findModifierOption(found.item, selMod.modifierOptionId);
      if (!dbMod || !dbMod.isAvailable) {
        throw new OrderDomainError(
          `Modifier option "${selMod.modifierName}" is invalid or unavailable for "${found.item.name}".`,
          400,
          "INVALID_MODIFIER_OPTION"
        );
      }
      resolvedModifiers.push({
        modifierOptionId: dbMod.id,
        modifierName: dbMod.name,
        extraPriceCents: dbMod.extraPriceCents, // Strictly from DB!
      });
    }

    // Verify required modifier groups if the item defines them and client passed none, auto-select default first option if missing or validate
    for (const group of found.item.modifierGroups) {
      if (group.isRequired && group.minSelection > 0) {
        const selectedInGroup = resolvedModifiers.filter((rm) =>
          group.options.some((opt) => opt.id === rm.modifierOptionId)
        );
        if (selectedInGroup.length === 0 && group.options.length > 0) {
          const defaultOpt = group.options[0];
          resolvedModifiers.push({
            modifierOptionId: defaultOpt.id,
            modifierName: defaultOpt.name,
            extraPriceCents: defaultOpt.extraPriceCents,
          });
        }
      }
    }

    const basePriceCents = found.item.basePriceCents;
    const modifierTotalCents = resolvedModifiers.reduce(
      (sum, m) => sum + m.extraPriceCents,
      0
    );
    const unitPriceCents = basePriceCents + modifierTotalCents;
    const lineTotalCents = unitPriceCents * cartItem.quantity;
    subtotalCents += lineTotalCents;

    if (
      found.item.prepComplexityMinutes &&
      found.item.prepComplexityMinutes + 6 > maxItemPrepComplexity
    ) {
      maxItemPrepComplexity = found.item.prepComplexityMinutes + 6;
    }

    validatedItems.push({
      menuItemId: found.item.id,
      dishName: found.item.name,
      imageUrl: found.item.imageUrl,
      quantity: cartItem.quantity,
      basePriceCents,
      modifierTotalCents,
      unitPriceCents,
      lineTotalCents,
      selectedModifiers: resolvedModifiers,
      specialNotes: escapeHtml(cartItem.specialNotes),
    });
  }

  const custLat = params.customerLatitude ?? 37.7611;
  const custLng = params.customerLongitude ?? -122.4216;
  const distanceKm = calculateDistanceKm(
    custLat,
    custLng,
    restaurant.latitude,
    restaurant.longitude
  );

  const deliveryMode: DeliveryMode = params.deliveryMode ?? "STANDARD";
  let deliveryFeeCents = calculateDeliveryFeeByDistanceCents(distanceKm);
  if (deliveryMode === "PRIORITY_EXPRESS") {
    deliveryFeeCents += 299;
  }

  let discountCents = 0;
  let appliedPromoCode: string | null = null;
  if (params.promoCode) {
    const normalized = params.promoCode.trim().toUpperCase();
    const promo = PROMO_CODES[normalized];
    if (promo) {
      discountCents = promo.computeDiscount(subtotalCents, deliveryFeeCents);
      if (discountCents > 0) {
        appliedPromoCode = normalized;
      }
    }
  }

  const taxableAmountCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round(
    (taxableAmountCents * env.DEFAULT_TAX_RATE_PERCENTAGE) / 100
  );
  const tipCents = Math.max(0, Math.round(params.tipCents ?? 0));
  const totalCents =
    Math.max(0, subtotalCents - discountCents) +
    deliveryFeeCents +
    taxCents +
    tipCents;

  // Dynamic ETA calculation factoring in kitchen backlog, transit distance, and delivery mode
  const activeOrders = db.getActiveOrdersCountForRestaurant(restaurant.id);
  const kitchenLoadLevel: "LOW" | "MODERATE" | "HIGH" =
    activeOrders >= 4 ? "HIGH" : activeOrders >= 2 ? "MODERATE" : "LOW";
  const kitchenBacklogMinutes = Math.min(15, activeOrders * 3);
  const estimatedPrepMinutes = maxItemPrepComplexity + kitchenBacklogMinutes;
  const rawTransitMinutes = Math.max(5, Math.round(distanceKm * 3.8));
  const estimatedTransitMinutes =
    deliveryMode === "PRIORITY_EXPRESS"
      ? Math.max(4, rawTransitMinutes - 4)
      : rawTransitMinutes;
  const estimatedTotalMinutes = estimatedPrepMinutes + estimatedTransitMinutes;

  return {
    valid: true,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    distanceKm,
    deliveryMode,
    scheduledWindow: params.scheduledWindow
      ? escapeHtml(params.scheduledWindow)
      : undefined,
    items: validatedItems,
    subtotalCents,
    discountCents,
    appliedPromoCode,
    deliveryFeeCents,
    taxCents,
    tipCents,
    totalCents,
    estimatedPrepMinutes,
    estimatedTransitMinutes,
    estimatedTotalMinutes,
    weatherImpactNote:
      "Clear Coastal Breeze • 64°F (Optimal road telemetry, +0 min delay)",
    kitchenLoadLevel,
  };
}

export function createOrder(params: {
  customerId: string;
  restaurantId: string;
  deliveryAddressId: string;
  items: CartItemInput[];
  tipCents: number;
  specialInstructions?: string;
  deliveryMode?: DeliveryMode;
  scheduledWindow?: string;
  promoCode?: string;
  paymentGateway?: PaymentGateway;
}): OrderRecord {
  const address = db.getAddressById(params.deliveryAddressId);
  if (!address) {
    throw new OrderDomainError(
      "Selected customer delivery address was not found.",
      404,
      "ADDRESS_NOT_FOUND"
    );
  }

  const calculation = validateAndCalculateCart({
    restaurantId: params.restaurantId,
    items: params.items,
    customerLatitude: address.latitude,
    customerLongitude: address.longitude,
    deliveryMode: params.deliveryMode,
    scheduledWindow: params.scheduledWindow,
    promoCode: params.promoCode,
    tipCents: params.tipCents,
  });

  const restaurant = db.getRestaurantById(params.restaurantId)!;
  const orderId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const estimatedDeliveryTime = new Date(
    Date.now() + calculation.estimatedTotalMinutes * 60 * 1000
  ).toISOString();

  const orderItems: OrderItemRecord[] = calculation.items.map((line) => {
    const orderItemId = crypto.randomUUID();
    const modifiers: OrderItemModifierRecord[] = line.selectedModifiers.map(
      (m) => ({
        id: crypto.randomUUID(),
        orderItemId,
        modifierNameSnapshot: m.modifierName,
        extraPriceCents: m.extraPriceCents,
      })
    );
    return {
      id: orderItemId,
      orderId,
      menuItemId: line.menuItemId,
      itemNameSnapshot: line.dishName,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      totalPriceCents: line.lineTotalCents,
      modifiers,
      specialNotes: line.specialNotes,
    };
  });

  const initialEvent: OrderEventRecord = {
    id: crypto.randomUUID(),
    orderId,
    previousStatus: null,
    newStatus: "PENDING_PAYMENT",
    actorId: params.customerId,
    message:
      "Order initialized; server-side price recalculation and single-merchant constraints verified.",
    metadata: {
      subtotalCents: calculation.subtotalCents,
      deliveryFeeCents: calculation.deliveryFeeCents,
      taxCents: calculation.taxCents,
      totalCents: calculation.totalCents,
      distanceKm: calculation.distanceKm,
    },
    createdAt: nowIso,
  };

  const trackingToken = sseHub.generateTrackingToken(
    orderId,
    params.customerId
  );

  const created = db.insertOrder({
    id: orderId,
    customerId: params.customerId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantLogoUrl: restaurant.logoImageUrl,
    restaurantAddress: restaurant.address,
    deliveryAddressId: address.id,
    deliveryAddressSnapshot: {
      label: address.label,
      streetAddress: address.streetAddress,
      apartmentUnit: address.apartmentUnit,
      city: address.city,
      stateProvince: address.stateProvince,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    },
    status: "PENDING_PAYMENT",
    paymentStatus: "UNPAID",
    paymentGateway: params.paymentGateway ?? "SIMULATED_STRIPE",
    deliveryMode: calculation.deliveryMode,
    scheduledWindow: calculation.scheduledWindow ?? null,
    promoCode: calculation.appliedPromoCode ?? null,
    discountCents: calculation.discountCents,
    subtotalCents: calculation.subtotalCents,
    deliveryFeeCents: calculation.deliveryFeeCents,
    taxCents: calculation.taxCents,
    tipCents: calculation.tipCents,
    totalCents: calculation.totalCents,
    estimatedDeliveryTime,
    specialInstructions: params.specialInstructions
      ? escapeHtml(params.specialInstructions)
      : null,
    cancellationReason: null,
    customerRating: null,
    customerFeedback: null,
    trackingToken,
    items: orderItems,
    events: [initialEvent],
    telemetry: {
      driverName: "Elena Vance",
      driverPhone: "+1 (415) 890-7740",
      vehicleDescription: "Vespa Elettrica • Lic #8KXF902",
      driverRating: 4.97,
      currentLatitude: restaurant.latitude,
      currentLongitude: restaurant.longitude,
      restaurantLatitude: restaurant.latitude,
      restaurantLongitude: restaurant.longitude,
      destinationLatitude: address.latitude,
      destinationLongitude: address.longitude,
      progressRatio: 0.05,
      etaRemainingMinutes: calculation.estimatedTotalMinutes,
      weatherCondition: calculation.weatherImpactNote,
      kitchenQueuePosition:
        db.getActiveOrdersCountForRestaurant(restaurant.id) + 1,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return created;
}

export function captureOrderPayment(params: {
  orderId: string;
  actorId: string;
  paymentGateway?: PaymentGateway;
  cardLast4?: string;
}): OrderRecord {
  const existing = db.getOrderById(params.orderId);
  if (!existing) {
    throw new OrderDomainError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  if (!isValidStatusTransition(existing.status, "PAID")) {
    throw new OrderDomainError(
      `Invalid state transition: Cannot transition order from ${existing.status} to PAID.`,
      409,
      "INVALID_STATE_TRANSITION"
    );
  }

  const nowIso = new Date().toISOString();
  const gateway = params.paymentGateway ?? existing.paymentGateway;
  const last4 = params.cardLast4 ?? "4242";
  const event: OrderEventRecord = {
    id: crypto.randomUUID(),
    orderId: existing.id,
    previousStatus: existing.status,
    newStatus: "PAID",
    actorId: params.actorId,
    message: `Payment of $${(existing.totalCents / 100).toFixed(
      2
    )} authorized and captured via ${gateway} (••${last4}). Dispatched to kitchen KDS.`,
    metadata: {
      paymentGateway: gateway,
      cardLast4: last4,
      capturedAmountCents: existing.totalCents,
    },
    createdAt: nowIso,
  };

  const updated = db.updateOrder(existing.id, (draft) => {
    draft.status = "PAID";
    draft.paymentStatus = "CAPTURED";
    draft.paymentGateway = gateway;
    draft.telemetry.progressRatio = 0.15;
    draft.events.push(event);
  })!;

  sseHub.broadcastOrderUpdate(updated, event);
  return updated;
}

export function advanceOrderStatus(params: {
  orderId: string;
  newStatus: OrderStatus;
  actorId: string;
  message: string;
  metadata?: Record<string, unknown>;
}): OrderRecord {
  const existing = db.getOrderById(params.orderId);
  if (!existing) {
    throw new OrderDomainError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  if (!isValidStatusTransition(existing.status, params.newStatus)) {
    throw new OrderDomainError(
      `Deterministic State Machine Guard: Cannot transition order #${existing.orderNumber} from ${existing.status} directly to ${params.newStatus}.`,
      409,
      "INVALID_STATE_TRANSITION"
    );
  }

  const nowIso = new Date().toISOString();
  const sanitizedMessage = escapeHtml(params.message);

  const event: OrderEventRecord = {
    id: crypto.randomUUID(),
    orderId: existing.id,
    previousStatus: existing.status,
    newStatus: params.newStatus,
    actorId: params.actorId,
    message: sanitizedMessage,
    metadata: params.metadata ?? {},
    createdAt: nowIso,
  };

  const updated = db.updateOrder(existing.id, (draft) => {
    draft.status = params.newStatus;
    if (params.newStatus === "CANCELLED") {
      draft.cancellationReason = sanitizedMessage;
      draft.paymentStatus =
        draft.paymentStatus === "CAPTURED" ? "REFUNDED" : draft.paymentStatus;
    }

    const rLat = draft.telemetry.restaurantLatitude;
    const rLng = draft.telemetry.restaurantLongitude;
    const dLat = draft.telemetry.destinationLatitude;
    const dLng = draft.telemetry.destinationLongitude;

    if (params.newStatus === "CONFIRMED") {
      draft.telemetry.progressRatio = 0.3;
      draft.telemetry.etaRemainingMinutes = Math.max(
        12,
        draft.telemetry.etaRemainingMinutes - 3
      );
    } else if (params.newStatus === "PREPARING") {
      draft.telemetry.progressRatio = 0.5;
      draft.telemetry.etaRemainingMinutes = Math.max(
        9,
        draft.telemetry.etaRemainingMinutes - 5
      );
    } else if (params.newStatus === "OUT_FOR_DELIVERY") {
      draft.telemetry.progressRatio = 0.78;
      draft.telemetry.currentLatitude = Number(
        (rLat + (dLat - rLat) * 0.55).toFixed(6)
      );
      draft.telemetry.currentLongitude = Number(
        (rLng + (dLng - rLng) * 0.55).toFixed(6)
      );
      draft.telemetry.etaRemainingMinutes = Math.max(
        4,
        Math.round(draft.telemetry.etaRemainingMinutes * 0.45)
      );
      draft.telemetry.kitchenQueuePosition = 0;
    } else if (params.newStatus === "DELIVERED") {
      draft.telemetry.progressRatio = 1.0;
      draft.telemetry.currentLatitude = dLat;
      draft.telemetry.currentLongitude = dLng;
      draft.telemetry.etaRemainingMinutes = 0;
      draft.telemetry.kitchenQueuePosition = 0;
    }

    draft.events.push(event);
  })!;

  sseHub.broadcastOrderUpdate(updated, event);
  return updated;
}

export function submitOrderFeedback(params: {
  orderId: string;
  foodRating: number;
  deliveryRating: number;
  comment?: string;
}): OrderRecord {
  const existing = db.getOrderById(params.orderId);
  if (!existing) {
    throw new OrderDomainError("Order not found.", 404, "ORDER_NOT_FOUND");
  }
  const avg =
    Math.round(((params.foodRating + params.deliveryRating) / 2) * 10) / 10;
  const updated = db.updateOrder(existing.id, (draft) => {
    draft.customerRating = avg;
    draft.customerFeedback = params.comment ? escapeHtml(params.comment) : null;
  })!;
  return updated;
}
