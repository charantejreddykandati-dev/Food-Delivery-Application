import React from "react";
import {
  CreditCard,
  CheckCircle2,
  Flame,
  Bike,
  PackageCheck,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import type { OrderEventRecord, OrderStatus } from "@hyperlocal/shared";

const LIFECYCLE_STEPS: {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    status: "PAID",
    label: "Payment Captured",
    description: "Server-verified pricing locked & sent to kitchen",
    icon: CreditCard,
  },
  {
    status: "CONFIRMED",
    label: "Merchant Confirmed",
    description: "Chef accepted ticket on Kitchen Display System",
    icon: CheckCircle2,
  },
  {
    status: "PREPARING",
    label: "Kitchen Preparing",
    description: "Firing dishes & packaging with thermal seals",
    icon: Flame,
  },
  {
    status: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    description: "Courier en route with live GPS telemetry",
    icon: Bike,
  },
  {
    status: "DELIVERED",
    label: "Delivered",
    description: "Arrived at your destination doorstep",
    icon: PackageCheck,
  },
];

const STATUS_INDEX: Record<OrderStatus, number> = {
  PENDING_PAYMENT: -1,
  PAID: 0,
  CONFIRMED: 1,
  PREPARING: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  CANCELLED: -2,
};

export const OrderTrackingTimeline: React.FC<{
  status: OrderStatus;
  events: OrderEventRecord[];
}> = ({ status, events }) => {
  const currentIdx = STATUS_INDEX[status] ?? 0;

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Deterministic Lifecycle State Machine
          </h3>
          <p className="text-xs text-slate-500">
            Sequential state verification backed by Server-Sent Events (SSE)
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>Current Stage: {status.replace(/_/g, " ")}</span>
        </span>
      </div>

      {status === "CANCELLED" ? (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <XCircle className="h-6 w-6 shrink-0" />
          <div>
            <p className="text-sm font-bold">Order Cancelled</p>
            <p className="text-xs">
              {events[events.length - 1]?.message ??
                "This order was cancelled and refunded."}
            </p>
          </div>
        </div>
      ) : (
        /* Milestone Stepper */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const matchingEvent = events.find(
              (ev) => ev.newStatus === step.status
            );

            return (
              <div
                key={step.status}
                className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition ${
                  isCurrent
                    ? "border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20"
                    : isCompleted
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/60 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isCurrent
                          ? "bg-orange-600 text-white"
                          : isCompleted
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      0{idx + 1}
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-xs font-extrabold text-slate-900">
                    {step.label}
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {step.description}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-200/60 pt-2 text-[10px] font-medium text-slate-500">
                  {matchingEvent ? (
                    <span className="flex items-center gap-1 font-mono text-emerald-700">
                      <Clock className="h-3 w-3" />
                      {new Date(matchingEvent.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  ) : (
                    <span>Pending transition</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Immutable Audit Event Stream (order_events table) */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Immutable Database Audit Log (order_events)
        </h4>
        <div className="mt-3 space-y-2">
          {[...events].reverse().map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col justify-between gap-1 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                  {ev.previousStatus ? `${ev.previousStatus} → ` : ""}
                  {ev.newStatus}
                </span>
                <span className="font-medium text-slate-700">{ev.message}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {new Date(ev.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
