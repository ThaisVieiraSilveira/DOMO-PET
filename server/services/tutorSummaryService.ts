import { db } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { AuditService } from "./auditService";

export class TutorSummaryService {
  static async syncSummary(tenantId: string, petId: string, userId: string): Promise<void> {
    const petRef = db.collection("pets").doc(petId);
    const petDoc = await petRef.get();
    if (!petDoc.exists) {
      throw new Error("Pet not found");
    }

    const petData = petDoc.data()!;
    if (petData.tenant_id !== tenantId) {
      throw new Error("Pet does not belong to this tenant");
    }

    const activeHash = petData.activeAccessHash;
    if (!activeHash) {
      return; // No active link, nothing to sync
    }

    // Fetch Tenant Name
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    const crecheNome = tenantDoc.exists ? (tenantDoc.data()!.nome || "Creche DOMO") : "Creche DOMO";

    // Fetch moments where visivelTutor == true, order by criadoEm desc limit 30
    const momentsSnap = await db.collection("pets").doc(petId).collection("moments")
      .where("visivelTutor", "==", true)
      .limit(30)
      .get();
    
    const momentosPublicos = momentsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        url: d.url || "",
        categoria: d.categoria || "",
        legenda: d.legenda || "",
        data: d.data || new Date().toISOString().split("T")[0],
        horario: d.horario || "12:00",
      };
    }).sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario));

    // Fetch timeline events where visivelTutor == true, limit 30
    const timelineSnap = await db.collection("pets").doc(petId).collection("timeline")
      .where("visivelTutor", "==", true)
      .limit(30)
      .get();

    const timelinePublica = timelineSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        tipo: d.tipo || "geral",
        data: d.data || new Date().toISOString().split("T")[0],
        horario: d.horario || "12:00",
        texto: d.texto || "",
        imagemUrl: d.imagemUrl || null,
      };
    }).sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario));

    // Fetch boletins (bulletins) where visivelTutor == true or generally visible to tutor, limit 30
    const boletinsSnap = await db.collection("boletins")
      .where("pet_id", "==", petId)
      .where("tenant_id", "==", tenantId)
      .limit(30)
      .get();
    
    const boletinsPublicos = boletinsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        data: d.data || new Date().toISOString().split("T")[0],
        comportamento: d.comportamento || "",
        alimentacao: d.alimentacao || "",
        socializacao: d.socializacao || "",
        observacoes: d.observacoes || "",
      };
    }).sort((a, b) => b.data.localeCompare(a.data));

    // Compile medications if marked as visibleToTutor
    const medsSnap = await db.collection("medications")
      .where("pet_id", "==", petId)
      .where("tenant_id", "==", tenantId)
      .get();

    const medicacoesPublicas = medsSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          name: d.nome || "",
          publicInstructions: d.instrucoes || "",
          scheduledTimes: Array.isArray(d.horarios) ? d.horarios : [],
          visibleToTutor: d.visibleToTutor === true || d.visivelTutor === true,
        };
      })
      .filter(m => m.visibleToTutor)
      .map(({ name, publicInstructions, scheduledTimes }) => ({
        name,
        publicInstructions,
        scheduledTimes,
      }));

    // Update the public tutor access link document with the fresh compiled summary
    const linkRef = db.collection("tutorAccessLinks").doc(activeHash);
    await linkRef.update({
      updatedAt: Timestamp.now(),
      crecheNome,
      petNome: petData.pet_nome || "",
      petFotoUrl: petData.foto || null,
      diasFrequenta: petData.dia_semana || null,
      statusHoje: petData.statusHoje || "Ausente",
      alimentosProibidos: petData.visibleToTutor ? (petData.alimentos_proibidos || null) : null,
      tipoAlimentacao: petData.visibleToTutor ? (petData.tipo_alimentacao || null) : null,
      quantidadeAproximada: petData.visibleToTutor ? (petData.quantidade_aproximada || null) : null,
      hasPublicAllergyNotice: petData.possui_alergia === "Sim",
      hasPublicCareNotice: petData.possui_doenca === "Sim",
      
      timelinePublica,
      momentosPublicos,
      boletinsPublicos,
      medicacoesPublicas,
    });

    await AuditService.logEvent({
      tenantId,
      userId,
      action: "sync_summary",
      petId,
      details: "Synchronized public tutor profile summary with active data"
    });
  }
}
