import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Clock,
  Bike,
  MapPin,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { MenuSection } from "../components/menu/MenuSection";
import { ItemCustomizerModal } from "../components/menu/ItemCustomizerModal";
import { useAppStore } from "../context/store";
import { api, formatCents } from "../api/client";
import type { DietaryFlag, MenuItem } from "@hyperlocal/shared";

const STOREFRONT_DIETARY_TAGS: DietaryFlag[] = [
  "Vegan",
  "Halal",
  "Gluten-Free",
  "Keto",
  "Nut-Free",
  "Dairy-Free",
  "Organic",
];

export const RestaurantStorefrontPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    latitude,
    longitude,
    strictDietaryFilters,
    toggleStrictDietaryFilter,
    requestAddItem,
    setCartDrawerOpen,
    items,
  } = useAppStore();

  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant-detail", id, latitude, longitude],
    queryFn: () => api.getRestaurantDetail(id!, latitude, longitude),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-6xl p-8">
          <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-xl p-12 text-center">
          <h2 className="text-xl font-bold text-slate-900">
            Restaurant Not Found
          </h2>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discovery</span>
          </Link>
        </div>
      </div>
    );
  }

  const handleSelectItem = (item: MenuItem) => {
    if (item.modifierGroups.length > 0) {
      setCustomizingItem(item);
    } else {
      const status = requestAddItem({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        menuItemId: item.id,
        dishName: item.name,
        imageUrl: item.imageUrl,
        basePriceCents: item.basePriceCents,
        quantity: 1,
        selectedModifiers: [],
      });
      if (status === "ADDED") {
        setCartDrawerOpen(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Navbar />

      {/* Storefront Hero Banner */}
      <div className="relative h-72 w-full overflow-hidden bg-slate-900 sm:h-80">
        <img
          src={restaurant.bannerImageUrl}
          alt={restaurant.name}
          className="h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        <div className="mx-auto flex h-full max-w-7xl flex-col justify-between px-4 py-6 sm:px-6">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All Restaurants</span>
            </Link>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex items-start gap-4">
              <img
                src={restaurant.logoImageUrl}
                alt={restaurant.name}
                className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-xl"
              />
              <div className="text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold sm:text-3xl">
                    {restaurant.name}
                  </h1>
                  {restaurant.aiTrendingBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      {restaurant.aiTrendingBadge}
                    </span>
                  )}
                </div>

                <p className="mt-1 max-w-2xl text-xs text-slate-200">
                  {restaurant.description}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-200">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 font-bold text-white">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {Number(restaurant.rating).toFixed(1)} (
                    {restaurant.ratingCount} ratings)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    {restaurant.estimatedDeliveryMinutes ?? 24} mins ETA
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5 text-orange-400" />
                    {formatCents(
                      restaurant.calculatedDeliveryFeeCents ?? 299
                    )}{" "}
                    radial delivery ({restaurant.distanceKm ?? 1.8} km)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {restaurant.address}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-xs font-extrabold text-white shadow-lg transition hover:bg-orange-700"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>
                Open Active Basket (
                {items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Storefront Body */}
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {/* Dietary Filter Bar for Menu */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Filter Digital Menu by Dietary Tag:
            </span>
            {STOREFRONT_DIETARY_TAGS.map((tag) => {
              const active = strictDietaryFilters.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleStrictDietaryFilter(tag)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-medium text-slate-500">
            Hours: {restaurant.operatingHours ?? "11:00 AM – 10:30 PM"}
          </span>
        </div>

        {/* Category Jump Pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {restaurant.categories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-orange-300 hover:text-orange-600"
            >
              {cat.name} ({cat.items.length})
            </a>
          ))}
        </div>

        {/* Categorized Menu Sections */}
        <div className="space-y-6">
          {restaurant.categories.map((category) => (
            <div key={category.id} id={`cat-${category.id}`}>
              <MenuSection
                category={category}
                activeDietaryFilters={strictDietaryFilters}
                onSelectItem={handleSelectItem}
              />
            </div>
          ))}
        </div>
      </main>

      <ItemCustomizerModal
        item={customizingItem}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        onClose={() => setCustomizingItem(null)}
        onConfirmAdd={(payload) => {
          const status = requestAddItem(payload);
          if (status === "ADDED") {
            setCartDrawerOpen(true);
          }
        }}
      />
    </div>
  );
};
