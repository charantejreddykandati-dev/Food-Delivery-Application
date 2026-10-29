import React from "react";
import { Navbar } from "../components/common/Navbar";
import { AICulinaryConciergeModal } from "../components/common/AICulinaryConciergeModal";

export const AIConciergePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <AICulinaryConciergeModal inlineMode={true} />
      </main>
    </div>
  );
};
