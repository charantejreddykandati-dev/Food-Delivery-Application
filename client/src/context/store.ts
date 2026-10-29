import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CartItemModifierSelection,
  DeliveryMode,
  DietaryFlag,
} from "@hyperlocal/shared";

export interface LocalCartItem {
  cartItemKey: string;
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  dishName: string;
  imageUrl: string;
  basePriceCents: number;
  quantity: number;
  selectedModifiers: CartItemModifierSelection[];
  specialNotes?: string;
}

export interface PendingMerchantConflict {
  currentRestaurantName: string;
  newRestaurantId: string;
  newRestaurantName: string;
  item: Omit<LocalCartItem, "cartItemKey">;
}

interface AppState {
  // Active Location
  selectedAddressId: string;
  selectedAddressLabel: string;
  selectedStreetAddress: string;
  latitude: number;
  longitude: number;
  setActiveLocation: (loc: {
    addressId: string;
    label: string;
    streetAddress: string;
    latitude: number;
    longitude: number;
  }) => void;

  // Dietary Presets (Section 9)
  strictDietaryFilters: DietaryFlag[];
  toggleStrictDietaryFilter: (flag: DietaryFlag) => void;
  clearDietaryFilters: () => void;

  // Cart & Single-Merchant Guard
  restaurantId: string | null;
  restaurantName: string | null;
  items: LocalCartItem[];
  deliveryMode: DeliveryMode;
  scheduledWindow: string;
  promoCode: string;
  tipCents: number;
  pendingMerchantConflict: PendingMerchantConflict | null;

  requestAddItem: (item: Omit<LocalCartItem, "cartItemKey">) => "ADDED" | "CONFLICT";
  confirmReplaceCartWithPending: () => void;
  cancelMerchantConflict: () => void;
  updateItemQuantity: (cartItemKey: string, delta: number) => void;
  removeItem: (cartItemKey: string) => void;
  clearCart: () => void;
  rehydrateCartFromOrder: (payload: {
    restaurantId: string;
    restaurantName: string;
    items: Omit<LocalCartItem, "cartItemKey">[];
  }) => void;
  setDeliveryMode: (mode: DeliveryMode) => void;
  setScheduledWindow: (windowStr: string) => void;
  setPromoCode: (code: string) => void;
  setTipCents: (cents: number) => void;

  // UI Overlays
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  isConciergeModalOpen: boolean;
  setConciergeModalOpen: (open: boolean) => void;
  isLocationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;
}

