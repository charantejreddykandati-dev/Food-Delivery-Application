import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  X,
  Send,
  ShoppingBag,
  ShieldAlert,
  Flame,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  Wine,
} from "lucide-react";
import { useAppStore } from "../../context/store";
import { api, formatCents } from "../../api/client";
import type { DietaryFlag } from "@hyperlocal/shared";

const DIETARY_OPTIONS: DietaryFlag[] = [
  "Vegan",
  "Halal",
  "Gluten-Free",
  "Keto",
  "Nut-Free",
  "Dairy-Free",
  "Low-FODMAP",
  "Organic",
];

const QUICK_CRAVING_PROMPTS = [
  "High-protein low-carb dinner under $25 delivered in 30 mins",
  "100% Certified Halal charcoal tandoor feast with medium spice",
  "Celiac-safe gluten-free vegan bowl under 600 calories",
  "Late-night artisanal wood-fired sourdough pizza for two",
];

export const AICulinaryConciergeModal: React.FC<{
  inlineMode?: boolean;
}> = ({ inlineMode = false }) => {
  const {
    isConciergeModalOpen,
    setConciergeModalOpen,
    requestAddItem,
    setCartDrawerOpen,
  } = useAppStore();

  const [query, setQuery] = useState(
    "High-protein low-carb dinner under $25 delivered in 30 mins"
  );
  const [maxBudgetDollars, setMaxBudgetDollars] = useState<number>(25);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([
    "Gluten-Free",
  ]);
  const [groupHeadcount, setGroupHeadcount] = useState<number>(1);
  const [calorieTarget, setCalorieTarget] = useState<number>(650);
  const [spiceTolerance, setSpiceTolerance] = useState<number>(2);
  const [maxPrepMinutes, setMaxPrepMinutes] = useState<number>(30);

  const recommendMutation = useMutation({
    mutationFn: api.getAiRecommendations,
  });

  if (!inlineMode && !isConciergeModalOpen) return null;

  const toggleDietary = (flag: string) => {
    setSelectedDietary((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  };

  const handleRunConcierge = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    recommendMutation.mutate({
      query: query.trim(),
      maxBudgetDollars,
      dietaryPreferences: selectedDietary,
      groupHeadcount,
      calorieTarget,
      spiceTolerance,
      maxPrepMinutes,
    });
  };

  const content = (
    <div
      className={
        inlineMode
          ? "w-full rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          : "flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-700 via-indigo-700 to-slate-900 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Sparkles className="h-6 w-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight">
                Gemini 2.5 Flash Executive Culinary Concierge
              </h2>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                JSON Schema Enforced
              </span>
            </div>
            <p className="text-xs text-indigo-200">
              Natural-language craving match, strict allergen screening &
              predictive kitchen ETA synthesizer
            </p>
          </div>
        </div>

        {!inlineMode && (
          <button
            type="button"
            onClick={() => setConciergeModalOpen(false)}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <form onSubmit={handleRunConcierge} className="space-y-4">
          {/* Natural Language Craving Input */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Describe Your Craving, Macro Target, or Occasion
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "High-protein low-carb dinner under $25 delivered in 30 mins"'
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="submit"
                disabled={recommendMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>
                  {recommendMutation.isPending
                    ? "Synthesizing..."
                    : "Match Dishes"}
                </span>
              </button>
            </div>

            {/* Quick Prompt Pills */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_CRAVING_PROMPTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuery(preset)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700"
                >
                  &ldquo;{preset}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Section 9 Advisory Context Parameters */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-5">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <DollarSign className="h-3 w-3 text-violet-600" />
                Budget Ceiling ($)
              </label>
              <input
                type="number"
                min={8}
                max={200}
                value={maxBudgetDollars}
                onChange={(e) => setMaxBudgetDollars(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <Users className="h-3 w-3 text-violet-600" />
                Group Headcount
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={groupHeadcount}
                onChange={(e) => setGroupHeadcount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                Calorie Target (kcal)
              </label>
              <input
                type="number"
                step={50}
                min={150}
                max={2000}
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <Flame className="h-3 w-3 text-rose-500" />
                Spice Scale (0–5): {spiceTolerance}
              </label>
              <input
                type="range"
                min={0}
                max={5}
                value={spiceTolerance}
                onChange={(e) => setSpiceTolerance(Number(e.target.value))}
                className="mt-2 w-full accent-violet-600"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <Clock className="h-3 w-3 text-emerald-600" />
                Max Prep (Mins)
              </label>
              <input
                type="number"
                min={12}
                max={60}
                value={maxPrepMinutes}
                onChange={(e) => setMaxPrepMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Dietary & Lifestyle Presets */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Strict Dietary & Allergen Exclusions
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIETARY_OPTIONS.map((flag) => {
                const active = selectedDietary.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleDietary(flag)}
                    className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {flag}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Results Display */}
        {recommendMutation.data && (
          <div className="space-y-4 border-t border-slate-200 pt-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">
                    Executive Concierge Synthesis
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {recommendMutation.data.recommendationSummary}
                  </p>
                </div>
                {recommendMutation.data.estimatedDeliveryWindow && (
                  <span className="shrink-0 rounded-xl bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                    {recommendMutation.data.estimatedDeliveryWindow}
                  </span>
                )}
              </div>

              {recommendMutation.data.suggestedBeveragePairing && (
                <div className="mt-3 flex items-center gap-2 border-t border-violet-200/60 pt-2.5 text-xs text-violet-900">
                  <Wine className="h-4 w-4 text-violet-600" />
                  <span>
                    <strong>Suggested Sommelier Beverage Pairing:</strong>{" "}
                    {recommendMutation.data.suggestedBeveragePairing}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {recommendMutation.data.matches.map((match) => (
                <div
                  key={match.menuItemId}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-orange-600">
                          {match.restaurantName}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {match.dishName}
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {Math.round(match.dietaryFitScore * 100)}% Fit
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {match.matchReason}
                    </p>

                    {match.allergensDetected &&
                      match.allergensDetected.length > 0 ? (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Allergen Notice: {match.allergensDetected.join(", ")}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2.5 text-[11px] font-semibold text-emerald-700">
                        ✓ Zero common allergens detected
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div>
                      <span className="font-mono text-sm font-extrabold text-slate-900">
                        {formatCents(match.priceCents)}
                      </span>
                      {match.calories && (
                        <span className="ml-2 text-[11px] text-slate-500">
                          • {match.calories} kcal
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const res = requestAddItem({
                          restaurantId: match.restaurantId,
                          restaurantName: match.restaurantName,
                          menuItemId: match.menuItemId,
                          dishName: match.dishName,
                          imageUrl: match.imageUrl ?? "",
                          basePriceCents: match.priceCents,
                          quantity: 1,
                          selectedModifiers: [],
                        });
                        if (res === "ADDED") {
                          if (!inlineMode) setConciergeModalOpen(false);
                          setCartDrawerOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (inlineMode) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
      {content}
    </div>
  );
};
