import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  RotateCcw,
  Navigation,
  Star,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { useAppStore } from "../context/store";
import { api, formatCents } from "../api/client";

export const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { rehydrateCartFromOrder } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: api.getOrders,
  });

  const orders = data?.orders ?? [];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Order History & Active Deliveries
            </h1>
            <p className="text-xs text-slate-500">
              Review itemized receipts, track live couriers, or rehydrate past
              baskets in one click
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
          >
            <span>Discover More Kitchens</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-44 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-slate-900">
              No orders placed yet
            </h3>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isActive =
                order.status !== "DELIVERED" && order.status !== "CANCELLED";
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3.5">
                      {order.restaurantLogoUrl && (
                        <img
                          src={order.restaurantLogoUrl}
                          alt={order.restaurantName}
                          className="h-14 w-14 rounded-xl object-cover shadow-sm"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-500">
                            #{order.orderNumber}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900">
                            {order.restaurantName}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isActive
                                ? "bg-orange-100 text-orange-800"
                                : order.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString()} •{" "}
                          {order.deliveryAddressSnapshot.label} (
                          {order.deliveryAddressSnapshot.streetAddress})
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/orders/${order.id}/tracking`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>
                          {isActive ? "Live Tracking Canvas" : "View Receipt & Audit"}
                        </span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          rehydrateCartFromOrder({
                            restaurantId: order.restaurantId,
                            restaurantName: order.restaurantName,
                            items: order.items.map((item) => ({
                              restaurantId: order.restaurantId,
                              restaurantName: order.restaurantName,
                              menuItemId: item.menuItemId,
                              dishName: item.itemNameSnapshot,
                              imageUrl: "",
                              basePriceCents:
                                item.unitPriceCents -
                                item.modifiers.reduce(
                                  (s, m) => s + m.extraPriceCents,
                                  0
                                ),
                              quantity: item.quantity,
                              selectedModifiers: item.modifiers.map((m) => ({
                                modifierOptionId: m.id,
                                modifierName: m.modifierNameSnapshot,
                                extraPriceCents: m.extraPriceCents,
                              })),
                            })),
                          });
                          navigate(`/restaurant/${order.restaurantId}`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Order Again</span>
                      </button>
                    </div>
                  </div>

                  {/* Itemization Row */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex flex-wrap gap-2">
                      {order.items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700"
                        >
                          <Receipt className="h-3 w-3 text-slate-400" />
                          {item.quantity}x {item.itemNameSnapshot}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      {order.customerRating && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {order.customerRating} / 5.0
                        </span>
                      )}
                      <span className="font-mono text-sm font-extrabold text-slate-900">
                        Total: {formatCents(order.totalCents)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
