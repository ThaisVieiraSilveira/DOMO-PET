import crypto from "crypto";
import { db } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { AuditService } from "./auditService";

export class TutorTokenService {
  static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  static async generateLink(tenantId: string, petId: string, userId: string, expiresInDays = 30): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateSecureToken();
    const hash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const expiresTimestamp = Timestamp.fromDate(expiresAt);

    await db.runTransaction(async (transaction) => {
      const petRef = db.collection("pets").doc(petId);
      const petDoc = await transaction.get(petRef);
      if (!petDoc.exists) {
        throw new Error("Pet not found");
      }
      const petData = petDoc.data()!;
      if (petData.tenant_id !== tenantId) {
        throw new Error("Pet does not belong to this tenant");
      }

      // Check and revoke any existing active link
      const oldHash = petData.activeAccessHash;
      if (oldHash) {
        const oldLinkRef = db.collection("tutorAccessLinks").doc(oldHash);
        transaction.update(oldLinkRef, {
          active: false,
          revokedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      const linkRef = db.collection("tutorAccessLinks").doc(hash);
      const tokenVersion = (petData.tokenVersion || 0) + 1;

      transaction.set(linkRef, {
        active: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        expiresAt: expiresTimestamp,
        revokedAt: null,
        tenantId,
        petId,
        tokenVersion,
        createdBy: userId,
        
        // Initial defaults
        crecheNome: "",
        petNome: petData.pet_nome || "",
        petFotoUrl: petData.foto || null,
        diasFrequenta: petData.dia_semana || null,
        statusHoje: "Ausente",
        timelinePublica: [],
        momentosPublicos: [],
        boletinsPublicos: [],
        hasPublicAllergyNotice: petData.possui_alergia === "Sim",
        hasPublicCareNotice: petData.possui_doenca === "Sim",
      });

      transaction.update(petRef, {
        activeAccessHash: hash,
        tokenVersion,
        accessExpiresAt: expiresTimestamp,
        tutorAccessEnabled: true,
      });
    });

    await AuditService.logEvent({
      tenantId,
      userId,
      action: "generate_link",
      petId,
      details: `Generated new secure link with hash ${hash.substring(0, 8)}... expires at ${expiresAt.toISOString()}`
    });

    return { token, expiresAt };
  }

  static async revokeLink(tenantId: string, petId: string, userId: string): Promise<void> {
    await db.runTransaction(async (transaction) => {
      const petRef = db.collection("pets").doc(petId);
      const petDoc = await transaction.get(petRef);
      if (!petDoc.exists) {
        throw new Error("Pet not found");
      }
      const petData = petDoc.data()!;
      if (petData.tenant_id !== tenantId) {
        throw new Error("Pet does not belong to this tenant");
      }

      const activeHash = petData.activeAccessHash;
      if (activeHash) {
        const linkRef = db.collection("tutorAccessLinks").doc(activeHash);
        transaction.update(linkRef, {
          active: false,
          revokedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      transaction.update(petRef, {
        activeAccessHash: null,
        tutorAccessEnabled: false,
      });
    });

    await AuditService.logEvent({
      tenantId,
      userId,
      action: "revoke_link",
      petId,
      details: "Revoked active secure access link"
    });
  }
}
