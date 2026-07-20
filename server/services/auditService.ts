import { db } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export class AuditService {
  static async logEvent(params: {
    tenantId: string;
    userId: string;
    action: "generate_link" | "revoke_link" | "regenerate_link" | "sync_summary";
    petId: string;
    details: string;
  }) {
    try {
      const ref = db.collection("tenantAuditLogs").doc();
      await ref.set({
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        petId: params.petId,
        details: params.details,
        timestamp: Timestamp.now(),
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  }
}
