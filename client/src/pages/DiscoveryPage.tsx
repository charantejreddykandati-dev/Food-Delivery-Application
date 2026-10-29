import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Flame,
  Zap,
  Award,
  SlidersHorizontal,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { RestaurantCard } from "../components/discovery/RestaurantCard";
import { useAppStore } from "../context/store";
import { api } from "../api/client";
import type { CuisineType, DietaryFlag, ServiceTier } from "@hyperlocal/shared";

const CUISINE_TAXONOMY: ("All" | CuisineType)[] = [
  "All",
  "Italian",
  "South Asian",
  "Pan-Asian",
  "Mexican",
  "American/Burgers",
  "Middle Eastern",
  "Healthy/Bowls",
  "Artisanal Bakery",
];

const DIETARY_PRESETS: DietaryFlag[] = [
  "Vegan",
  "Halal",
  "Gluten-Free",
  "Keto",
  "Nut-Free",
  "Dairy-Free",
  "Low-FODMAP",
  "Organic",
];

const SERVICE_TIERS: ("All" | ServiceTier)[] = [
  "All",
  "Budget Saver",
  "Fast Bites",
  "Chef's Table/Premium",
  "Late-Night Kitchen",
];

export const DiscoveryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [selectedServiceTier, setSelectedServiceTier] = useState<string>("All");
  const [sortBy, setSortBy] = useState<
    "rating" | "distance" | "eta" | "price_asc"
  >("rating");

  const {
    latitude,
    longitude,
    selectedAddressLabel,
    selectedStreetAddress,
    strictDietaryFilters,
    toggleStrictDietaryFilter,
    clearDietaryFilters,
    setConciergeModalOpen,
    setLocationModalOpen,
  } = useAppStore();

  const dietaryParam =
    strictDietaryFilters.length > 0
      ? strictDietaryFilters.join(",")
      : undefined;

  const { data, isLoading } = useQuery({
    queryKey: [
      "restaurants-discovery",
      search,
      selectedCuisine,
      dietaryParam,
      selectedServiceTier,
      sortBy,
      latitude,
      longitude,
    ],
    queryFn: () =>
      api.getRestaurants({
        search: search || undefined,
        cuisine: selectedCuisine,
        dietary: dietaryParam,
        serviceTier: selectedServiceTier,
        sortBy,
        lat: latitude,
        lng: longitude,
      }),
  });

  const restaurants = data?.restaurants ?? [];
  const fastestPicks = [...restaurants]
    .sort(
      (a, b) =>
        (a.estimatedDeliveryMinutes ?? 25) -
        (b.estimatedDeliveryMinutes ?? 25)
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar searchValue={search} onSearchChange={setSearch} />

      {/* Hero Discovery Banner */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-bold text-orange-300">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                <span>
                  Powered by Gemini 2.5 Flash • Radial Geolocation Indexing
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Hyperlocal Artisanal Kitchens,{" "}
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  Tracked to Your Doorstep.
                </span>
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
                Real-time kitchen load telemetry, strict celiac/vegan/halal
                allergen filtering, and deterministic SSE stage tracking from
                wood-fired hearth to your table.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConciergeModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-rose-700"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Ask AI Culinary Concierge</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  <MapPin className="h-4 w-4 text-orange-400" />
                  <span>
                    Precinct: {selectedAddressLabel} ({selectedStreetAddress})
                  </span>
                </button>
              </div>
            </div>

            {/* Right Curated Spotlight Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <Award className="h-6 w-6 text-amber-400" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top Rated
                </p>
                <p className="mt-1 text-sm font-extrabold text-white">
                  4.9★ Local Artisans
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  Verified post-delivery culinary & accuracy scores
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <Zap className="h-6 w-6 text-emerald-400" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Fastest Dispatch
                </p>
                <p className="mt-1 text-sm font-extrabold text-white">
                  {fastestPicks[0]?.estimatedDeliveryMinutes ?? 18} Min ETA
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  Dynamic kitchen queue + coastal weather synthesis
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <Flame className="h-6 w-6 text-rose-400" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  AI Trending
                </p>
                <p className="mt-1 text-sm font-extrabold text-white">
                  Macro & Wood-Fired
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  Personalized dish pairings & dietary fit scoring
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-8 sm:px-6">
        {/* Cuisine Taxonomy Cloud */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Explore by Culinary Taxonomy
            </h2>
            <span className="text-xs text-slate-500">
              {restaurants.length} eligible merchants within radial precinct
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {CUISINE_TAXONOMY.map((cuisine) => {
              const active = selectedCuisine === cuisine;
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => setSelectedCuisine(cuisine)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/40"
                  }`}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </div>

        {/* Strict Dietary & Allergen Filter Bar + Service Tiers + Sort Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Strict Dietary & Allergen Presets:
              </span>
            </div>

            {strictDietaryFilters.length > 0 && (
              <button
                type="button"
                onClick={clearDietaryFilters}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Reset Dietary Exclusions ({strictDietaryFilters.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {DIETARY_PRESETS.map((flag) => {
              const active = strictDietaryFilters.includes(flag);
              return (
                <button
                  key={flag}
                  type="button"
                  onClick={() => toggleStrictDietaryFilter(flag)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  {flag}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
            {/* Service Tiers */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-bold text-slate-500">
                Service Tier:
              </span>
              {SERVICE_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedServiceTier(tier)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    selectedServiceTier === tier
                      ? "bg-orange-100 text-orange-800 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="rating">Top Rated First</option>
                <option value="eta">Fastest Delivery ETA</option>
                <option value="distance">Radial Distance (Closest)</option>
                <option value="price_asc">Price Bracket ($ to $$$)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Restaurant Search Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <h3 className="text-base font-bold text-slate-900">
              No merchants match your current filter combination
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing a dietary exclusion or switching your cuisine filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCuisine("All");
                setSelectedServiceTier("All");
                clearDietaryFilters();
              }}
              className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
