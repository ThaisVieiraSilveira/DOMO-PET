import { Router, Request, Response } from "express";
import { db } from "../firebase/admin";
import { TutorTokenService } from "../services/tutorTokenService";
import { PublicProfileResponseSchema } from "../schemas/publicProfile";
import { createRateLimitMiddleware } from "../security/rateLimiter";
import { redactToken } from "../security/logRedaction";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

const router = Router();

// Schema for input token
const tokenInputSchema = z.object({
  token: z.string().min(1).max(128),
}).strict();

// Apply tight rate limiting to public profile fetches (e.g. 60 requests per 15 mins)
const publicRateLimiter = createRateLimitMiddleware(60, 15 * 60 * 1000, "public_tutor");

router.post("/tutor-profile", publicRateLimiter, async (req: Request, res: Response) => {
  // Prevent token leakage in logs by redacting
  const sanitizedBody = redactToken(req.body);

  try {
    const { token } = tokenInputSchema.parse(req.body);
    const hash = TutorTokenService.hashToken(token);

    // Fetch the access link document from Firestore
    const linkDoc = await db.collection("tutorAccessLinks").doc(hash).get();
    
    // Generic response message to avoid enumeration/validation leak
    const genericError = "Link inválido, expirado ou desativado.";

    if (!linkDoc.exists) {
      res.status(403).json({ error: "Forbidden", message: genericError });
      return;
    }

    const data = linkDoc.data()!;
    const now = new Date();

    // Verify activation and expiration
    const isActive = data.active === true;
    const isRevoked = data.revokedAt !== null;
    const expiresAt = data.expiresAt ? (data.expiresAt as Timestamp).toDate() : null;
    const isExpired = expiresAt ? now > expiresAt : true;

    if (!isActive || isRevoked || isExpired) {
      res.status(403).json({ error: "Forbidden", message: genericError });
      return;
    }

    // Safely extract allowed fields and structure PublicProfileResponse
    const rawProfile = {
      crecheNome: data.crecheNome || "Creche DOMO",
      crecheSlogan: data.crecheSlogan || null,
      petNome: data.petNome || "Pet",
      petFotoUrl: data.petFotoUrl || null,
      diasFrequenta: data.diasFrequenta || null,
      statusHoje: data.statusHoje || "Ausente",
      alimentosProibidos: data.alimentosProibidos || null,
      tipoAlimentacao: data.tipoAlimentacao || null,
      quantidadeAproximada: data.quantidadeAproximada || null,
      timelinePublica: Array.isArray(data.timelinePublica) ? data.timelinePublica : [],
      momentosPublicos: Array.isArray(data.momentosPublicos) ? data.momentosPublicos : [],
      boletinsPublicos: Array.isArray(data.boletinsPublicos) ? data.boletinsPublicos : [],
      hasPublicAllergyNotice: data.hasPublicAllergyNotice === true,
      hasPublicCareNotice: data.hasPublicCareNotice === true,
      medicacoesPublicas: Array.isArray(data.medicacoesPublicas) ? data.medicacoesPublicas : [],
    };

    // Strict schema check
    const publicProfile = PublicProfileResponseSchema.parse(rawProfile);

    // Apply cache headers preventing intermediaries or local memory storage from caching
    res.setHeader("Cache-Control", "no-store, private, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.status(200).json(publicProfile);

  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Validation failed" });
    } else {
      console.error("Public profile retrieval error (redacted logs):");
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
});

export default router;
