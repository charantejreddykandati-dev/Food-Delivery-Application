import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { db, isPostgresConnected } from "../db/index.js";
import { sseHub } from "../lib/sse.js";
import {
  advanceOrderStatus,
  captureOrderPayment,
  createOrder,
  escapeHtml,
  submitOrderFeedback,
  validateAndCalculateCart,
} from "../services/order.service.js";
import {
  generateCulinaryRecommendations,
  generateSmartCartUpsells,
} from "../services/ai.service.js";
import {
  AICartUpsellRequestSchema,
  AICravingSearchRequestSchema,
  CreateOrderRequestSchema,
  OrderFeedbackRequestSchema,
  PayOrderRequestSchema,
  RestaurantQuerySchema,
  UpdateOrderStatusSchema,
  ValidateCartRequestSchema,
  type OrderStatus,
} from "@hyperlocal/shared";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.json({
    status: "OK",
    service: "hyperlocal-food-platform",
    postgresConnected: isPostgresConnected(),
    aiModel: "gemini-2.5-flash",
    timestamp: new Date().toISOString(),
  });
}

export async function listRestaurants(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = RestaurantQuerySchema.parse(req.query);
    const result = db.queryRestaurants(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRestaurantDetail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : 37.7611;
    const lng = req.query.lng ? Number(req.query.lng) : -122.4216;
    const restaurant = db.getRestaurantById(req.params.id, lat, lng);
    if (!restaurant) {
      res.status(404).json({
        error: "RESTAURANT_NOT_FOUND",
        message: `Restaurant "${req.params.id}" not found.`,
      });
      return;
    }
    res.json(restaurant);
  } catch (err) {
    next(err);
  }
}

export async function listCustomerAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId =
      req.user?.id ?? "11111111-1111-4111-8111-111111111101";
    const addresses = db.getCustomerAddresses(userId);
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
}

const CreateAddressSchema = z.object({
  label: z.string().min(1).max(50).default("Home"),
  streetAddress: z.string().min(3).max(250),
  apartmentUnit: z.string().max(50).optional().nullable(),
  city: z.string().min(2).max(100).default("San Francisco"),
  stateProvince: z.string().min(2).max(100).default("CA"),
  postalCode: z.string().min(3).max(20).default("94110"),
  latitude: z.number().min(-90).max(90).default(37.7611),
  longitude: z.number().min(-180).max(180).default(-122.4216),
  isDefault: z.boolean().default(true),
});

export async function createCustomerAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId =
      req.user?.id ?? "11111111-1111-4111-8111-111111111101";
    const body = CreateAddressSchema.parse(req.body);
    const created = db.addCustomerAddress(userId, {
      ...body,
      label: escapeHtml(body.label),
      streetAddress: escapeHtml(body.streetAddress),
      apartmentUnit: body.apartmentUnit
        ? escapeHtml(body.apartmentUnit)
        : null,
      city: escapeHtml(body.city),
      stateProvince: escapeHtml(body.stateProvince),
      postalCode: escapeHtml(body.postalCode),
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function postValidateCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = ValidateCartRequestSchema.parse(req.body);
    const validation = validateAndCalculateCart(body);
    res.json(validation);
  } catch (err) {
    next(err);
  }
}

export async function postAiRecommend(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = AICravingSearchRequestSchema.parse(req.body);
    const recommendation = await generateCulinaryRecommendations(body);
    res.json(recommendation);
  } catch (err) {
    next(err);
  }
}

export async function postAiUpsell(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = AICartUpsellRequestSchema.parse(req.body);
    const upsell = await generateSmartCartUpsells(body);
    res.json(upsell);
  } catch (err) {
    next(err);
  }
}

