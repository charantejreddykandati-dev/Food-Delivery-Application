import React from "react";
import { ChefHat, ShieldCheck } from "lucide-react";
import { Navbar } from "../components/common/Navbar";
import { MerchantKanbanBoard } from "../components/merchant/MerchantKanbanBoard";

export const MerchantPortalPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Live Kitchen Display System (KDS) & Merchant Operations
              </h1>
              <p className="text-xs text-slate-500">
                Advance active tickets through deterministic lifecycle stages
                and broadcast real-time SSE updates to customers
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>
              State Machine Guarded: PAID → CONFIRMED → PREPARING →
              OUT_FOR_DELIVERY → DELIVERED
            </span>
          </div>
        </div>

        <MerchantKanbanBoard />
      </main>
    </div>
  );
};
