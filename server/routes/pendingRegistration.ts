import { Router, Request, Response } from "express";
import { db } from "../firebase/admin";
import { pendingRegistrationSchema } from "../schemas/pendingRegistration";
import { createRateLimitMiddleware } from "../security/rateLimiter";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

// Rate limiting for pending registration submissions
const regRateLimiter = createRateLimitMiddleware(10, 60 * 60 * 1000, "public_registration"); // Max 10 per hour

router.post("/", regRateLimiter, async (req: Request, res: Response) => {
  try {
    const validated = pendingRegistrationSchema.parse(req.body);

    // Check if the tenant/creche actually exists
    const tenantDoc = await db.collection("tenants").doc(validated.tenant_id).get();
    if (!tenantDoc.exists) {
      res.status(404).json({ error: "Creche/Tenant não encontrado" });
      return;
    }

    // Force values inside the server instead of trusting client
    const record = {
      ...validated,
      status: "pending",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Create a new document under cadastros_pendentes collection
    const ref = db.collection("cadastros_pendentes").doc();
    await ref.set(record);

    res.status(201).json({ success: true, message: "Cadastro recebido com sucesso! Aguarde a aprovação." });

  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Dados inválidos", details: error.errors });
    } else {
      console.error("Pending registration error:", error);
      res.status(500).json({ error: "Erro ao enviar cadastro" });
    }
  }
});

export default router;
