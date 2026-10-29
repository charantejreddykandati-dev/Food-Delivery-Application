import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { CheckoutForm } from "../components/checkout/CheckoutForm";
import { useAppStore } from "../context/store";

export const CheckoutPage: React.FC = () => {
  const { items, restaurantId } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to={restaurantId ? `/restaurant/${restaurantId}` : "/"}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-600"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Menu</span>
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              Order Staging & Zero-Trust Settlement
            </h1>
            <p className="text-xs text-slate-500">
              Server-side price recalculation, radial Haversine delivery fee &
              multi-gateway authorization
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-slate-900">
              Your checkout basket is empty
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Add dishes from a local merchant or ask our Gemini 2.5 Flash
              Culinary Concierge to curate a meal.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
            >
              Explore Restaurants
            </Link>
          </div>
        ) : (
          <CheckoutForm />
        )}
      </main>
    </div>
  );
};
