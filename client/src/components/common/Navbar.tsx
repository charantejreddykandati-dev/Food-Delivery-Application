import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Search,
  Sparkles,
  ShoppingBag,
  UtensilsCrossed,
  Clock,
  ChefHat,
  ChevronDown,
  AlertTriangle,
  Check,
  Plus,
  X,
} from "lucide-react";
import { useAppStore } from "../../context/store";
import { api, formatCents } from "../../api/client";

export const Navbar: React.FC<{
  searchValue?: string;
  onSearchChange?: (val: string) => void;
}> = ({ searchValue, onSearchChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    selectedAddressId,
    selectedAddressLabel,
    selectedStreetAddress,
    setActiveLocation,
    items,
    setCartDrawerOpen,
    setConciergeModalOpen,
    isLocationModalOpen,
    setLocationModalOpen,
    pendingMerchantConflict,
    confirmReplaceCartWithPending,
    cancelMerchantConflict,
  } = useAppStore();

  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const [newAddressStreet, setNewAddressStreet] = useState("");
  const [newAddressLabel, setNewAddressLabel] = useState("Home");

  const { data: addrData } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: api.getAddresses,
  });

  const createAddressMutation = useMutation({
    mutationFn: api.createAddress,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      setActiveLocation({
        addressId: created.id,
        label: created.label,
        streetAddress: `${created.streetAddress}, ${created.city}`,
        latitude: Number(created.latitude),
        longitude: Number(created.longitude),
      });
      setNewAddressStreet("");
      setLocationModalOpen(false);
    },
  });

  const totalBadgeCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const estimatedSubtotalCents = items.reduce((sum, i) => {
    const modSum = i.selectedModifiers.reduce(
      (mSum, m) => mSum + m.extraPriceCents,
      0
    );
    return sum + (i.basePriceCents + modSum) * i.quantity;
  }, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(localSearch);
    } else {
      navigate(`/?search=${encodeURIComponent(localSearch)}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand & Location Selector Trigger */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-slate-900 hover:opacity-90"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-md shadow-orange-500/20">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                  CravePulse
                </span>
                <span className="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                  Hyperlocal AI
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs transition hover:border-orange-300 hover:bg-orange-50/40"
            >
              <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
              <div className="max-w-[170px] sm:max-w-[220px]">
                <div className="flex items-center gap-1 font-bold text-slate-800">
                  <span>Deliver to: {selectedAddressLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="truncate text-[11px] text-slate-500">
                  {selectedStreetAddress}
                </p>
              </div>
            </button>
          </div>

          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="order-3 w-full md:order-2 md:max-w-md md:flex-1"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchValue !== undefined ? searchValue : localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  onSearchChange?.(e.target.value);
                }}
                placeholder="Search wood-fired pizza, keto bowls, halal, ramen..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </form>

          {/* Navigation Links, AI Concierge Launcher, and Interactive Cart Drawer Trigger */}
          <div className="order-2 flex items-center gap-2 md:order-3">
            <button
              type="button"
              onClick={() => setConciergeModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Concierge</span>
            </button>

            <Link
              to="/ai-concierge"
              className={`hidden rounded-xl px-3 py-2 text-xs font-semibold transition lg:inline-flex items-center gap-1 ${
                location.pathname === "/ai-concierge"
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>Meal Planner</span>
            </Link>

            <Link
              to="/orders"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                location.pathname.startsWith("/orders")
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Orders</span>
            </Link>

            <Link
              to="/merchant/portal"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                location.pathname.startsWith("/merchant")
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Merchant KDS</span>
            </Link>

            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              aria-label="Open shopping cart"
              className="relative flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <ShoppingBag className="h-4 w-4 text-orange-400" />
              <span className="hidden sm:inline">
                {totalBadgeCount > 0
                  ? formatCents(estimatedSubtotalCents)
                  : "Cart"}
              </span>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
                {totalBadgeCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Geolocation Precinct & Address Picker Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Delivery Precinct & Address
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saved Delivery Addresses (Recalculates Radial Fees & ETAs)
              </p>
              {(addrData?.addresses ?? []).map((addr) => {
                const isSelected = addr.id === selectedAddressId;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setActiveLocation({
                        addressId: addr.id,
                        label: addr.label,
                        streetAddress: `${addr.streetAddress}${
                          addr.apartmentUnit ? `, ${addr.apartmentUnit}` : ""
                        }, ${addr.city}`,
                        latitude: Number(addr.latitude),
                        longitude: Number(addr.longitude),
                      });
                      setLocationModalOpen(false);
                    }}
                    className={`flex w-full items-start justify-between rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/60"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {addr.label}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {Number(addr.latitude).toFixed(4)},{" "}
                          {Number(addr.longitude).toFixed(4)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {addr.streetAddress}
                        {addr.apartmentUnit ? `, ${addr.apartmentUnit}` : ""},{" "}
                        {addr.city}, {addr.stateProvince} {addr.postalCode}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-orange-600" />
                    )}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAddressStreet.trim()) return;
                createAddressMutation.mutate({
                  label: newAddressLabel,
                  streetAddress: newAddressStreet.trim(),
                  city: "San Francisco",
                  stateProvince: "CA",
                  postalCode: "94110",
                  latitude: 37.7685,
                  longitude: -122.4155,
                });
              }}
              className="mt-5 border-t border-slate-100 pt-4"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Add New Precinct Address
              </p>
              <div className="flex gap-2">
                <select
                  value={newAddressLabel}
                  onChange={(e) => setNewAddressLabel(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Studio">Studio</option>
                </select>
                <input
                  type="text"
                  value={newAddressStreet}
                  onChange={(e) => setNewAddressStreet(e.target.value)}
                  placeholder="e.g. 450 Hayes St, Apt 3"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={createAddressMutation.isPending}
                  className="flex items-center gap-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single-Merchant Guard Confirmation Modal (Acceptance Criterion #1) */}
      {pendingMerchantConflict && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Start a new basket at {pendingMerchantConflict.newRestaurantName}?
                </h3>
                <p className="text-xs text-slate-500">
                  Single-Merchant Integrity Safeguard
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Your cart currently contains items from{" "}
              <span className="font-semibold text-slate-900">
                {pendingMerchantConflict.currentRestaurantName}
              </span>
              . To ensure accurate kitchen dispatch and hot courier delivery, an
              order can only contain items from a single restaurant. Would you
              like to clear your previous items and add{" "}
              <span className="font-semibold text-slate-900">
                {pendingMerchantConflict.item.dishName}
              </span>
              ?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelMerchantConflict}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Current Basket
              </button>
              <button
                type="button"
                onClick={confirmReplaceCartWithPending}
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
              >
                Clear Previous & Start New Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
