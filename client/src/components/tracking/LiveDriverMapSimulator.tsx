import React from "react";
import {
  Navigation,
  Phone,
  Shield,
  CloudSun,
  Store,
  Home,
  Star,
} from "lucide-react";
import type { DriverTelemetry, OrderStatus } from "@hyperlocal/shared";

export const LiveDriverMapSimulator: React.FC<{
  telemetry: DriverTelemetry;
  status: OrderStatus;
  restaurantName: string;
  destinationAddress: string;
}> = ({ telemetry, status, restaurantName, destinationAddress }) => {
  const ratio = Math.min(1, Math.max(0, telemetry.progressRatio ?? 0.25));

  // SVG path coordinates from Merchant (110, 195) to Customer (590, 75)
  const startX = 110;
  const startY = 195;
  const endX = 590;
  const endY = 75;
  const driverX = Math.round(startX + (endX - startX) * ratio);
  const driverY = Math.round(startY + (endY - startY) * ratio);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-lg">
      {/* Top Telemetry Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-3.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" />
          <span className="font-bold uppercase tracking-wider text-emerald-400">
            Live GPS Telemetry Canvas
          </span>
          <span className="font-mono text-slate-400">
            ({telemetry.currentLatitude.toFixed(4)}°N,{" "}
            {telemetry.currentLongitude.toFixed(4)}°W)
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <CloudSun className="h-4 w-4 text-amber-400" />
          <span>{telemetry.weatherCondition}</span>
        </div>
      </div>

      {/* Interactive SVG City Grid & Route Vector */}
      <div className="relative h-64 w-full bg-slate-900">
        <svg
          viewBox="0 0 700 260"
          className="h-full w-full"
          aria-label="Live Delivery Route Simulator"
        >
          <defs>
            <pattern
              id="cityGrid"
              width="35"
              height="35"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 35 0 L 0 0 0 35"
                fill="none"
                stroke="#1e293b"
                strokeWidth="1"
              />
            </pattern>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          <rect width="700" height="260" fill="url(#cityGrid)" />

          {/* Simulated arterial roads */}
          <path
            d="M 0 195 L 700 195 M 110 0 L 110 260 M 350 0 L 350 260 M 590 0 L 590 260 M 0 75 L 700 75"
            stroke="#334155"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />

          {/* Full Planned Route Line */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="#475569"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Active Completed Route Progress */}
          <line
            x1={startX}
            y1={startY}
            x2={driverX}
            y2={driverY}
            stroke="url(#routeGrad)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Merchant Origin Pin */}
          <g transform={`translate(${startX}, ${startY})`}>
            <circle r="16" fill="#f97316" fillOpacity="0.25" />
            <circle r="9" fill="#f97316" stroke="#ffffff" strokeWidth="2.5" />
            <text
              y="28"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="11"
              fontWeight="bold"
            >
              {restaurantName.slice(0, 22)}
            </text>
          </g>

          {/* Customer Destination Pin */}
          <g transform={`translate(${endX}, ${endY})`}>
            <circle r="16" fill="#10b981" fillOpacity="0.25" />
            <circle r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
            <text
              y="-16"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="11"
              fontWeight="bold"
            >
              {destinationAddress.slice(0, 24)}
            </text>
          </g>

          {/* Moving Courier Marker */}
          <g transform={`translate(${driverX}, ${driverY})`}>
            <circle r="22" fill="#38bdf8" fillOpacity="0.2" />
            <circle r="12" fill="#0284c7" stroke="#ffffff" strokeWidth="3" />
            <text
              y="-18"
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="11"
              fontWeight="bold"
            >
              {telemetry.driverName} • {Math.round(ratio * 100)}%
            </text>
          </g>
        </svg>

        {/* Floating ETA Pill */}
        <div className="absolute bottom-3 right-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Predictive ETA Window
            </p>
            <p className="text-lg font-extrabold text-white">
              {status === "DELIVERED"
                ? "Arrived (0 min)"
                : `${telemetry.etaRemainingMinutes} mins remaining`}
            </p>
          </div>
        </div>
      </div>

      {/* Courier Details Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {telemetry.driverName}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {telemetry.driverRating}
              </span>
            </div>
            <p className="text-slate-400">{telemetry.vehicleDescription}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-300">
          <div className="hidden items-center gap-1.5 md:flex">
            <Store className="h-3.5 w-3.5 text-orange-400" />
            <span>Queue #{telemetry.kitchenQueuePosition}</span>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <Home className="h-3.5 w-3.5 text-emerald-400" />
            <span>Progress {Math.round(ratio * 100)}%</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-200">
            <Phone className="h-3.5 w-3.5 text-emerald-400" />
            {telemetry.driverPhone}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">
            <Shield className="h-3.5 w-3.5" />
            Verified Courier
          </span>
        </div>
      </div>
    </div>
  );
};
