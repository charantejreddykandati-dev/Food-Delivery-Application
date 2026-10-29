import { Router } from "express";
import {
  createCustomerAddress,
  getHealth,
  getMerchantOrders,
  getOrderDetail,
  getOrdersList,
  getRestaurantDetail,
  listCustomerAddresses,
  listRestaurants,
  patchMenuItemAvailability,
  patchMerchantOrderStatus,
  postAiRecommend,
  postAiUpsell,
  postCreateOrder,
  postOrderFeedback,
  postPayOrder,
  postValidateCart,
  streamOrderLiveTracking,
} from "../controllers/api.controller.js";
import { aiRateLimiter, attachSessionUser } from "../middleware/security.js";

export const apiRouter = Router();

apiRouter.use(attachSessionUser);

apiRouter.get("/health", getHealth);

// Public & Discovery
apiRouter.get("/restaurants", listRestaurants);
apiRouter.get("/restaurants/:id", getRestaurantDetail);

// Customer Addresses
apiRouter.get("/addresses", listCustomerAddresses);
apiRouter.post("/addresses", createCustomerAddress);

// Cart & Advisory
apiRouter.post("/cart/validate", postValidateCart);
apiRouter.post("/ai/recommend", aiRateLimiter, postAiRecommend);
apiRouter.post("/ai/upsell", aiRateLimiter, postAiUpsell);

// Checkout & Orders
apiRouter.post("/orders", postCreateOrder);
apiRouter.post("/orders/:id/pay", postPayOrder);
apiRouter.get("/orders", getOrdersList);
apiRouter.get("/orders/:id", getOrderDetail);
apiRouter.get("/orders/:id/live-tracking", streamOrderLiveTracking);
apiRouter.post("/orders/:id/feedback", postOrderFeedback);

// Merchant KDS Operations
apiRouter.get("/merchant/orders", getMerchantOrders);
apiRouter.patch("/merchant/orders/:id/status", patchMerchantOrderStatus);
apiRouter.patch("/merchant/menu-items/:id/availability", patchMenuItemAvailability);
