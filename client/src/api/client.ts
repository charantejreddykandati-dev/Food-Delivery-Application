import type {
  CartItemInput,
  CartUpsellResponse,
  CartValidationResponse,
  CulinaryRecommendationResponse,
  CustomerAddress,
  DeliveryMode,
  MenuItem,
  OrderRecord,
  OrderStatus,
  PaymentGateway,
  RestaurantDetail,
  RestaurantSummary,
} from "@hyperlocal/shared";

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.message) errorMessage = errBody.message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const api = {
  getRestaurants: (params: {
    search?: string;
    cuisine?: string;
    dietary?: string;
    serviceTier?: string;
    sortBy?: "rating" | "distance" | "eta" | "price_asc";
    lat?: number;
    lng?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.cuisine && params.cuisine !== "All")
      qs.set("cuisine", params.cuisine);
    if (params.dietary) qs.set("dietary", params.dietary);
    if (params.serviceTier && params.serviceTier !== "All")
      qs.set("serviceTier", params.serviceTier);
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    if (params.lat !== undefined) qs.set("lat", String(params.lat));
    if (params.lng !== undefined) qs.set("lng", String(params.lng));
    return requestJson<{
      restaurants: RestaurantSummary[];
      total: number;
      page: number;
      limit: number;
    }>(`/restaurants?${qs.toString()}`);
  },

  getRestaurantDetail: (id: string, lat?: number, lng?: number) => {
    const qs = new URLSearchParams();
    if (lat !== undefined) qs.set("lat", String(lat));
    if (lng !== undefined) qs.set("lng", String(lng));
    return requestJson<RestaurantDetail>(
      `/restaurants/${encodeURIComponent(id)}?${qs.toString()}`
    );
  },

  getAddresses: () =>
    requestJson<{ addresses: CustomerAddress[] }>("/addresses"),

  createAddress: (payload: {
    label: string;
    streetAddress: string;
    apartmentUnit?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) =>
    requestJson<CustomerAddress>("/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  validateCart: (payload: {
    restaurantId: string;
    items: CartItemInput[];
    customerLatitude?: number;
    customerLongitude?: number;
    deliveryMode?: DeliveryMode;
    scheduledWindow?: string;
    promoCode?: string;
    tipCents?: number;
  }) =>
    requestJson<CartValidationResponse>("/cart/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAiRecommendations: (payload: {
    query: string;
    maxBudgetDollars?: number;
    dietaryPreferences?: string[];
    groupHeadcount?: number;
    calorieTarget?: number;
    spiceTolerance?: number;
    maxPrepMinutes?: number;
  }) =>
    requestJson<CulinaryRecommendationResponse>("/ai/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAiUpsells: (payload: {
    restaurantId: string;
    items: CartItemInput[];
    maxBudgetDollars?: number;
  }) =>
    requestJson<CartUpsellResponse>("/ai/upsell", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createOrder: (payload: {
    restaurantId: string;
    deliveryAddressId: string;
    items: CartItemInput[];
    tipCents: number;
    specialInstructions?: string;
    deliveryMode?: DeliveryMode;
    scheduledWindow?: string;
    promoCode?: string;
    paymentGateway?: PaymentGateway;
  }) =>
    requestJson<OrderRecord>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  payOrder: (
    orderId: string,
    payload: { paymentGateway: PaymentGateway; cardLast4?: string }
  ) =>
    requestJson<OrderRecord>(`/orders/${encodeURIComponent(orderId)}/pay`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getOrders: () =>
    requestJson<{ orders: OrderRecord[]; total: number }>("/orders"),

  getOrderDetail: (orderId: string) =>
    requestJson<OrderRecord>(`/orders/${encodeURIComponent(orderId)}`),

  submitOrderFeedback: (
    orderId: string,
    payload: { foodRating: number; deliveryRating: number; comment?: string }
  ) =>
    requestJson<OrderRecord>(
      `/orders/${encodeURIComponent(orderId)}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getMerchantOrders: () =>
    requestJson<{ orders: OrderRecord[] }>("/merchant/orders", {
      headers: { "x-user-role": "MERCHANT" },
    }),

  advanceMerchantOrderStatus: (
    orderId: string,
    payload: {
      newStatus: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">;
      message: string;
      metadata?: Record<string, unknown>;
    }
  ) =>
    requestJson<OrderRecord>(
      `/merchant/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: { "x-user-role": "MERCHANT" },
        body: JSON.stringify(payload),
      }
    ),

  toggleMenuItemAvailability: (menuItemId: string, isAvailable: boolean) =>
    requestJson<MenuItem>(
      `/merchant/menu-items/${encodeURIComponent(menuItemId)}/availability`,
      {
        method: "PATCH",
        headers: { "x-user-role": "MERCHANT" },
        body: JSON.stringify({ isAvailable }),
      }
    ),
};