export async function postCreateOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId =
      req.user?.id ?? "11111111-1111-4111-8111-111111111101";
    const body = CreateOrderRequestSchema.parse(req.body);
    const order = createOrder({
      customerId,
      ...body,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function postPayOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actorId =
      req.user?.id ?? "11111111-1111-4111-8111-111111111101";
    const body = PayOrderRequestSchema.parse(req.body ?? {});
    const updated = captureOrderPayment({
      orderId: req.params.id,
      actorId,
      paymentGateway: body.paymentGateway,
      cardLast4: body.cardLast4,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function getOrdersList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId =
      req.user?.id ?? "11111111-1111-4111-8111-111111111101";
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const all = db.getOrdersForCustomer(customerId);
    const start = (page - 1) * limit;
    res.json({
      orders: all.slice(start, start + limit),
      total: all.length,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderDetail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({
        error: "ORDER_NOT_FOUND",
        message: `Order "${req.params.id}" not found.`,
      });
      return;
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function streamOrderLiveTracking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({
        error: "ORDER_NOT_FOUND",
        message: `Order "${req.params.id}" not found.`,
      });
      return;
    }

    const token =
      (req.query.token as string | undefined) ||
      req.header("x-tracking-token");
    const authorized = sseHub.verifyTrackingAccess(
      order,
      token,
      req.user?.id,
      req.user?.role
    );
    if (!authorized) {
      res.status(403).json({
        error: "SSE_AUTH_FORBIDDEN",
        message: "Unauthorized to subscribe to this order tracking stream.",
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const client = sseHub.addClient(order.id, res);

    // Emit initial snapshot immediately upon subscription
    const initialSnapshot = JSON.stringify({
      type: "INITIAL_SNAPSHOT",
      timestamp: new Date().toISOString(),
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      telemetry: order.telemetry,
      latestEvent: order.events[order.events.length - 1] ?? null,
      events: order.events,
    });
    res.write(`event: order_update\ndata: ${initialSnapshot}\n\n`);

    // Periodic heartbeat + live driver coordinate micro-telemetry when OUT_FOR_DELIVERY
    const heartbeat = setInterval(() => {
      const currentOrder = db.getOrderById(order.id);
      if (!currentOrder) return;
      if (
        currentOrder.status === "OUT_FOR_DELIVERY" &&
        currentOrder.telemetry.progressRatio < 0.96
      ) {
        const updated = db.updateOrder(order.id, (draft) => {
          const nextRatio = Math.min(
            0.96,
            Number((draft.telemetry.progressRatio + 0.04).toFixed(2))
          );
          draft.telemetry.progressRatio = nextRatio;
          const rLat = draft.telemetry.restaurantLatitude;
          const rLng = draft.telemetry.restaurantLongitude;
          const dLat = draft.telemetry.destinationLatitude;
          const dLng = draft.telemetry.destinationLongitude;
          draft.telemetry.currentLatitude = Number(
            (rLat + (dLat - rLat) * nextRatio).toFixed(6)
          );
          draft.telemetry.currentLongitude = Number(
            (rLng + (dLng - rLng) * nextRatio).toFixed(6)
          );
          draft.telemetry.etaRemainingMinutes = Math.max(
            1,
            Math.round((1 - nextRatio) * 18)
          );
        });
        if (updated) {
          sseHub.broadcastOrderUpdate(updated);
        }
      } else {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 6000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseHub.removeClient(client);
    });
  } catch (err) {
    next(err);
  }
}

export async function postOrderFeedback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = OrderFeedbackRequestSchema.parse(req.body);
    const updated = submitOrderFeedback({
      orderId: req.params.id,
      ...body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function getMerchantOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawStatus = req.query.status as string | undefined;
    const statuses = rawStatus
      ? (rawStatus.split(",").map((s) => s.trim()) as OrderStatus[])
      : undefined;
    const orders = db.getMerchantOrders(statuses);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

export async function patchMerchantOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actorId =
      req.user?.id ?? "22222222-2222-4222-8222-222222222201";
    const body = UpdateOrderStatusSchema.parse(req.body);
    const updated = advanceOrderStatus({
      orderId: req.params.id,
      newStatus: body.newStatus,
      actorId,
      message: body.message,
      metadata: body.metadata,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

const ToggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export async function patchMenuItemAvailability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = ToggleAvailabilitySchema.parse(req.body);
    const item = db.toggleMenuItemAvailability(
      req.params.id,
      body.isAvailable
    );
    if (!item) {
      res.status(404).json({
        error: "MENU_ITEM_NOT_FOUND",
        message: "Menu item not found.",
      });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
}
