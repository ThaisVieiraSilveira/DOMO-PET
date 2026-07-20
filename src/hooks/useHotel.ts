import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage, isFirebaseConfigured } from '../firebase';
import { HotelStay, HotelRecord, HotelReport } from '../../types';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';
import { compressImage } from '../../utils/image';

const LOCAL_STORAGE_KEYS = {
  stays: 'domo_hotel_stays_v2',
  records: 'domo_hotel_records_v2',
  reports: 'domo_hotel_reports_v2',
};

export function useHotel() {
  const [stays, setStays] = useState<HotelStay[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.stays);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [records, setRecords] = useState<HotelRecord[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.records);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [reports, setReports] = useState<HotelReport[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.reports);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubStays: (() => void) | null = null;
    let unsubRecords: (() => void) | null = null;
    let unsubReports: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      // Clean up previous listeners
      if (unsubStays) { unsubStays(); unsubStays = null; }
      if (unsubRecords) { unsubRecords(); unsubRecords = null; }
      if (unsubReports) { unsubReports(); unsubReports = null; }

      if (!user || !isFirebaseConfigured || !db) {
        // Fallback to local storage
        try {
          const cachedStays = localStorage.getItem(LOCAL_STORAGE_KEYS.stays);
          const cachedRecords = localStorage.getItem(LOCAL_STORAGE_KEYS.records);
          const cachedReports = localStorage.getItem(LOCAL_STORAGE_KEYS.reports);

          if (cachedStays && active) setStays(JSON.parse(cachedStays));
          if (cachedRecords && active) setRecords(JSON.parse(cachedRecords));
          if (cachedReports && active) setReports(JSON.parse(cachedReports));
        } catch (e) {
          console.error("Erro ao carregar dados do hotel do localStorage:", e);
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Listen to hotelStays
        const staysRef = collection(db, 'hotelStays');
        const qStays = query(staysRef, where('tenant_id', '==', user.uid));
        unsubStays = onSnapshot(qStays, (snapshot) => {
          if (!active) return;
          const fetched: HotelStay[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ ...docSnap.data(), id: docSnap.id } as HotelStay);
          });
          fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          logLoad('hotelStays', user.uid, fetched.length);
          setStays(fetched);
          localStorage.setItem(LOCAL_STORAGE_KEYS.stays, JSON.stringify(fetched));
        }, (err) => console.error("Erro stays:", err));

        // 2. Listen to hotelRecords
        const recordsRef = collection(db, 'hotelRecords');
        const qRecords = query(recordsRef, where('tenant_id', '==', user.uid));
        unsubRecords = onSnapshot(qRecords, (snapshot) => {
          if (!active) return;
          const fetched: HotelRecord[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ ...docSnap.data(), id: docSnap.id } as HotelRecord);
          });
          fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          logLoad('hotelRecords', user.uid, fetched.length);
          setRecords(fetched);
          localStorage.setItem(LOCAL_STORAGE_KEYS.records, JSON.stringify(fetched));
        }, (err) => console.error("Erro records:", err));

        // 3. Listen to hotelReports
        const reportsRef = collection(db, 'hotelReports');
        const qReports = query(reportsRef, where('tenant_id', '==', user.uid));
        unsubReports = onSnapshot(qReports, (snapshot) => {
          if (!active) return;
          const fetched: HotelReport[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ ...docSnap.data(), id: docSnap.id } as HotelReport);
          });
          fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          logLoad('hotelReports', user.uid, fetched.length);
          setReports(fetched);
          localStorage.setItem(LOCAL_STORAGE_KEYS.reports, JSON.stringify(fetched));
          setLoading(false);
        }, (err) => {
          console.error("Erro reports:", err);
          setLoading(false);
        });

      } catch (err) {
        console.error("Erro ao inicializar listeners do hotel:", err);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
      if (unsubStays) unsubStays();
      if (unsubRecords) unsubRecords();
      if (unsubReports) unsubReports();
    };
  }, []);

  // Upload file helper
  const uploadPhoto = async (file: File, folderName: string = 'hotel_items'): Promise<string> => {
    const user = auth.currentUser;
    
    // Compress image first!
    let compressedFile = file;
    let compressedBase64 = '';
    try {
      const result = await compressImage(file, 1024, 1024, 0.75);
      compressedFile = result.file;
      compressedBase64 = result.base64;
    } catch (compressErr) {
      console.warn("Could not compress image:", compressErr);
    }

    if (!isFirebaseConfigured || !storage || !user) {
      // Fallback: Convert to base64 string
      if (compressedBase64) return compressedBase64;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const fileRef = ref(storage, `${folderName}/${user.uid}/${Date.now()}_${compressedFile.name}`);
      await uploadBytes(fileRef, compressedFile);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error("Erro no upload do arquivo:", err);
      // Fallback to base64
      if (compressedBase64) return compressedBase64;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  const addStay = async (stayData: Omit<HotelStay, 'id' | 'tenant_id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const tenantId = ensureAuthenticated();
    const newId = doc(collection(db, 'hotelStays')).id || `stay_${Date.now()}`;

    const newStay: HotelStay = {
      ...stayData,
      id: newId,
      tenant_id: tenantId,
      status: 'ativa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "hotelStays",
      documentId: newId,
      userUid: tenantId,
      payload: newStay
    });

    // 1. Save in Firebase first
    if (isFirebaseConfigured && db) {
      try {
        logSave('hotelStays', newId, tenantId, newStay);
        await setDoc(doc(db, 'hotelStays', newId), newStay);
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    // 2. Only upon success, update state & localStorage
    const updated = [newStay, ...stays.filter(s => s.id !== newId)];
    setStays(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.stays, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    return newStay;
  };

  const updateStay = async (stayId: string, fields: Partial<HotelStay>) => {
    const tenantId = ensureAuthenticated();
    const current = stays.find(s => s.id === stayId);
    if (!current) return;

    const updatedStay: HotelStay = {
      ...current,
      ...fields,
      updatedAt: new Date().toISOString(),
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "hotelStays",
      documentId: stayId,
      userUid: tenantId,
      payload: updatedStay
    });

    // 1. Save in Firebase first
    if (isFirebaseConfigured && db) {
      try {
        logSave('hotelStays', stayId, tenantId, updatedStay);
        await setDoc(doc(db, 'hotelStays', stayId), updatedStay, { merge: true });
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    // 2. Only upon success, update state & localStorage
    const updated = stays.map(s => s.id === stayId ? updatedStay : s);
    setStays(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.stays, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    return updatedStay;
  };

  const addRecord = async (recordData: Omit<HotelRecord, 'id' | 'tenant_id' | 'createdAt'>) => {
    const tenantId = ensureAuthenticated();
    const newId = doc(collection(db, 'hotelRecords')).id || `rec_${Date.now()}`;

    const newRecord: HotelRecord = {
      ...recordData,
      id: newId,
      tenant_id: tenantId,
      createdAt: new Date().toISOString(),
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "hotelRecords",
      documentId: newId,
      userUid: tenantId,
      payload: newRecord
    });

    // 1. Save in Firebase first
    if (isFirebaseConfigured && db) {
      try {
        logSave('hotelRecords', newId, tenantId, newRecord);
        await setDoc(doc(db, 'hotelRecords', newId), newRecord);

        // SYNC HOTEL RECORD TO TUTOR ACCESS LINK SUMMARY
        if (newRecord.visibleToTutor) {
          try {
            const { updateTutorAccessLinkSummary } = await import('../utils/tutorSummary');
            await updateTutorAccessLinkSummary(newRecord.petId, {
              timelineEvent: {
                id: newId,
                horario: newRecord.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                tipo: newRecord.type === 'feeding' ? 'alimentacao' :
                      newRecord.type === 'medication' ? 'medicacao' :
                      newRecord.type === 'photo' ? 'fotos' : 'atividades',
                texto: newRecord.notes || '',
                imagemUrl: newRecord.photoUrl || undefined,
                responsavel: newRecord.responsible,
                visivelTutor: true
              },
              ...(newRecord.type === 'photo' && newRecord.photoUrl ? {
                momentItem: {
                  id: newId,
                  url: newRecord.photoUrl,
                  categoria: 'hospedagem',
                  legenda: newRecord.notes || '',
                  visivelTutor: true,
                  criadoEm: newRecord.createdAt
                }
              } : {})
            });
          } catch (syncErr) {
            console.warn("Could not sync hotel record to tutorAccessLinks:", syncErr);
          }
        }
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    // 2. Only upon success, update state & localStorage
    const updated = [newRecord, ...records];
    setRecords(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.records, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    return newRecord;
  };

  const deleteRecord = async (recordId: string) => {
    const tenantId = ensureAuthenticated();

    console.log("TENTANDO SALVAR (DELETAR)", {
      collectionName: "hotelRecords",
      documentId: recordId,
      userUid: tenantId,
      payload: null
    });

    // 1. Save in Firebase first
    if (isFirebaseConfigured && db) {
      try {
        console.log(`Deletando registro ${recordId} pelo tenant ${tenantId}`);
        await deleteDoc(doc(db, 'hotelRecords', recordId));
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    // 2. Only upon success, update state & localStorage
    const updated = records.filter(r => r.id !== recordId);
    setRecords(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.records, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const addReport = async (reportData: Omit<HotelReport, 'id' | 'tenant_id' | 'createdAt'>) => {
    const tenantId = ensureAuthenticated();
    const newId = doc(collection(db, 'hotelReports')).id || `rep_${Date.now()}`;

    const newReport: HotelReport = {
      ...reportData,
      id: newId,
      tenant_id: tenantId,
      createdAt: new Date().toISOString(),
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "hotelReports",
      documentId: newId,
      userUid: tenantId,
      payload: newReport
    });

    // 1. Save in Firebase first
    if (isFirebaseConfigured && db) {
      try {
        logSave('hotelReports', newId, tenantId, newReport);
        await setDoc(doc(db, 'hotelReports', newId), newReport);

        // SYNC HOTEL REPORT TO TUTOR ACCESS LINK SUMMARY
        try {
          const { updateTutorAccessLinkSummary } = await import('../utils/tutorSummary');
          await updateTutorAccessLinkSummary(newReport.petId, {
            bulletinItem: {
              id: newId,
              tipo: 'hotel',
              titulo: `Boletim de Hospedagem - ${newReport.petName}`,
              periodoInicio: newReport.createdAt,
              periodoFim: newReport.createdAt,
              resumo: newReport.reportText,
              status: 'arquivado',
              criadoEm: newReport.createdAt
            }
          });
        } catch (syncErr) {
          console.warn("Could not sync hotel bulletin to tutorAccessLinks:", syncErr);
        }
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    // 2. Only upon success, update state & localStorage
    const updated = [newReport, ...reports.filter(r => r.id !== newId)];
    setReports(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.reports, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    return newReport;
  };

  return {
    stays,
    records,
    reports,
    loading,
    addStay,
    updateStay,
    addRecord,
    deleteRecord,
    addReport,
    uploadPhoto,
  };
}
