import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  ChefHat,
  ArrowRight,
  Star,
  LifeBuoy,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { OrderTrackingTimeline } from "../components/tracking/OrderTrackingTimeline";
import { LiveDriverMapSimulator } from "../components/tracking/LiveDriverMapSimulator";
import { api, formatCents } from "../api/client";
import type { OrderStatus } from "@hyperlocal/shared";

const NEXT_STAGE_MAP: Partial<
  Record<
    OrderStatus,
    {
      next: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">;
      label: string;
      message: string;
    }
  >
> = {
  PAID: {
    next: "CONFIRMED",
    label: "Simulate Kitchen Accept (→ CONFIRMED)",
    message: "Merchant KDS accepted ticket and assigned prep station.",
  },
  CONFIRMED: {
    next: "PREPARING",
    label: "Simulate Kitchen Firing (→ PREPARING)",
    message: "Chefs firing dishes & sealing thermal packaging.",
  },
  PREPARING: {
    next: "OUT_FOR_DELIVERY",
    label: "Simulate Courier Dispatch (→ OUT_FOR_DELIVERY)",
    message: "Courier Elena Vance picked up order and started GPS route.",
  },
  OUT_FOR_DELIVERY: {
    next: "DELIVERED",
    label: "Simulate Doorstep Arrival (→ DELIVERED)",
    message: "Order delivered at customer destination doorstep.",
  },
};

export const OrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [sseConnected, setSseConnected] = useState(false);
  const [lastSseTimestamp, setLastSseTimestamp] = useState<string | null>(null);

  const [foodRating, setFoodRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState(
    "Piping hot arrival and spot-on dietary preparation!"
  );

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => api.getOrderDetail(id!),
    enabled: Boolean(id),
    refetchInterval: 8000,
  });

  // Subscribe to Server-Sent Events (SSE) stream `/api/orders/:id/live-tracking`
  useEffect(() => {
    if (!id || !order?.trackingToken) return;

    const url = `/api/orders/${encodeURIComponent(
      id
    )}/live-tracking?token=${encodeURIComponent(order.trackingToken)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    const handleOrderUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        setLastSseTimestamp(parsed.timestamp);
        queryClient.setQueryData(["order-detail", id], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            status: parsed.status ?? oldData.status,
            paymentStatus: parsed.paymentStatus ?? oldData.paymentStatus,
            estimatedDeliveryTime:
              parsed.estimatedDeliveryTime ?? oldData.estimatedDeliveryTime,
            telemetry: parsed.telemetry ?? oldData.telemetry,
            events: parsed.events ?? oldData.events,
          };
        });
      } catch {
        // ignore malformed frame
      }
    };

    eventSource.addEventListener("order_update", handleOrderUpdate);
    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.removeEventListener("order_update", handleOrderUpdate);
      eventSource.close();
    };
  }, [id, order?.trackingToken, queryClient]);

  const advanceStageMutation = useMutation({
    mutationFn: (params: {
      newStatus: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">;
      message: string;
    }) =>
      api.advanceMerchantOrderStatus(id!, {
        newStatus: params.newStatus,
        message: params.message,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order-detail", id], updated);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: () =>
      api.submitOrderFeedback(id!, {
        foodRating,
        deliveryRating,
        comment: feedbackComment,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order-detail", id], updated);
    },
  });

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-6xl p-8">
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const nextTransition = NEXT_STAGE_MAP[order.status];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6">
        {/* Top Header & Live SSE Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-extrabold text-white">
                Order #{order.orderNumber}
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">
                {order.restaurantName}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold ${
                  sseConnected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span>
                  {sseConnected
                    ? "SSE Live Stream Active"
                    : "Polling Fallback Active"}
                </span>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Destination: {order.deliveryAddressSnapshot.label} —{" "}
              {order.deliveryAddressSnapshot.streetAddress},{" "}
              {order.deliveryAddressSnapshot.city}
              {lastSseTimestamp && (
                <span className="ml-2 font-mono text-[11px] text-slate-400">
                  • Last SSE frame:{" "}
                  {new Date(lastSseTimestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {nextTransition && (
              <button
                type="button"
                disabled={advanceStageMutation.isPending}
                onClick={() =>
                  advanceStageMutation.mutate({
                    newStatus: nextTransition.next,
                    message: nextTransition.message,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:from-orange-700 hover:to-rose-700"
              >
                <ChefHat className="h-4 w-4" />
                <span>{nextTransition.label}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            <Link
              to="/merchant/portal"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Open Full Merchant KDS
            </Link>
          </div>
        </div>

        {/* Live Driver Map Simulator Canvas */}
        <LiveDriverMapSimulator
          telemetry={order.telemetry}
          status={order.status}
          restaurantName={order.restaurantName}
          destinationAddress={order.deliveryAddressSnapshot.streetAddress}
        />

        {/* Deterministic Stage Stepper & Audit Log */}
        <OrderTrackingTimeline status={order.status} events={order.events} />

        {/* Bottom Grid: Itemized Receipt + Post-Delivery Feedback / Support */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Itemized Receipt */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Receipt className="h-5 w-5 text-orange-600" />
              <h3 className="text-base font-extrabold text-slate-900">
                Verified Order Receipt & Kitchen Notes
              </h3>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between py-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {item.quantity}x {item.itemNameSnapshot}
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        +{" "}
                        {item.modifiers
                          .map(
                            (m) =>
                              `${m.modifierNameSnapshot} (${formatCents(
                                m.extraPriceCents
                              )})`
                          )
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCents(item.totalPriceCents)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">
                  {formatCents(order.subtotalCents)}
                </span>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>Promo ({order.promoCode})</span>
                  <span className="font-mono">
                    -{formatCents(order.discountCents)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee ({order.deliveryMode})</span>
                <span className="font-mono">
                  {formatCents(order.deliveryFeeCents)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span className="font-mono">{formatCents(order.taxCents)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Courier Tip</span>
                <span className="font-mono">{formatCents(order.tipCents)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                <span>Total Paid ({order.paymentGateway})</span>
                <span className="font-mono text-orange-600">
                  {formatCents(order.totalCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Post-Delivery Feedback & Concierge Support */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Post-Delivery Culinary & Accuracy Rating
                </h3>
              </div>

              {order.customerRating ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      Rated {order.customerRating} / 5.0 ★ — Thank you!
                    </span>
                  </div>
                  {order.customerFeedback && (
                    <p className="mt-1 italic">
                      &ldquo;{order.customerFeedback}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    feedbackMutation.mutate();
                  }}
                  className="mt-4 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">
                        Food Quality (1–5★)
                      </label>
                      <select
                        value={foodRating}
                        onChange={(e) => setFoodRating(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">
                        Courier Accuracy (1–5★)
                      </label>
                      <select
                        value={deliveryRating}
                        onChange={(e) =>
                          setDeliveryRating(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Share feedback to train your AI Concierge taste profile..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                  />

                  <button
                    type="submit"
                    disabled={feedbackMutation.isPending}
                    className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
                  >
                    Submit Culinary Feedback
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LifeBuoy className="h-5 w-5 text-orange-600" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      24/7 Hyperlocal Dispatch Support
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Order Token: <code>{order.trackingToken}</code>
                    </p>
                  </div>
                </div>
                <Link
                  to="/orders"
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  All Orders
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