function buildCartItemKey(
  menuItemId: string,
  modifiers: CartItemModifierSelection[],
  notes?: string
): string {
  const modKey = [...modifiers]
    .map((m) => m.modifierOptionId)
    .sort()
    .join("|");
  return `${menuItemId}::${modKey}::${(notes ?? "").trim()}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedAddressId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      selectedAddressLabel: "Home",
      selectedStreetAddress: "742 Valencia Street, Apt 4B, San Francisco",
      latitude: 37.7611,
      longitude: -122.4216,
      setActiveLocation: (loc) =>
        set({
          selectedAddressId: loc.addressId,
          selectedAddressLabel: loc.label,
          selectedStreetAddress: loc.streetAddress,
          latitude: loc.latitude,
          longitude: loc.longitude,
        }),

      strictDietaryFilters: [],
      toggleStrictDietaryFilter: (flag) =>
        set((state) => ({
          strictDietaryFilters: state.strictDietaryFilters.includes(flag)
            ? state.strictDietaryFilters.filter((f) => f !== flag)
            : [...state.strictDietaryFilters, flag],
        })),
      clearDietaryFilters: () => set({ strictDietaryFilters: [] }),

      restaurantId: null,
      restaurantName: null,
      items: [],
      deliveryMode: "STANDARD",
      scheduledWindow: "Today, 6:30 PM – 7:00 PM",
      promoCode: "",
      tipCents: 400,
      pendingMerchantConflict: null,

      requestAddItem: (incoming) => {
        const state = get();
        if (
          state.items.length > 0 &&
          state.restaurantId &&
          state.restaurantId !== incoming.restaurantId
        ) {
          set({
            pendingMerchantConflict: {
              currentRestaurantName: state.restaurantName ?? "Previous Merchant",
              newRestaurantId: incoming.restaurantId,
              newRestaurantName: incoming.restaurantName,
              item: incoming,
            },
          });
          return "CONFLICT";
        }

        const key = buildCartItemKey(
          incoming.menuItemId,
          incoming.selectedModifiers,
          incoming.specialNotes
        );
        const existingIndex = state.items.findIndex(
          (i) => i.cartItemKey === key
        );
        let nextItems: LocalCartItem[];
        if (existingIndex >= 0) {
          nextItems = state.items.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + incoming.quantity }
              : item
          );
        } else {
          nextItems = [
            ...state.items,
            {
              ...incoming,
              cartItemKey: key,
            },
          ];
        }

        set({
          restaurantId: incoming.restaurantId,
          restaurantName: incoming.restaurantName,
          items: nextItems,
          pendingMerchantConflict: null,
        });
        return "ADDED";
      },

      confirmReplaceCartWithPending: () => {
        const conflict = get().pendingMerchantConflict;
        if (!conflict) return;
        const key = buildCartItemKey(
          conflict.item.menuItemId,
          conflict.item.selectedModifiers,
          conflict.item.specialNotes
        );
        set({
          restaurantId: conflict.newRestaurantId,
          restaurantName: conflict.newRestaurantName,
          items: [{ ...conflict.item, cartItemKey: key }],
          pendingMerchantConflict: null,
          isCartDrawerOpen: true,
        });
      },

      cancelMerchantConflict: () => set({ pendingMerchantConflict: null }),

      updateItemQuantity: (cartItemKey, delta) =>
        set((state) => {
          const next = state.items
            .map((item) =>
              item.cartItemKey === cartItemKey
                ? { ...item, quantity: item.quantity + delta }
                : item
            )
            .filter((item) => item.quantity > 0);
          return {
            items: next,
            restaurantId: next.length > 0 ? state.restaurantId : null,
            restaurantName: next.length > 0 ? state.restaurantName : null,
          };
        }),

      removeItem: (cartItemKey) =>
        set((state) => {
          const next = state.items.filter((i) => i.cartItemKey !== cartItemKey);
          return {
            items: next,
            restaurantId: next.length > 0 ? state.restaurantId : null,
            restaurantName: next.length > 0 ? state.restaurantName : null,
          };
        }),

      clearCart: () =>
        set({
          restaurantId: null,
          restaurantName: null,
          items: [],
          promoCode: "",
        }),

      rehydrateCartFromOrder: (payload) => {
        const built: LocalCartItem[] = payload.items.map((item) => ({
          ...item,
          cartItemKey: buildCartItemKey(
            item.menuItemId,
            item.selectedModifiers,
            item.specialNotes
          ),
        }));
        set({
          restaurantId: payload.restaurantId,
          restaurantName: payload.restaurantName,
          items: built,
          pendingMerchantConflict: null,
          isCartDrawerOpen: true,
        });
      },

      setDeliveryMode: (mode) => set({ deliveryMode: mode }),
      setScheduledWindow: (windowStr) => set({ scheduledWindow: windowStr }),
      setPromoCode: (code) => set({ promoCode: code }),
      setTipCents: (cents) => set({ tipCents: cents }),

      isCartDrawerOpen: false,
      setCartDrawerOpen: (open) => set({ isCartDrawerOpen: open }),
      isConciergeModalOpen: false,
      setConciergeModalOpen: (open) => set({ isConciergeModalOpen: open }),
      isLocationModalOpen: false,
      setLocationModalOpen: (open) => set({ isLocationModalOpen: open }),
    }),
    {
      name: "cravepulse-hyperlocal-store-v1",
      partialize: (state) => ({
        selectedAddressId: state.selectedAddressId,
        selectedAddressLabel: state.selectedAddressLabel,
        selectedStreetAddress: state.selectedStreetAddress,
        latitude: state.latitude,
        longitude: state.longitude,
        strictDietaryFilters: state.strictDietaryFilters,
        restaurantId: state.restaurantId,
        restaurantName: state.restaurantName,
        items: state.items,
        deliveryMode: state.deliveryMode,
        scheduledWindow: state.scheduledWindow,
        promoCode: state.promoCode,
        tipCents: state.tipCents,
      }),
    }
  )
);
