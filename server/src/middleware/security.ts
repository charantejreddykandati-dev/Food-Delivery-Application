import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { db } from "../db/index.js";
import { OrderDomainError } from "../services/order.service.js";
import type { UserProfile } from "@hyperlocal/shared";

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export function attachSessionUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const headerUserId = req.header("x-user-id");
  const headerRole = req.header("x-user-role");

  if (headerUserId) {
    const found = db.getUserById(headerUserId);
    if (found) {
      req.user = found;
      return next();
    }
  }

  if (headerRole === "MERCHANT") {
    req.user = db.getUserById("22222222-2222-4222-8222-222222222201");
  } else {
    req.user = db.getUserById("11111111-1111-4111-8111-111111111101");
  }
  next();
}

const aiRateWindowMs = 60 * 1000;
const aiMaxRequestsPerWindow = 10;
const aiRequestTimestamps: Map<string, number[]> = new Map();

export function aiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.user?.id || req.ip || "anonymous";
  const now = Date.now();
  const timestamps = (aiRequestTimestamps.get(key) ?? []).filter(
    (ts) => now - ts < aiRateWindowMs
  );

  if (timestamps.length >= aiMaxRequestsPerWindow) {
    res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many AI Culinary Concierge requests. Maximum 10 requests per minute allowed.",
      retryAfterSeconds: Math.ceil(
        (aiRateWindowMs - (now - timestamps[0])) / 1000
      ),
    });
    return;
  }

  timestamps.push(now);
  aiRequestTimestamps.set(key, timestamps);
  next();
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: err.issues
        .map((i) => `${i.path.join(".") || "payload"}: ${i.message}`)
        .join("; "),
      issues: err.issues,
    });
    return;
  }

  if (err instanceof OrderDomainError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error("[Server Error]", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message:
      err instanceof Error ? err.message : "An unexpected server error occurred.",
  });
}
