import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface PublicTimelineEvent {
  id: string;
  horario: string;
  tipo: 'alimentacao' | 'medicacao' | 'comportamento' | 'atividades' | 'descanso' | 'fotos' | 'mensagens';
  texto: string;
  imagemUrl?: string;
  atividadeTipo?: string;
  responsavel?: string;
  observacao?: string;
  visivelTutor?: boolean;
}

export interface PublicMomentItem {
  id: string;
  url: string;
  categoria: 'hoje' | 'semana' | 'mes' | 'hospedagem';
  legenda?: string;
  visivelTutor?: boolean;
  criadoEm: string;
}

export interface PublicBulletinItem {
  id: string;
  tipo: 'creche_mensal' | 'hotel';
  titulo: string;
  periodoInicio: string;
  periodoFim: string;
  resumo: string;
  status: string;
  criadoEm: string;
}

export async function updateTutorAccessLinkSummary(
  petId: string,
  data: {
    timelineEvent?: PublicTimelineEvent;
    momentItem?: PublicMomentItem;
    bulletinItem?: PublicBulletinItem;
    statusHoje?: string;
    cuidadosImportantes?: any;
  }
) {
  if (!db) return;
  try {
    // 1. Fetch pet document to find tutorAccessToken
    const petRef = doc(db, 'pets', petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) return;

    const petData = petSnap.data();
    const token = petData.tutorAccessToken;
    if (!token || petData.tutorAccessEnabled === false) return;

    // 2. Reference tutorAccessLinks/{token}
    const linkRef = doc(db, 'tutorAccessLinks', token);
    const linkSnap = await getDoc(linkRef);

    let existingData: any = {};
    if (linkSnap.exists()) {
      existingData = linkSnap.data();
    }

    // 3. Prepare the update fields
    const timelinePublica = existingData.timelinePublica || [];
    if (data.timelineEvent) {
      if (data.timelineEvent.visivelTutor !== false) {
        const filtered = timelinePublica.filter((item: any) => item.id !== data.timelineEvent.id);
        filtered.unshift(data.timelineEvent);
        existingData.timelinePublica = filtered.slice(0, 50);
      }
    }

    const momentosPublicos = existingData.momentosPublicos || [];
    if (data.momentItem) {
      if (data.momentItem.visivelTutor !== false) {
        const filtered = momentosPublicos.filter((item: any) => item.id !== data.momentItem.id);
        filtered.unshift(data.momentItem);
        existingData.momentosPublicos = filtered.slice(0, 50);
      }
    }

    const boletinsPublicos = existingData.boletinsPublicos || [];
    if (data.bulletinItem) {
      const filtered = boletinsPublicos.filter((item: any) => item.id !== data.bulletinItem.id);
      filtered.unshift(data.bulletinItem);
      existingData.boletinsPublicos = filtered.slice(0, 50);
    }

    if (data.statusHoje !== undefined) {
      existingData.statusHoje = data.statusHoje;
    }

    // Combine cuidadosImportantes
    const currentCuidados = existingData.cuidadosImportantes || {};
    const updatedCuidados = {
      possui_alergia: petData.possui_alergia || 'Não',
      alimentos_proibidos: petData.alimentos_proibidos || '',
      tipo_alimentacao: petData.tipo_alimentacao || '',
      quantidade_aproximada: petData.quantidade_aproximada || petData.quantidade_oferecida || '',
      possui_doenca: petData.possui_doenca || 'Não',
      doenca_qual: petData.doenca_qual || '',
      ...currentCuidados,
      ...(data.cuidadosImportantes || {})
    };

    // Build the updated/new public summary document payload
    const payload = {
      token,
      active: true,
      ativo: true,
      crecheId: petData.tenant_id || '',
      petId,
      petNome: petData.pet_nome || '',
      petFotoUrl: petData.foto || '',
      crecheNome: existingData.crecheNome || '',
      tutorNome: petData.tutor_nome || '',
      diasFrequenta: petData.dia_semana || '',
      statusHoje: data.statusHoje || existingData.statusHoje || 'Em casa 🏠',
      cuidadosImportantes: updatedCuidados,
      momentosPublicos: existingData.momentosPublicos || [],
      boletinsPublicos: existingData.boletinsPublicos || [],
      timelinePublica: existingData.timelinePublica || [],
      updatedAt: serverTimestamp()
    };

    // If crecheNome is empty, try to fetch the tenant name
    if (!payload.crecheNome && petData.tenant_id) {
      try {
        const tenantSnap = await getDoc(doc(db, 'tenants', petData.tenant_id));
        if (tenantSnap.exists()) {
          payload.crecheNome = tenantSnap.data().nome || 'Creche Domo Pet';
        }
      } catch (err) {
        console.warn('Could not fetch tenant branding:', err);
      }
    }
    if (!payload.crecheNome) {
      payload.crecheNome = 'Creche Domo Pet';
    }

    await setDoc(linkRef, payload, { merge: true });
    console.log('✅ tutorAccessLinks public summary updated successfully for token:', token);
  } catch (error) {
    console.error('Error updating tutorAccessLink summary:', error);
  }
}
