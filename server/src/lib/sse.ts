import type { Response } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import type { OrderEventRecord, OrderRecord } from "@hyperlocal/shared";

interface SSEClient {
  id: string;
  orderId: string;
  res: Response;
}

class SSEBroadcastHub {
  private clients: Map<string, Set<SSEClient>> = new Map();

  public generateTrackingToken(orderId: string, customerId: string): string {
    const hmac = crypto
      .createHmac("sha256", env.JWT_SECRET)
      .update(`${orderId}:${customerId}`)
      .digest("hex")
      .slice(0, 24);
    return `trk_${hmac}`;
  }

  public verifyTrackingAccess(
    order: OrderRecord,
    providedToken?: string,
    authenticatedUserId?: string,
    userRole?: string
  ): boolean {
    if (
      providedToken &&
      (providedToken === order.trackingToken ||
        providedToken ===
          this.generateTrackingToken(order.id, order.customerId))
    ) {
      return true;
    }
    if (
      authenticatedUserId &&
      (authenticatedUserId === order.customerId ||
        userRole === "MERCHANT" ||
        userRole === "ADMIN" ||
        userRole === "COURIER")
    ) {
      return true;
    }
    return false;
  }

  public addClient(orderId: string, res: Response): SSEClient {
    const client: SSEClient = {
      id: crypto.randomUUID(),
      orderId,
      res,
    };
    let set = this.clients.get(orderId);
    if (!set) {
      set = new Set();
      this.clients.set(orderId, set);
    }
    set.add(client);
    return client;
  }

  public removeClient(client: SSEClient): void {
    const set = this.clients.get(client.orderId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) {
      this.clients.delete(client.orderId);
    }
  }

  public broadcastOrderUpdate(
    order: OrderRecord,
    latestEvent?: OrderEventRecord
  ): void {
    const set = this.clients.get(order.id);
    if (!set || set.size === 0) return;

    const payload = JSON.stringify({
      type: "ORDER_LIFECYCLE_UPDATE",
      timestamp: new Date().toISOString(),
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      telemetry: order.telemetry,
      latestEvent: latestEvent ?? order.events[order.events.length - 1] ?? null,
      events: order.events,
    });

    for (const client of set) {
      try {
        client.res.write(`event: order_update\ndata: ${payload}\n\n`);
      } catch {
        this.removeClient(client);
      }
    }
  }
}

export const sseHub = new SSEBroadcastHub();
