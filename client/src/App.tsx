import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { RestaurantStorefrontPage } from "./pages/RestaurantStorefrontPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderTrackingPage } from "./pages/OrderTrackingPage";
import { OrderHistoryPage } from "./pages/OrderHistoryPage";
import { MerchantPortalPage } from "./pages/MerchantPortalPage";
import { AIConciergePage } from "./pages/AIConciergePage";
import { CartDrawer } from "./components/cart/CartDrawer";
import { AICulinaryConciergeModal } from "./components/common/AICulinaryConciergeModal";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 shadow-lg">
            <h1 className="text-lg font-extrabold text-slate-900">
              Something went wrong in the UI
            </h1>
            <p className="mt-2 text-xs text-slate-600">
              {this.state.error?.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DiscoveryPage />} />
          <Route path="/restaurant/:id" element={<RestaurantStorefrontPage />} />
          <Route path="/cart" element={<CheckoutPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/:id/tracking" element={<OrderTrackingPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/merchant/portal" element={<MerchantPortalPage />} />
          <Route path="/ai-concierge" element={<AIConciergePage />} />
        </Routes>
        <CartDrawer />
        <AICulinaryConciergeModal />
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default App;
