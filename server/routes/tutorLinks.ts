import { Router, Response } from "express";
import { verifyIdToken, AuthenticatedRequest } from "../auth/verifyIdToken";
import { requireTenantPermission } from "../auth/requireTenantPermission";
import { TutorTokenService } from "../services/tutorTokenService";
import { TutorSummaryService } from "../services/tutorSummaryService";
import { generateLinkSchema, revokeLinkSchema, syncSummarySchema } from "../schemas/tutorLinks";

const router = Router();

// Endpoint to generate a new secure tutor link
router.post("/generate", verifyIdToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = generateLinkSchema.parse(req.body);
    const userId = req.user!.uid;
    
    // Check permission inside the handler
    await requireTenantPermission("tutor_links.generate")(req, res, async () => {
      const { token, expiresAt } = await TutorTokenService.generateLink(
        parsed.tenantId,
        parsed.petId,
        userId,
        parsed.expiresInDays
      );
      
      // Immediately run sync to populate the first version
      try {
        await TutorSummaryService.syncSummary(parsed.tenantId, parsed.petId, userId);
      } catch (syncErr) {
        console.error("Initial sync error:", syncErr);
      }

      res.status(200).json({ token, expiresAt: expiresAt.toISOString() });
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error generating tutor link:", error);
      res.status(500).json({ error: error.message || "Failed to generate link" });
    }
  }
});

// Endpoint to revoke the active tutor link
router.post("/revoke", verifyIdToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = revokeLinkSchema.parse(req.body);
    const userId = req.user!.uid;

    await requireTenantPermission("tutor_links.revoke")(req, res, async () => {
      await TutorTokenService.revokeLink(parsed.tenantId, parsed.petId, userId);
      res.status(200).json({ success: true, message: "Link revogado com sucesso" });
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error revoking tutor link:", error);
      res.status(500).json({ error: error.message || "Failed to revoke link" });
    }
  }
});

// Endpoint to sync the public tutor summary manually
router.post("/sync", verifyIdToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = syncSummarySchema.parse(req.body);
    const userId = req.user!.uid;

    await requireTenantPermission("tutor_links.generate")(req, res, async () => {
      await TutorSummaryService.syncSummary(parsed.tenantId, parsed.petId, userId);
      res.status(200).json({ success: true, message: "Resumo sincronizado com sucesso" });
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error syncing tutor summary:", error);
      res.status(500).json({ error: error.message || "Failed to sync summary" });
    }
  }
});

export default router;
