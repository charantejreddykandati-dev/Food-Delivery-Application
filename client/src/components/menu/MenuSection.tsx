import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Plus,
  SlidersHorizontal,
  Ban,
} from "lucide-react";
import type { MenuCategory, MenuItem } from "@hyperlocal/shared";
import { formatCents } from "../../api/client";

export const MenuSection: React.FC<{
  category: MenuCategory;
  activeDietaryFilters?: string[];
  onSelectItem: (item: MenuItem) => void;
}> = ({ category, activeDietaryFilters = [], onSelectItem }) => {
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = category.items.filter((item) => {
    if (activeDietaryFilters.length === 0) return true;
    return activeDietaryFilters.every((filter) =>
      item.dietaryFlags.some(
        (df) => df.toLowerCase() === filter.toLowerCase()
      )
    );
  });

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50/70"
      >
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">
            {category.name}
          </h3>
          <p className="text-xs text-slate-500">
            {visibleItems.length}{" "}
            {visibleItems.length === 1 ? "dish" : "dishes"} available
          </p>
        </div>
        {collapsed ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {visibleItems.map((item) => {
            const hasModifiers = item.modifierGroups.length > 0;
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between gap-4 p-5 transition sm:flex-row sm:items-center ${
                  item.isAvailable
                    ? "hover:bg-orange-50/20"
                    : "bg-slate-50/60 opacity-65"
                }`}
              >
                <div className="flex-1 space-y-2 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">
                      {item.name}
                    </h4>
                    {item.calories && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {item.calories} kcal
                      </span>
                    )}
                    {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                        <Flame className="h-3 w-3 fill-rose-500" />
                        <span>Spice {item.spiceLevel}/5</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600">
                    {item.description}
                  </p>

                  {/* Dietary Flags */}
                  {item.dietaryFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.dietaryFlags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-1 text-sm font-extrabold text-slate-900">
                    {formatCents(item.basePriceCents)}
                    {hasModifiers && (
                      <span className="ml-2 text-[11px] font-medium text-slate-400">
                        • Customizable modifiers
                      </span>
                    )}
                  </div>
                </div>

                {/* Dish Image Thumbnail & Action Trigger */}
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-24 w-28 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm"
                      loading="lazy"
                    />
                  )}
                  <button
                    type="button"
                    disabled={!item.isAvailable}
                    onClick={() => onSelectItem(item)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                      item.isAvailable
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "cursor-not-allowed bg-slate-200 text-slate-500"
                    }`}
                  >
                    {!item.isAvailable ? (
                      <>
                        <Ban className="h-3.5 w-3.5" />
                        <span>Sold Out</span>
                      </>
                    ) : hasModifiers ? (
                      <>
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Customize & Add</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add to Basket</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
