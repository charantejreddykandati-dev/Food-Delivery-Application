import React, { useState, useEffect } from "react";
import { X, Plus, Minus, ShoppingBag, CheckCircle2 } from "lucide-react";
import type {
  CartItemModifierSelection,
  MenuItem,
  ModifierGroup,
  ModifierOption,
} from "@hyperlocal/shared";
import { formatCents } from "../../api/client";

export const ItemCustomizerModal: React.FC<{
  item: MenuItem | null;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onConfirmAdd: (payload: {
    restaurantId: string;
    restaurantName: string;
    menuItemId: string;
    dishName: string;
    imageUrl: string;
    basePriceCents: number;
    quantity: number;
    selectedModifiers: CartItemModifierSelection[];
    specialNotes?: string;
  }) => void;
}> = ({ item, restaurantId, restaurantName, onClose, onConfirmAdd }) => {
  const [quantity, setQuantity] = useState(1);
  const [specialNotes, setSpecialNotes] = useState("");
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, ModifierOption[]>
  >({});

  useEffect(() => {
    if (!item) return;
    setQuantity(1);
    setSpecialNotes("");
    const defaults: Record<string, ModifierOption[]> = {};
    for (const group of item.modifierGroups) {
      if (group.isRequired && group.options.length > 0) {
        const firstAvail = group.options.find((o) => o.isAvailable);
        if (firstAvail) {
          defaults[group.id] = [firstAvail];
        }
      } else {
        defaults[group.id] = [];
      }
    }
    setSelectedByGroup(defaults);
  }, [item]);

  if (!item) return null;

  const handleToggleOption = (group: ModifierGroup, option: ModifierOption) => {
    if (!option.isAvailable) return;
    setSelectedByGroup((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.some((o) => o.id === option.id);

      // Single-select radio behavior
      if (group.maxSelection === 1) {
        if (exists && !group.isRequired) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [option] };
      }

      // Multi-select checkbox with max limit behavior
      if (exists) {
        return {
          ...prev,
          [group.id]: current.filter((o) => o.id !== option.id),
        };
      }
      if (current.length >= group.maxSelection) {
        return prev;
      }
      return {
        ...prev,
        [group.id]: [...current, option],
      };
    });
  };

  const flattenedModifiers: CartItemModifierSelection[] = Object.values(
    selectedByGroup
  )
    .flat()
    .map((opt) => ({
      modifierOptionId: opt.id,
      modifierName: opt.name,
      extraPriceCents: opt.extraPriceCents,
    }));

  const allRequiredSatisfied = item.modifierGroups.every((group) => {
    if (!group.isRequired) return true;
    const count = (selectedByGroup[group.id] ?? []).length;
    return count >= Math.max(1, group.minSelection);
  });

  const modifierSumCents = flattenedModifiers.reduce(
    (sum, m) => sum + m.extraPriceCents,
    0
  );
  const totalUnitCents = item.basePriceCents + modifierSumCents;
  const totalLineCents = totalUnitCents * quantity;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header Image */}
        <div className="relative h-48 w-full bg-slate-100">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/30" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-800 shadow-md transition hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h3 className="text-lg font-extrabold drop-shadow-sm">
              {item.name}
            </h3>
            <p className="text-xs text-slate-200">
              Base Price: {formatCents(item.basePriceCents)}
              {item.calories ? ` • ${item.calories} kcal` : ""}
            </p>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <p className="text-xs leading-relaxed text-slate-600">
            {item.description}
          </p>

          {/* Modifier Groups */}
          {item.modifierGroups.map((group) => {
            const currentSelected = selectedByGroup[group.id] ?? [];
            return (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {group.title}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {group.maxSelection === 1
                        ? "Select 1 option"
                        : `Select up to ${group.maxSelection} options`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      group.isRequired
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {group.isRequired ? "Required" : "Optional"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {group.options.map((opt) => {
                    const isChecked = currentSelected.some(
                      (o) => o.id === opt.id
                    );
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleToggleOption(group, opt)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                          isChecked
                            ? "border-orange-500 bg-orange-50/60 font-semibold text-slate-900"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2
                            className={`h-4 w-4 ${
                              isChecked ? "text-orange-600" : "text-slate-300"
                            }`}
                          />
                          <span>{opt.name}</span>
                        </div>
                        <span className="font-mono text-xs text-slate-600">
                          {opt.extraPriceCents > 0
                            ? `+${formatCents(opt.extraPriceCents)}`
                            : "Included"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Preparation Guidelines */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Special Preparation Instructions (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={250}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="e.g., Sauce on the side, allergy alert, extra crispy..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[24px] text-center text-sm font-bold text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(25, q + 1))}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={!allRequiredSatisfied}
            onClick={() => {
              onConfirmAdd({
                restaurantId,
                restaurantName,
                menuItemId: item.id,
                dishName: item.name,
                imageUrl: item.imageUrl,
                basePriceCents: item.basePriceCents,
                quantity,
                selectedModifiers: flattenedModifiers,
                specialNotes: specialNotes.trim() || undefined,
              });
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Add to Basket • {formatCents(totalLineCents)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
