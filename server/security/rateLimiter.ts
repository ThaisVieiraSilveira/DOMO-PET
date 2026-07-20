import { Request, Response, NextFunction } from "express";
import { db } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

export interface RateLimiter {
  checkLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetTime: Date }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.cache.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: limit - 1, resetTime: new Date(resetTime) };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetTime: new Date(entry.resetTime) };
    }

    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, resetTime: new Date(entry.resetTime) };
  }
}

export class FirestoreRateLimiter implements RateLimiter {
  async checkLimit(key: string, limit: number, windowMs: number) {
    const now = new Date();
    // Ensure key is perfectly safe for Firestore document path by hashing
    const safeKey = crypto.createHash("sha256").update(key).digest("hex");
    const ref = db.collection("rate_limits").doc(safeKey);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const resetTime = new Date(now.getTime() + windowMs);

        if (!doc.exists) {
          transaction.set(ref, {
            count: 1,
            resetAt: Timestamp.fromDate(resetTime),
          });
          return { allowed: true, remaining: limit - 1, resetTime };
        }

        const data = doc.data()!;
        const resetAt = (data.resetAt as Timestamp).toDate();

        if (now > resetAt) {
          transaction.set(ref, {
            count: 1,
            resetAt: Timestamp.fromDate(resetTime),
          });
          return { allowed: true, remaining: limit - 1, resetTime };
        }

        if (data.count >= limit) {
          return { allowed: false, remaining: 0, resetTime: resetAt };
        }

        const newCount = data.count + 1;
        transaction.update(ref, { count: newCount });
        return { allowed: true, remaining: limit - newCount, resetTime: resetAt };
      });

      return result;
    } catch (error) {
      // Fallback if firestore transaction fails, default allow to avoid breaking production
      console.error("FirestoreRateLimiter error:", error);
      return { allowed: true, remaining: 1, resetTime: new Date(now.getTime() + windowMs) };
    }
  }
}

// Global instance based on config
export const rateLimiter: RateLimiter = process.env.NODE_ENV === "production" 
  ? new FirestoreRateLimiter() 
  : new MemoryRateLimiter();

// Daily rotating HMAC salt for IP pseudonimization
export function getRotatingSalt(): string {
  const saltSecret = process.env.RATE_LIMIT_SALT_SECRET;
  if (!saltSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RATE_LIMIT_SALT_SECRET is missing in production environment. Failing safe.");
    }
    // Safe high-entropy fallback for local/test execution only
    const devFallback = "dev_fallback_high_entropy_master_secret_key_987654321";
    const dateStr = new Date().toISOString().slice(0, 10);
    return crypto.createHmac("sha256", devFallback).update(dateStr).digest("hex");
  }
  
  const dateStr = new Date().toISOString().slice(0, 10); // changes daily
  return crypto.createHmac("sha256", saltSecret).update(dateStr).digest("hex");
}

export function resolveClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress: string | undefined,
  trustProxySetting: string | undefined
): string {
  const socketIp = remoteAddress || "127.0.0.1";

  // Parse trust proxy settings
  let trustProxyHops = 0;
  let trustAll = false;

  if (trustProxySetting === "true") {
    trustAll = true;
  } else if (trustProxySetting && !isNaN(Number(trustProxySetting))) {
    trustProxyHops = Number(trustProxySetting);
  }

  // If no proxy is trusted, return the socket IP directly
  if (!trustAll && trustProxyHops <= 0) {
    return socketIp;
  }

  const xff = headers["x-forwarded-for"];
  if (!xff) {
    return socketIp;
  }

  const xffString = Array.isArray(xff) ? xff.join(", ") : xff;
  if (!xffString.trim()) {
    return socketIp;
  }

  const parts = xffString.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return socketIp;
  }

  if (trustAll) {
    // If trusting all proxies, the leftmost IP is assumed to be the client
    return parts[0];
  }

  // If trusting N hops, the true client IP is at index: parts.length - N
  const clientIndex = parts.length - trustProxyHops;
  if (clientIndex >= 0) {
    return parts[clientIndex];
  }

  // Fallback if there are fewer hops than configured
  return parts[0];
}

export function createRateLimitMiddleware(limit: number, windowMs: number, keyPrefix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract IP safely using the secure resolveClientIp function with env settings
    const trustProxySetting = process.env.TRUST_PROXY_SETTINGS;
    const ip = resolveClientIp(req.headers, req.socket.remoteAddress, trustProxySetting);
    
    try {
      // O endereço IP é pseudonimizado por HMAC com chave secreta do servidor
      const salt = getRotatingSalt();
      const anonymizedIp = crypto.createHmac("sha256", salt).update(ip).digest("hex");
      const key = `${keyPrefix}_${anonymizedIp}`;
      
      const result = await rateLimiter.checkLimit(key, limit, windowMs);
      
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader("X-RateLimit-Reset", result.resetTime.toISOString());

      if (!result.allowed) {
        res.status(429).json({
          error: "Too Many Requests",
          message: "Acesso temporariamente bloqueado devido a excesso de requisições.",
          resetAt: result.resetTime.toISOString()
        });
        return;
      }
      next();
    } catch (error) {
      console.error("Rate Limiter error (Failing safe by blocking request):", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Erro interno no processamento de segurança."
      });
    }
  };
}
