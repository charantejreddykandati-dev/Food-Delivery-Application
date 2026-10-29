import pg from "pg";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import {
  SEED_CUSTOMER_ADDRESSES,
  SEED_INITIAL_ORDERS,
  SEED_RESTAURANTS,
  SEED_USERS,
} from "./seed-data.js";
import type {
  CustomerAddress,
  MenuItem,
  ModifierOption,
  OrderEventRecord,
  OrderRecord,
  OrderStatus,
  RestaurantDetail,
  RestaurantSummary,
  UserProfile,
} from "@hyperlocal/shared";

const { Pool } = pg;

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 2500,
  idleTimeoutMillis: 10000,
  max: 10,
});

let pgConnected = false;

export async function checkPostgresConnection(): Promise<boolean> {
  try {
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
    pgConnected = true;
    return true;
  } catch {
    pgConnected = false;
    return false;
  }
}

export function isPostgresConnected(): boolean {
  return pgConnected;
}

/**
 * Haversine radial distance in kilometers between two lat/lng coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function calculateDeliveryFeeByDistanceCents(distanceKm: number): number {
  const base = env.BASE_DELIVERY_FEE_CENTS;
  const perKm = env.PER_KM_DELIVERY_FEE_CENTS;
  return Math.round(base + distanceKm * perKm);
}

class HyperlocalDatabase {
  private users: Map<string, UserProfile> = new Map();
  private addresses: Map<string, CustomerAddress> = new Map();
  private restaurants: Map<string, RestaurantDetail> = new Map();
  private orders: Map<string, OrderRecord> = new Map();
  private nextOrderNumber = 1042;

  constructor() {
    this.seedMemoryStore();
  }

  public seedMemoryStore(): void {
    this.users.clear();
    this.addresses.clear();
    this.restaurants.clear();
    this.orders.clear();

    for (const u of SEED_USERS) {
      this.users.set(u.id,structuredClone(u));
    }
    for (const a of SEED_CUSTOMER_ADDRESSES) {
      this.addresses.set(a.id, structuredClone(a));
    }
    for (const r of SEED_RESTAURANTS) {
      this.restaurants.set(r.id, structuredClone(r));
    }
    for (const o of SEED_INITIAL_ORDERS) {
      this.orders.set(o.id, structuredClone(o));
      if (o.orderNumber >= this.nextOrderNumber) {
        this.nextOrderNumber = o.orderNumber + 1;
      }
    }
  }

  public getUsers(): UserProfile[] {
    return Array.from(this.users.values());
  }

  public getUserById(id: string): UserProfile | undefined {
    return this.users.get(id);
  }

  public getCustomerAddresses(userId: string): CustomerAddress[] {
    return Array.from(this.addresses.values()).filter(
      (addr) => addr.userId === userId
    );
  }

  public getAddressById(addressId: string): CustomerAddress | undefined {
    return this.addresses.get(addressId);
  }

  public addCustomerAddress(
    userId: string,
    payload: Omit<CustomerAddress, "id" | "userId" | "createdAt">
  ): CustomerAddress {
    const id = crypto.randomUUID();
    if (payload.isDefault) {
      for (const existing of this.addresses.values()) {
        if (existing.userId === userId) {
          existing.isDefault = false;
        }
      }
    }
    const created: CustomerAddress = {
      ...payload,
      id,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.addresses.set(id, created);
    return created;
  }

  public queryRestaurants(params: {
    search?: string;
    cuisine?: string;
    dietary?: string;
    serviceTier?: string;
    sortBy?: "rating" | "distance" | "eta" | "price_asc";
    lat?: number;
    lng?: number;
    page?: number;
    limit?: number;
  }): {
    restaurants: RestaurantSummary[];
    total: number;
    page: number;
    limit: number;
  } {
    const refLat = params.lat ?? 37.7611;
    const refLng = params.lng ?? -122.4216;
    const searchLower = params.search?.trim().toLowerCase();
    const cuisineFilter = params.cuisine?.trim();
    const dietaryFilter = params.dietary?.trim();
    const serviceTierFilter = params.serviceTier?.trim();

    let matching: RestaurantSummary[] = [];

    for (const rest of this.restaurants.values()) {
      if (!rest.isActive) continue;

      if (
        cuisineFilter &&
        cuisineFilter !== "All" &&
        !rest.cuisineTypes.some(
          (c) => c.toLowerCase() === cuisineFilter.toLowerCase()
        )
      ) {
        continue;
      }

      if (
        serviceTierFilter &&
        serviceTierFilter !== "All" &&
        !rest.serviceTiers.some(
          (t) => t.toLowerCase() === serviceTierFilter.toLowerCase()
        )
      ) {
        continue;
      }

      const allItems = rest.categories.flatMap((cat) => cat.items);

      if (dietaryFilter && dietaryFilter !== "All") {
        const filters = dietaryFilter
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        const hasCompatibleDish = allItems.some(
          (item) =>
            item.isAvailable &&
            filters.every((f) =>
              item.dietaryFlags.some((df) => df.toLowerCase() === f)
            )
        );
        if (!hasCompatibleDish) continue;
      }

      if (searchLower) {
        const nameMatch = rest.name.toLowerCase().includes(searchLower);
        const descMatch = rest.description.toLowerCase().includes(searchLower);
        const cuisineMatch = rest.cuisineTypes.some((c) =>
          c.toLowerCase().includes(searchLower)
        );
        const itemMatch = allItems.some(
          (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            item.description.toLowerCase().includes(searchLower) ||
            item.dietaryFlags.some((d) => d.toLowerCase().includes(searchLower))
        );
        if (!nameMatch && !descMatch && !cuisineMatch && !itemMatch) {
          continue;
        }
      }

      const distanceKm = calculateDistanceKm(
        refLat,
        refLng,
        rest.latitude,
        rest.longitude
      );
      if (distanceKm > env.DEFAULT_SEARCH_RADIUS_KM * 2) {
        continue;
      }

      const activeKitchenOrders = this.getActiveOrdersCountForRestaurant(rest.id);
      const kitchenLoadDelay = Math.min(12, activeKitchenOrders * 3);
      const transitMinutes = Math.max(5, Math.round(distanceKm * 3.8));
      const estimatedDeliveryMinutes =
        rest.basePrepTimeMinutes + transitMinutes + kitchenLoadDelay;
      const calculatedDeliveryFeeCents =
        calculateDeliveryFeeByDistanceCents(distanceKm);

      const { categories: _categories, ...summary } = rest;
      matching.push({
        ...summary,
        distanceKm,
        estimatedDeliveryMinutes,
        calculatedDeliveryFeeCents,
      });
    }

    const sortBy = params.sortBy ?? "rating";
    matching.sort((a, b) => {
      if (sortBy === "distance") {
        return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
      }
      if (sortBy === "eta") {
        return (
          (a.estimatedDeliveryMinutes ?? 30) -
          (b.estimatedDeliveryMinutes ?? 30)
        );
      }
      if (sortBy === "price_asc") {
        return a.priceBracket.length - b.priceBracket.length;
      }
      return b.rating - a.rating;
    });

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const start = (page - 1) * limit;
    const paged = matching.slice(start, start + limit);

    return {
      restaurants: paged,
      total: matching.length,
      page,
      limit,
    };
  }

  public getAllRestaurantsDetail(): RestaurantDetail[] {
    return Array.from(this.restaurants.values()).map((r) => structuredClone(r));
  }

  public getRestaurantById(
    idOrSlug: string,
    lat = 37.7611,
    lng = -122.4216
  ): RestaurantDetail | undefined {
    let found = this.restaurants.get(idOrSlug);
    if (!found) {
      for (const r of this.restaurants.values()) {
        if (r.slug === idOrSlug) {
          found = r;
          break;
        }
      }
    }
    if (!found) return undefined;

    const clone = structuredClone(found);
    const distanceKm = calculateDistanceKm(
      lat,
      lng,
      clone.latitude,
      clone.longitude
    );
    const activeKitchenOrders = this.getActiveOrdersCountForRestaurant(clone.id);
    const kitchenLoadDelay = Math.min(12, activeKitchenOrders * 3);
    const transitMinutes = Math.max(5, Math.round(distanceKm * 3.8));
    clone.distanceKm = distanceKm;
    clone.estimatedDeliveryMinutes =
      clone.basePrepTimeMinutes + transitMinutes + kitchenLoadDelay;
    clone.calculatedDeliveryFeeCents =
      calculateDeliveryFeeByDistanceCents(distanceKm);
    return clone;
  }

  public findMenuItem(menuItemId: string): {
    restaurant: RestaurantDetail;
    item: MenuItem;
  } | null {
    for (const rest of this.restaurants.values()) {
      for (const cat of rest.categories) {
        for (const item of cat.items) {
          if (item.id === menuItemId) {
            return { restaurant: rest, item };
          }
        }
      }
    }
    return null;
  }

  public toggleMenuItemAvailability(
    menuItemId: string,
    isAvailable: boolean
  ): MenuItem | null {
    for (const rest of this.restaurants.values()) {
      for (const cat of rest.categories) {
        for (const item of cat.items) {
          if (item.id === menuItemId) {
            item.isAvailable = isAvailable;
            return structuredClone(item);
          }
        }
      }
    }
    return null;
  }

  public findModifierOption(
    item: MenuItem,
    modifierOptionId: string
  ): ModifierOption | null {
    for (const group of item.modifierGroups) {
      for (const opt of group.options) {
        if (opt.id === modifierOptionId) {
          return opt;
        }
      }
    }
    return null;
  }

  public getActiveOrdersCountForRestaurant(restaurantId: string): number {
    let count = 0;
    for (const ord of this.orders.values()) {
      if (
        ord.restaurantId === restaurantId &&
        (ord.status === "PAID" ||
          ord.status === "CONFIRMED" ||
          ord.status === "PREPARING")
      ) {
        count++;
      }
    }
    return count;
  }

  public insertOrder(
    order: Omit<OrderRecord, "orderNumber">
  ): OrderRecord {
    const orderNumber = this.nextOrderNumber++;
    const fullOrder: OrderRecord = {
      ...structuredClone(order),
      orderNumber,
    };
    this.orders.set(fullOrder.id, fullOrder);
    return structuredClone(fullOrder);
  }

  public getOrderById(orderId: string): OrderRecord | undefined {
    const record = this.orders.get(orderId);
    return record ? structuredClone(record) : undefined;
  }

  public updateOrder(
    orderId: string,
    updater: (draft: OrderRecord) => void
  ): OrderRecord | undefined {
    const existing = this.orders.get(orderId);
    if (!existing) return undefined;
    updater(existing);
    existing.updatedAt = new Date().toISOString();
    return structuredClone(existing);
  }

  public getOrdersForCustomer(customerId: string): OrderRecord[] {
    return Array.from(this.orders.values())
      .filter((o) => o.customerId === customerId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((o) => structuredClone(o));
  }

  public getMerchantOrders(statuses?: OrderStatus[]): OrderRecord[] {
    const allowed =
      statuses && statuses.length > 0
        ? new Set(statuses)
        : new Set<OrderStatus>([
            "PAID",
            "CONFIRMED",
            "PREPARING",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
          ]);
    return Array.from(this.orders.values())
      .filter((o) => allowed.has(o.status))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((o) => structuredClone(o));
  }

  public appendOrderEvent(event: OrderEventRecord): void {
    const existing = this.orders.get(event.orderId);
    if (existing) {
      existing.events.push(structuredClone(event));
      existing.updatedAt = event.createdAt;
    }
  }
}

export const db = new HyperlocalDatabase();

export async function runSchemaMigration(): Promise<{
  mode: "POSTGRESQL" | "EMBEDDED_RELATIONAL_STORE";
  tablesInitialized: number;
  seededRestaurants: number;
  seededMenuItems: number;
}> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(__dirname, "./schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const connected = await checkPostgresConnection();
  if (connected) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  db.seedMemoryStore();
  const restaurants = db.getAllRestaurantsDetail();
  const itemCount = restaurants.reduce(
    (sum, r) =>
      sum + r.categories.reduce((cSum, c) => cSum + c.items.length, 0),
    0
  );

  return {
    mode: connected ? "POSTGRESQL" : "EMBEDDED_RELATIONAL_STORE",
    tablesInitialized: 10,
    seededRestaurants: restaurants.length,
    seededMenuItems: itemCount,
  };
}
