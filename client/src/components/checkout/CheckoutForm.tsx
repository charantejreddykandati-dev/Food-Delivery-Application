import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin,
  CreditCard,
  Wallet,
  Banknote,
  Zap,
  Clock,
  Calendar,
  Tag,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  CloudSun,
} from "lucide-react";
import { useAppStore } from "../../context/store";
import { api, formatCents } from "../../api/client";
import type { DeliveryMode, PaymentGateway } from "@hyperlocal/shared";

export const CheckoutForm: React.FC = () => {
  const navigate = useNavigate();
  const {
    restaurantId,
    restaurantName,
    items,
    selectedAddressId,
    setActiveLocation,
    latitude,
    longitude,
    deliveryMode,
    setDeliveryMode,
    scheduledWindow,
    setScheduledWindow,
    promoCode,
    setPromoCode,
    tipCents,
    setTipCents,
    clearCart,
  } = useAppStore();

  const [promoInput, setPromoInput] = useState(promoCode);
  const [specialInstructions, setSpecialInstructions] = useState(
    "Ring apartment buzzer #4B upon arrival."
  );
  const [paymentGateway, setPaymentGateway] =
    useState<PaymentGateway>("SIMULATED_STRIPE");
  const [cardLast4, setCardLast4] = useState("4242");
  const [customTipDollars, setCustomTipDollars] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: addressesData } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: api.getAddresses,
  });

  const cartPayloadItems = items.map((i) => ({
    menuItemId: i.menuItemId,
    quantity: i.quantity,
    selectedModifiers: i.selectedModifiers,
    specialNotes: i.specialNotes,
  }));

  const { data: validation, isLoading: validating } = useQuery({
    queryKey: [
      "checkout-validate",
      restaurantId,
      cartPayloadItems,
      latitude,
      longitude,
      deliveryMode,
      scheduledWindow,
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
        scheduledWindow:
          deliveryMode === "SCHEDULED" ? scheduledWindow : undefined,
        promoCode: promoCode || undefined,
        tipCents,
      }),
    enabled: Boolean(restaurantId && items.length > 0),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant selected.");
      setCheckoutError(null);
      // Step 1: Create Order in PENDING_PAYMENT with server-recalculated prices
      const createdOrder = await api.createOrder({
        restaurantId,
        deliveryAddressId: selectedAddressId,
        items: cartPayloadItems,
        tipCents,
        specialInstructions,
        deliveryMode,
        scheduledWindow:
          deliveryMode === "SCHEDULED" ? scheduledWindow : undefined,
        promoCode: promoCode || undefined,
        paymentGateway,
      });

      // Step 2: Authorize & Capture Payment -> Transitions to PAID and emits SSE tracking event
      const paidOrder = await api.payOrder(createdOrder.id, {
        paymentGateway,
        cardLast4: cardLast4 || "4242",
      });
      return paidOrder;
    },
    onSuccess: (paidOrder) => {
      clearCart();
      navigate(`/orders/${paidOrder.id}/tracking`);
    },
    onError: (err: Error) => {
      setCheckoutError(err.message);
    },
  });

  const subtotalCents =
    validation?.subtotalCents ??
    items.reduce((s, i) => s + i.basePriceCents * i.quantity, 0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left Column: Configuration Touchpoints */}
      <div className="space-y-6 lg:col-span-7">
        {/* 1. Delivery Address Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-orange-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              1. Delivery Destination & Radial Coordinates
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(addressesData?.addresses ?? []).map((addr) => {
              const active = addr.id === selectedAddressId;
              return (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() =>
                    setActiveLocation({
                      addressId: addr.id,
                      label: addr.label,
                      streetAddress: `${addr.streetAddress}, ${addr.city}`,
                      latitude: Number(addr.latitude),
                      longitude: Number(addr.longitude),
                    })
                  }
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                    active
                      ? "border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        {addr.label}
                      </span>
                      {active && (
                        <CheckCircle2 className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {addr.streetAddress}
                      {addr.apartmentUnit ? `, ${addr.apartmentUnit}` : ""}
                    </p>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">
                    {Number(addr.latitude).toFixed(4)}°N,{" "}
                    {Number(addr.longitude).toFixed(4)}°W
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700">
              Courier Drop-off Instructions
            </label>
            <input
              type="text"
              maxLength={500}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Gate code, apartment buzzer, building landmark..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 2. Delivery Mode Configuration (Section 9) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-orange-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              2. Fulfillment & Dispatch Mode
            </h3>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                {
                  mode: "STANDARD" as DeliveryMode,
                  title: "Standard Courier",
                  subtitle: `${validation?.estimatedTotalMinutes ?? 24} mins • Direct bike/scooter`,
                  badge: "Included",
                  icon: Clock,
                },
                {
                  mode: "PRIORITY_EXPRESS" as DeliveryMode,
                  title: "Priority Express",
                  subtitle: "Direct point-to-point • Faster dispatch",
                  badge: "+$2.99",
                  icon: Zap,
                },
                {
                  mode: "SCHEDULED" as DeliveryMode,
                  title: "Scheduled Window",
                  subtitle: "Select 30-min arrival slot",
                  badge: "No extra fee",
                  icon: Calendar,
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const isSelected = deliveryMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setDeliveryMode(opt.mode)}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-orange-600" />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-extrabold text-slate-900">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {deliveryMode === "SCHEDULED" && (
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700">
                Choose Scheduled Delivery Window
              </label>
              <select
                value={scheduledWindow}
                onChange={(e) => setScheduledWindow(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800"
              >
                <option value="Today, 6:30 PM – 7:00 PM">
                  Today, 6:30 PM – 7:00 PM
                </option>
                <option value="Today, 7:00 PM – 7:30 PM">
                  Today, 7:00 PM – 7:30 PM
                </option>
                <option value="Today, 8:00 PM – 8:30 PM">
                  Today, 8:00 PM – 8:30 PM
                </option>
              </select>
            </div>
          )}
        </div>

        {/* 3. Courier Tip Allocation (Section 9: Fixed $2, $4, $6 or Percentage 15%, 18%, 20%, Custom) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900">
            3. Courier Tip Allocation (100% goes to your driver)
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "$2.00", cents: 200 },
              { label: "$4.00", cents: 400 },
              { label: "$6.00", cents: 600 },
              {
                label: "15%",
                cents: Math.round(subtotalCents * 0.15),
              },
              {
                label: "18%",
                cents: Math.round(subtotalCents * 0.18),
              },
              {
                label: "20%",
                cents: Math.round(subtotalCents * 0.2),
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setTipCents(preset.cents);
                  setCustomTipDollars("");
                }}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  tipCents === preset.cents
                    ? "border-orange-500 bg-orange-600 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                }`}
              >
                {preset.label} ({formatCents(preset.cents)})
              </button>
            ))}

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                step="0.5"
                value={customTipDollars}
                onChange={(e) => {
                  setCustomTipDollars(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val) && val >= 0) {
                    setTipCents(Math.round(val * 100));
                  }
                }}
                placeholder="Custom $"
                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Multi-Method Sandbox Payment Simulator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900">
            4. Sandbox Payment Method
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                id: "SIMULATED_STRIPE" as PaymentGateway,
                label: "Simulated Stripe Card",
                desc: "Instant Auth & Capture",
                icon: CreditCard,
              },
              {
                id: "WALLET_BALANCE" as PaymentGateway,
                label: "CravePulse Wallet",
                desc: "Available Credits ($140.00)",
                icon: Wallet,
              },
              {
                id: "CASH_ON_DELIVERY" as PaymentGateway,
                label: "Pay on Delivery",
                desc: "Contactless Tap / Cash",
                icon: Banknote,
              },
            ].map((gw) => {
              const Icon = gw.icon;
              const active = paymentGateway === gw.id;
              return (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setPaymentGateway(gw.id)}
                  className={`flex flex-col rounded-xl border p-3.5 text-left transition ${
                    active
                      ? "border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon className="h-5 w-5 text-orange-600" />
                  <span className="mt-2 text-xs font-extrabold text-slate-900">
                    {gw.label}
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    {gw.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {paymentGateway === "SIMULATED_STRIPE" && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <CreditCard className="h-5 w-5 text-slate-600" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-slate-900">
                  Sandbox Visa •••• {cardLast4}
                </p>
                <p className="text-[11px] text-slate-500">
                  256-bit tokenized transaction • Transitions PENDING_PAYMENT →
                  PAID
                </p>
              </div>
              <input
                type="text"
                maxLength={4}
                value={cardLast4}
                onChange={(e) =>
                  setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                aria-label="Card Last 4 Digits"
                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-bold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Order Breakdown & Settlement CTA */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
              Verified Single-Merchant Ticket
            </span>
            <h3 className="text-lg font-extrabold text-slate-900">
              {restaurantName ?? "Selected Restaurant"}
            </h3>
            {validation && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                <CloudSun className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Est. Arrival: {validation.estimatedTotalMinutes} mins •{" "}
                  {validation.distanceKm} km radial distance
                </span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
            {(validation?.items ?? []).map((line, idx) => (
              <div
                key={`${line.menuItemId}-${idx}`}
                className="flex items-start justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    {line.quantity}x {line.dishName}
                  </span>
                  {line.selectedModifiers.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      {line.selectedModifiers
                        .map((m) => m.modifierName)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <span className="font-mono font-semibold text-slate-900">
                  {formatCents(line.lineTotalCents)}
                </span>
              </div>
            ))}
          </div>

          {/* Promo Code Input */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-bold text-slate-700">
              Promo Code (Try <code className="text-orange-600">HYPER10</code>,{" "}
              <code className="text-orange-600">WELCOME5</code>, or{" "}
              <code className="text-orange-600">FREEDEL</code>)
            </label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs font-bold uppercase focus:border-orange-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setPromoCode(promoInput.trim())}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-2 border-t border-slate-100 pt-4 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCents(validation?.subtotalCents ?? subtotalCents)}
              </span>
            </div>
            {validation && validation.discountCents > 0 && (
              <div className="flex justify-between font-bold text-emerald-600">
                <span>Promo Discount ({validation.appliedPromoCode})</span>
                <span className="font-mono">
                  -{formatCents(validation.discountCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>
                Delivery Fee ({validation?.distanceKm ?? 1.8} km •{" "}
                {deliveryMode})
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCents(validation?.deliveryFeeCents ?? 299)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Sales Tax (8.25%)</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCents(validation?.taxCents ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Courier Tip</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCents(tipCents)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold text-slate-900">
              <span>Total Settlement</span>
              <span className="font-mono text-orange-600">
                {formatCents(validation?.totalCents ?? subtotalCents + tipCents)}
              </span>
            </div>
          </div>

          {checkoutError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            disabled={
              checkoutMutation.isPending || validating || items.length === 0
            }
            onClick={() => checkoutMutation.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authorizing & Dispatching Order...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>
                  Authorize & Place Order •{" "}
                  {formatCents(
                    validation?.totalCents ?? subtotalCents + tipCents
                  )}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
