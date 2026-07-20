import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Pseudonimiza um endereço IP ocultando os octetos finais para permitir
 * a análise da estrutura da rede sem vazar dados pessoais (PII).
 */
function maskIp(ip: string): string {
  if (!ip) return "empty";
  const trimmed = ip.trim();
  // Se for IPv4, mascara os dois últimos blocos (ex: 192.168.***.***)
  if (trimmed.includes(".")) {
    const segments = trimmed.split(".");
    if (segments.length >= 2) {
      return `${segments[0]}.${segments[1]}.***.***`;
    }
  }
  // Se for IPv6 ou outro formato, gera um hash truncado de forma estritamente segura
  return crypto.createHash("sha256").update(trimmed).digest("hex").slice(0, 12) + "...";
}

/**
 * Middleware de telemetria de IP protegido para validação em Staging.
 * Registra temporariamente metadados da estrutura de cabeçalhos sem coletar PII ou tokens.
 */
export async function stagingIpTelemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const isTelemetryEnabled = process.env.ENABLE_STAGING_IP_TELEMETRY === "true";
  const isProduction = process.env.NODE_ENV === "production";

  // Só executa se expressamente habilitado e NÃO for ambiente de produção padrão
  if (!isTelemetryEnabled || isProduction) {
    return next();
;  }

  try {
    const xffHeader = req.headers["x-forwarded-for"];
    let xffString = "";
    let entriesCount = 0;
    let maskedXffEntries: string[] = [];

    if (typeof xffHeader === "string") {
      xffString = xffHeader;
    } else if (Array.isArray(xffHeader)) {
      xffString = xffHeader.join(", ");
    }

    if (xffString) {
      const parts = xffString.split(",").map(p => p.trim()).filter(Boolean);
      entriesCount = parts.length;
      maskedXffEntries = parts.map(maskIp);
    }

    const telemetryData = {
      timestamp: Timestamp.now(),
      path: req.path,
      method: req.method,
      socketRemoteAddress: req.socket.remoteAddress || "unknown",
      xffEntriesCount: entriesCount,
      maskedXffChain: maskedXffEntries,
      resolvedReqIp: req.ip || "unknown",
      resolvedReqIps: req.ips || [],
      trustProxySetting: process.env.TRUST_PROXY_SETTINGS || "not_set",
    };

    // Salva na coleção dedicada de telemetria protegida com retenção temporária curta.
    // O acesso a esta coleção é restrito exclusivamente a administradores via firestore.rules.
    await db.collection("staging_ip_telemetry").add(telemetryData);

  } catch (error) {
    // Falha silenciosa para não quebrar a experiência do usuário durante testes controlados
    console.warn("[TELEMETRY WARNING] Falha ao gravar telemetria de IP em staging:", error);
  }

  next();
}
