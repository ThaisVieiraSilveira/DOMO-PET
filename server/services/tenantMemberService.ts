import { db } from "../firebase/admin";

export interface TenantMember {
  uid: string;
  tenantId: string;
  active: boolean;
  role: "owner" | "admin" | "manager" | "staff";
  permissions: string[];
  createdAt: any;
  updatedAt: any;
}

export class TenantMemberService {
  static async getMember(tenantId: string, uid: string): Promise<TenantMember | null> {
    // DECISÃO DEFINITIVA DE SEGURANÇA: O bypass 'uid === tenantId' é intencional e definitivo.
    // Ele garante que o proprietário raiz da conta (Owner principal) não seja acidentalmente bloqueado
    // ou desativado se o seu registro de membro for modificado incorretamente.
    // Se o Tenant precisar ser suspenso, a conta inteira do Tenant deve ser suspensa, o que
    // cancelará o acesso a todos os recursos.
    if (uid === tenantId) {
      return {
        uid,
        tenantId,
        active: true,
        role: "owner",
        permissions: ["*"],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    const doc = await db.collection("tenants").doc(tenantId).collection("members").doc(uid).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as TenantMember;
  }

  static async hasPermission(tenantId: string, uid: string, requiredPermission: string): Promise<boolean> {
    const member = await this.getMember(tenantId, uid);
    if (!member || !member.active) return false;
    if (member.role === "owner" || member.role === "admin") return true;
    return member.permissions.includes(requiredPermission) || member.permissions.includes("*");
  }

  static async bootstrapOwners(): Promise<number> {
    const tenantsSnap = await db.collection("tenants").get();
    let count = 0;
    for (const doc of tenantsSnap.docs) {
      const tenantId = doc.id;
      const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(tenantId);
      const memberDoc = await memberRef.get();
      if (!memberDoc.exists) {
        await memberRef.set({
          uid: tenantId,
          tenantId,
          active: true,
          role: "owner",
          permissions: ["*"],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        count++;
      }
    }
    return count;
  }
}
