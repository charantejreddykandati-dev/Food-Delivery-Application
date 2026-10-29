import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "../../context/store";
import { api, formatCents } from "../../api/client";

export const CartDrawer: React.FC = () => {
  const navigate = useNavigate();
  const {
    isCartDrawerOpen,
    setCartDrawerOpen,
    restaurantId,
    restaurantName,
    items,
    latitude,
    longitude,
    deliveryMode,
    promoCode,
    tipCents,
    updateItemQuantity,
    removeItem,
    clearCart,
    requestAddItem,
  } = useAppStore();

  const cartPayloadItems = items.map((i) => ({
    menuItemId: i.menuItemId,
    quantity: i.quantity,
    selectedModifiers: i.selectedModifiers,
    specialNotes: i.specialNotes,
  }));

  const { data: serverValidation } = useQuery({
    queryKey: [
      "cart-validate",
      restaurantId,
      cartPayloadItems,
      latitude,
      longitude,
      deliveryMode,
      promoCode,
      tipCents,
    ],
    queryFn: () =>
      api.validateCart({
        restaurantId: restaurantId!,
        items: cartPayloadItems,
        customerLatitude: latitude,
        customerLongitude: longitude,
        deliveryMode,
        promoCode: promoCode || undefined,
        tipCents,
      }),
    enabled: Boolean(isCartDrawerOpen && restaurantId && items.length > 0),
  });

  const { data: aiUpsells, isLoading: upsellLoading } = useQuery({
    queryKey: ["cart-ai-upsell", restaurantId, items.map((i) => i.menuItemId).join(",")],
    queryFn: () =>
      api.getAiUpsells({
        restaurantId: restaurantId!,
        items: cartPayloadItems,
      }),
    enabled: Boolean(isCartDrawerOpen && restaurantId && items.length > 0),
  });

  if (!isCartDrawerOpen) return null;

  const fallbackSubtotalCents = items.reduce((sum, item) => {
    const modSum = item.selectedModifiers.reduce(
      (m, mod) => m + mod.extraPriceCents,
      0
    );
    return sum + (item.basePriceCents + modSum) * item.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Your Order Basket
              </h2>
              {restaurantName ? (
                <p className="text-xs font-semibold text-orange-600">
                  {restaurantName}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Single-Merchant Guarded</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCartDrawerOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
              Your hyperlocal basket is empty
            </h3>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Explore artisanal local kitchens or ask the Gemini 2.5 Flash
              Culinary Concierge to build a personalized meal bundle.
            </p>
            <button
              type="button"
              onClick={() => {
                setCartDrawerOpen(false);
                navigate("/");
              }}
              className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
            >
              Browse Nearby Restaurants
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable Items & AI Upsell */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Line Items */}
              <div className="space-y-3">
                {items.map((item) => {
                  const modSum = item.selectedModifiers.reduce(
                    (m, mod) => m + mod.extraPriceCents,
                    0
                  );
                  const lineTotal =
                    (item.basePriceCents + modSum) * item.quantity;
                  return (
                    <div
                      key={item.cartItemKey}
                      className="flex gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.dishName}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {item.dishName}
                          </h4>
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {formatCents(lineTotal)}
                          </span>
                        </div>

                        {item.selectedModifiers.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                            {item.selectedModifiers.map((m) => (
                              <li key={m.modifierOptionId}>
                                + {m.modifierName}{" "}
                                {m.extraPriceCents > 0
                                  ? `(${formatCents(m.extraPriceCents)})`
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        )}

                        {item.specialNotes && (
                          <p className="mt-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] italic text-amber-800">
                            Note: &ldquo;{item.specialNotes}&rdquo;
                          </p>
                        )}

                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateItemQuantity(item.cartItemKey, -1)
                              }
                              className="p-0.5 text-slate-600 hover:text-slate-900"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateItemQuantity(item.cartItemKey, 1)
                              }
                              className="p-0.5 text-slate-600 hover:text-slate-900"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.cartItemKey)}
                            className="text-[11px] font-medium text-slate-400 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gemini 2.5 Flash Smart Cart Upsell Widget */}
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-indigo-50/60 to-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-violet-700">
                  <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider">
                    {aiUpsells?.pitchHeadline ??
                      "Gemini 2.5 Flash Smart Cart Pairings"}
                  </h4>
                </div>

                {upsellLoading ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Analyzing flavor affinities for your basket...
                  </p>
                ) : aiUpsells && aiUpsells.recommendations.length > 0 ? (
                  <div className="mt-3 space-y-2.5">
                    {aiUpsells.recommendations.map((rec) => (
                      <div
                        key={rec.menuItemId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white bg-white/90 p-2.5 shadow-sm"
                      >
                        {rec.imageUrl && (
                          <img
                            src={rec.imageUrl}
                            alt={rec.name}
                            className="h-11 w-11 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {rec.name}
                          </p>
                          <p className="line-clamp-2 text-[11px] text-slate-500">
                            {rec.pairingReason}
                          </p>
                          <span className="text-[11px] font-extrabold text-violet-700">
                            +{formatCents(rec.priceCents)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!restaurantId || !restaurantName) return;
                            requestAddItem({
                              restaurantId,
                              restaurantName,
                              menuItemId: rec.menuItemId,
                              dishName: rec.name,
                              imageUrl: rec.imageUrl ?? "",
                              basePriceCents: rec.priceCents,
                              quantity: 1,
                              selectedModifiers: [],
                            });
                          }}
                          className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-violet-700"
                        >
                          + Pair
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Your basket already covers our top recommended pairings!
                  </p>
                )}
              </div>

              {/* Server-Verified Pricing Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Food Subtotal (DB-Verified)</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCents(
                      serverValidation?.subtotalCents ?? fallbackSubtotalCents
                    )}
                  </span>
                </div>
                {serverValidation && serverValidation.discountCents > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-semibold">
                    <span>Promo ({serverValidation.appliedPromoCode})</span>
                    <span className="font-mono">
                      -{formatCents(serverValidation.discountCents)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Radial Delivery Fee (
                    {serverValidation
                      ? `${serverValidation.distanceKm} km`
                      : "Calculated"}
                    )
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCents(serverValidation?.deliveryFeeCents ?? 299)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Estimated Tax (8.25%)</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCents(
                      serverValidation?.taxCents ??
                        Math.round(fallbackSubtotalCents * 0.0825)
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                  <span>Estimated Total</span>
                  <span className="font-mono">
                    {formatCents(
                      serverValidation?.totalCents ??
                        fallbackSubtotalCents +
                          299 +
                          Math.round(fallbackSubtotalCents * 0.0825) +
                          tipCents
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Zero-trust server price recalculation • Est.{" "}
                    {serverValidation?.estimatedTotalMinutes ?? 24} mins
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Checkout CTA */}
            <div className="border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate("/checkout");
                }}
                className="flex w-full items-center justify-between rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-700"
              >
                <span>Proceed to Checkout</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">
                    {formatCents(
                      serverValidation?.totalCents ??
                        fallbackSubtotalCents + 299 + tipCents
                    )}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
