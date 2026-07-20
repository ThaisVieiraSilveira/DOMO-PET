import { z } from "zod";

function isValidSecureUrl(value: string): boolean {
  try {
    // 1. Basic URL parsing
    const url = new URL(value);
    
    // 2. Prevent credentials / userinfo (XSS / phishing / SSRF)
    if (url.username || url.password) {
      return false;
    }

    // 3. Protocol enforcement: strictly HTTPS in production
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      if (url.protocol !== "https:") {
        return false;
      }
    } else {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return false;
      }
    }

    // 4. Reject double encoding attempts (checking for encoded percent sign "%25")
    if (value.includes("%25")) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    
    // 5. Exact authorized bucket from server config (never client-provided input or fallback)
    const authorizedBucket = process.env.AUTHORIZED_STORAGE_BUCKET;
    if (!authorizedBucket) {
      // Safe failure if config is missing
      return false;
    }
    
    // Decoded path check - single decode allowed
    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.includes("..") || decodedPath.includes("../") || decodedPath.includes("..\\")) {
      return false;
    }

    // 6. Hostname specific checks
    if (hostname === "firebasestorage.googleapis.com") {
      // Firebase Storage serves URLs like: https://firebasestorage.googleapis.com/v0/b/<BUCKET>/o/<PATH>
      // Pathname must start with /v0/b/<BUCKET>/o/
      const prefix = `/v0/b/${authorizedBucket}/o/`;
      if (!url.pathname.startsWith(prefix) && !decodedPath.startsWith(prefix)) {
        return false;
      }
      return true;
    }
    
    if (hostname === "storage.googleapis.com") {
      // Google Cloud Storage serves URLs like: https://storage.googleapis.com/<BUCKET>/<PATH>
      // Pathname must start with /<BUCKET>/
      const prefix = `/${authorizedBucket}/`;
      if (!url.pathname.startsWith(prefix) && !decodedPath.startsWith(prefix)) {
        return false;
      }
      return true;
    }

    // 7. Support unsplash only in test/development (never in production)
    if (!isProd && hostname === "images.unsplash.com") {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}

const secureUrlSchema = z.string().refine(isValidSecureUrl, {
  message: "URL não autorizada ou inválida para o ambiente."
});

export const PublicEventSchema = z.object({
  id: z.string().max(64),
  tipo: z.string().max(30), // e.g., alimentacao, medicacao, etc.
  data: z.string().max(10), // YYYY-MM-DD
  horario: z.string().regex(/^\d{2}:\d{2}$/),
  texto: z.string().max(1000),
  imagemUrl: secureUrlSchema.max(500).nullable().optional(),
}).strict();

export const PublicMomentSchema = z.object({
  id: z.string().max(64),
  url: secureUrlSchema.max(500),
  categoria: z.string().max(100).optional(),
  legenda: z.string().max(500).optional(),
  data: z.string().max(10),
  horario: z.string().regex(/^\d{2}:\d{2}$/),
}).strict();

export const PublicBoletimSchema = z.object({
  id: z.string().max(64),
  data: z.string().max(10),
  comportamento: z.string().max(500).optional(),
  alimentacao: z.string().max(500).optional(),
  socializacao: z.string().max(500).optional(),
  observacoes: z.string().max(1000).optional(),
}).strict();

export const PublicProfileResponseSchema = z.object({
  crecheNome: z.string().max(100),
  crecheSlogan: z.string().max(200).nullable().optional(),
  petNome: z.string().max(100),
  petFotoUrl: secureUrlSchema.max(500).nullable().optional(),
  diasFrequenta: z.string().max(100).nullable().optional(),
  statusHoje: z.string().max(100).nullable().optional(),
  alimentosProibidos: z.string().max(500).nullable().optional(),
  tipoAlimentacao: z.string().max(100).nullable().optional(),
  quantidadeAproximada: z.string().max(100).nullable().optional(),
  
  timelinePublica: z.array(PublicEventSchema).max(30),
  momentosPublicos: z.array(PublicMomentSchema).max(30),
  boletinsPublicos: z.array(PublicBoletimSchema).max(30),
  
  hasPublicAllergyNotice: z.boolean(),
  hasPublicCareNotice: z.boolean(),
  
  medicacoesPublicas: z.array(z.object({
    name: z.string().max(100),
    publicInstructions: z.string().max(500),
    scheduledTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(10),
  }).strict()).max(15).optional(),
}).strict();
