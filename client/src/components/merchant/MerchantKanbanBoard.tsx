import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  ArrowRight,
  Clock,
  CheckCircle2,
  Flame,
  Bike,
  PackageCheck,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api, formatCents } from "../../api/client";
import type { OrderRecord, OrderStatus } from "@hyperlocal/shared";

const KANBAN_COLUMNS: {
  status: OrderStatus;
  title: string;
  badgeColor: string;
  nextStatus?: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">;
  nextActionLabel?: string;
  defaultLogMessage?: string;
}[] = [
  {
    status: "PAID",
    title: "New Paid Tickets",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    nextStatus: "CONFIRMED",
    nextActionLabel: "Accept & Confirm Ticket",
    defaultLogMessage:
      "Kitchen KDS acknowledged ticket and assigned prep station.",
  },
  {
    status: "CONFIRMED",
    title: "Confirmed Queue",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    nextStatus: "PREPARING",
    nextActionLabel: "Fire Kitchen Prep",
    defaultLogMessage:
      "Chefs actively firing dishes and assembling modifiers.",
  },
  {
    status: "PREPARING",
    title: "Active Prep",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    nextStatus: "OUT_FOR_DELIVERY",
    nextActionLabel: "Hand Off to Courier",
    defaultLogMessage:
      "Order thermally sealed and dispatched with courier Elena Vance.",
  },
  {
    status: "OUT_FOR_DELIVERY",
    title: "En Route (Courier)",
    badgeColor: "bg-violet-100 text-violet-800 border-violet-200",
    nextStatus: "DELIVERED",
    nextActionLabel: "Confirm Doorstep Delivery",
    defaultLogMessage:
      "Courier completed drop-off at customer destination address.",
  },
  {
    status: "DELIVERED",
    title: "Completed",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
];

export const MerchantKanbanBoard: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01"
  );

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["merchant-kds-orders"],
    queryFn: api.getMerchantOrders,
    refetchInterval: 4000,
  });

  const { data: restaurantDetail } = useQuery({
    queryKey: ["merchant-inventory", selectedRestaurantId],
    queryFn: () => api.getRestaurantDetail(selectedRestaurantId),
  });

  const advanceMutation = useMutation({
    mutationFn: (params: {
      orderId: string;
      newStatus: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">;
      message: string;
    }) =>
      api.advanceMerchantOrderStatus(params.orderId, {
        newStatus: params.newStatus,
        message: params.message,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-kds-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
  });

  const toggleStockMutation = useMutation({
    mutationFn: (params: { menuItemId: string; isAvailable: boolean }) =>
      api.toggleMenuItemAvailability(params.menuItemId, params.isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchant-inventory", selectedRestaurantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["restaurant-detail", selectedRestaurantId],
      });
    },
  });

  const orders = ordersData?.orders ?? [];

  return (
    <div className="space-y-8">
      {/* Kanban Columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              className="flex flex-col rounded-2xl border border-slate-200 bg-slate-100/70 p-3.5"
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs font-extrabold ${col.badgeColor}`}
                >
                  {col.title}
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700 shadow-sm">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3">
                {isLoading ? (
                  <p className="p-4 text-center text-xs text-slate-400">
                    Syncing KDS tickets...
                  </p>
                ) : colOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-6 text-center text-xs text-slate-400">
                    No tickets in {col.status}
                  </div>
                ) : (
                  colOrders.map((order: OrderRecord) => (
                    <div
                      key={order.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-300"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            #{order.orderNumber}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {order.deliveryMode}
                          </span>
                        </div>

                        <p className="mt-2 text-xs font-bold text-orange-600">
                          {order.restaurantName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Deliver to: {order.deliveryAddressSnapshot.label} (
                          {order.deliveryAddressSnapshot.streetAddress})
                        </p>

                        <ul className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-800">
                          {order.items.map((item) => (
                            <li key={item.id} className="font-semibold">
                              {item.quantity}x {item.itemNameSnapshot}
                              {item.modifiers.length > 0 && (
                                <span className="block text-[10px] font-normal text-slate-500">
                                  +{" "}
                                  {item.modifiers
                                    .map((m) => m.modifierNameSnapshot)
                                    .join(", ")}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        {order.specialInstructions && (
                          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                            Note: {order.specialInstructions}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCents(order.totalCents)}
                          </span>
                        </div>

                        {col.nextStatus && (
                          <button
                            type="button"
                            disabled={advanceMutation.isPending}
                            onClick={() =>
                              advanceMutation.mutate({
                                orderId: order.id,
                                newStatus: col.nextStatus!,
                                message:
                                  col.defaultLogMessage ??
                                  `Status advanced to ${col.nextStatus}`,
                              })
                            }
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
                          >
                            <span>{col.nextActionLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {order.status !== "DELIVERED" &&
                          order.status !== "CANCELLED" && (
                            <button
                              type="button"
                              disabled={advanceMutation.isPending}
                              onClick={() =>
                                advanceMutation.mutate({
                                  orderId: order.id,
                                  newStatus: "CANCELLED",
                                  message:
                                    "Ticket cancelled by merchant kitchen operator.",
                                })
                              }
                              className="flex w-full items-center justify-center gap-1 rounded-lg border border-rose-200 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>Cancel Ticket</span>
                            </button>
                          )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-Time Menu Inventory Toggling Panel (Mandatory Feature #1) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <ChefHat className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Real-Time Kitchen Inventory & Stock Availability Control
              </h3>
              <p className="text-xs text-slate-500">
                Toggle dish availability immediately across customer discovery &
                AI Concierge catalogs
              </p>
            </div>
          </div>

          <select
            value={selectedRestaurantId}
            onChange={(e) => setSelectedRestaurantId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
          >
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01">
              Osteria Fiamma & Wood-Fired Kitchen
            </option>
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02">
              Verdant Vitality & Macro Bowls
            </option>
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03">
              Saffron & Ember Royal Tandoor
            </option>
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04">
              Kitsune Craft Ramen & Izakaya Lab
            </option>
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb05">
              Taqueria Sol y Agave Heirloom Masa
            </option>
            <option value="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb06">
              Foundry Wagyu Smash & Shake Co.
            </option>
          </select>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(restaurantDetail?.categories ?? [])
            .flatMap((c) => c.items)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatCents(item.basePriceCents)} •{" "}
                    {item.isAvailable ? "In Stock" : "86'd / Sold Out"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleStockMutation.mutate({
                      menuItemId: item.id,
                      isAvailable: !item.isAvailable,
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    item.isAvailable
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  {item.isAvailable ? (
                    <>
                      <ToggleRight className="h-4 w-4" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" />
                      <span>Sold Out</span>
                    </>
                  )}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
