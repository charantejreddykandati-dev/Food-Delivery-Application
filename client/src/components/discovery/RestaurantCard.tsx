import React from "react";
import { Link } from "react-router-dom";
import { Star, Clock, Bike, Sparkles, MapPin } from "lucide-react";
import type { RestaurantSummary } from "@hyperlocal/shared";
import { formatCents } from "../../api/client";

export const RestaurantCard: React.FC<{ restaurant: RestaurantSummary }> = ({
  restaurant,
}) => {
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl"
    >
      {/* Merchant Banner */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={restaurant.bannerImageUrl}
          alt={restaurant.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />

        {/* AI Trending Badge */}
        {restaurant.aiTrendingBadge && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-amber-300 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>{restaurant.aiTrendingBadge}</span>
          </div>
        )}

        {/* Rating Badge */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-md">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>{Number(restaurant.rating).toFixed(1)}</span>
          <span className="text-[11px] font-normal text-slate-500">
            ({restaurant.ratingCount})
          </span>
        </div>

        {/* Logo & Bottom Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={restaurant.logoImageUrl}
              alt=""
              className="h-11 w-11 rounded-xl border-2 border-white object-cover shadow-md"
            />
            <div>
              <h3 className="text-base font-bold text-white drop-shadow-sm">
                {restaurant.name}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-200">
                <span>{restaurant.priceBracket}</span>
                <span>•</span>
                <span>{restaurant.cuisineTypes.join(" • ")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
          {restaurant.description}
        </p>

        <div className="mt-3">
          {/* Service Tiers & Cuisine Pills */}
          <div className="flex flex-wrap gap-1.5">
            {restaurant.serviceTiers.map((tier) => (
              <span
                key={tier}
                className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700"
              >
                {tier}
              </span>
            ))}
            {restaurant.cuisineTypes.map((cuisine) => (
              <span
                key={cuisine}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {cuisine}
              </span>
            ))}
          </div>

          {/* Dynamic Travel Time, Distance & Delivery Fee Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {restaurant.estimatedDeliveryMinutes ??
                  restaurant.basePrepTimeMinutes + 8}
                –
                {(restaurant.estimatedDeliveryMinutes ??
                  restaurant.basePrepTimeMinutes + 8) + 6}{" "}
                min
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-orange-600" />
              <span>
                {formatCents(restaurant.calculatedDeliveryFeeCents ?? 299)}{" "}
                delivery
              </span>
            </div>

            {restaurant.distanceKm !== undefined && (
              <div className="flex items-center gap-1 text-slate-500">
                <MapPin className="h-3 w-3" />
                <span>{restaurant.distanceKm.toFixed(1)} km</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
