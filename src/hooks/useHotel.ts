import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage, isFirebaseConfigured } from '../firebase';
import { HotelStay, HotelRecord, HotelReport } from '../../types';

const LOCAL_STORAGE_KEYS = {
  stays: 'kahu_hotel_stays_v2',
  records: 'kahu_hotel_records_v2',
  reports: 'kahu_hotel_reports_v2',
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
    if (!isFirebaseConfigured || !storage || !user) {
      // Fallback: Convert to base64 string
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const fileRef = ref(storage, `${folderName}/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error("Erro no upload do arquivo:", err);
      // Fallback to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  const addStay = async (stayData: Omit<HotelStay, 'id' | 'tenant_id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const user = auth.currentUser;
    const newId = doc(collection(db, 'hotelStays')).id || `stay_${Date.now()}`;
    const tenantId = user ? user.uid : 'local-user';

    const newStay: HotelStay = {
      ...stayData,
      id: newId,
      tenant_id: tenantId,
      status: 'ativa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update state & localStorage immediately
    const updated = [newStay, ...stays.filter(s => s.id !== newId)];
    setStays(updated);
    localStorage.setItem(LOCAL_STORAGE_KEYS.stays, JSON.stringify(updated));

    // Save in Firebase if configured
    if (isFirebaseConfigured && db && user) {
      await setDoc(doc(db, 'hotelStays', newId), newStay);
    }

    return newStay;
  };

  const updateStay = async (stayId: string, fields: Partial<HotelStay>) => {
    const user = auth.currentUser;
    const current = stays.find(s => s.id === stayId);
    if (!current) return;

    const updatedStay: HotelStay = {
      ...current,
      ...fields,
      updatedAt: new Date().toISOString(),
    };

    // Update state & localStorage
    const updated = stays.map(s => s.id === stayId ? updatedStay : s);
    setStays(updated);
    localStorage.setItem(LOCAL_STORAGE_KEYS.stays, JSON.stringify(updated));

    // Save in Firebase
    if (isFirebaseConfigured && db && user) {
      await setDoc(doc(db, 'hotelStays', stayId), updatedStay, { merge: true });
    }

    return updatedStay;
  };

  const addRecord = async (recordData: Omit<HotelRecord, 'id' | 'tenant_id' | 'createdAt'>) => {
    const user = auth.currentUser;
    const newId = doc(collection(db, 'hotelRecords')).id || `rec_${Date.now()}`;
    const tenantId = user ? user.uid : 'local-user';

    const newRecord: HotelRecord = {
      ...recordData,
      id: newId,
      tenant_id: tenantId,
      createdAt: new Date().toISOString(),
    };

    // Update state & localStorage
    const updated = [newRecord, ...records];
    setRecords(updated);
    localStorage.setItem(LOCAL_STORAGE_KEYS.records, JSON.stringify(updated));

    // Save in Firebase
    if (isFirebaseConfigured && db && user) {
      await setDoc(doc(db, 'hotelRecords', newId), newRecord);
    }

    return newRecord;
  };

  const deleteRecord = async (recordId: string) => {
    const user = auth.currentUser;

    // Update state & localStorage
    const updated = records.filter(r => r.id !== recordId);
    setRecords(updated);
    localStorage.setItem(LOCAL_STORAGE_KEYS.records, JSON.stringify(updated));

    // Save in Firebase
    if (isFirebaseConfigured && db && user) {
      await deleteDoc(doc(db, 'hotelRecords', recordId));
    }
  };

  const addReport = async (reportData: Omit<HotelReport, 'id' | 'tenant_id' | 'createdAt'>) => {
    const user = auth.currentUser;
    const newId = doc(collection(db, 'hotelReports')).id || `rep_${Date.now()}`;
    const tenantId = user ? user.uid : 'local-user';

    const newReport: HotelReport = {
      ...reportData,
      id: newId,
      tenant_id: tenantId,
      createdAt: new Date().toISOString(),
    };

    // Update state & localStorage
    const updated = [newReport, ...reports.filter(r => r.id !== newId)];
    setReports(updated);
    localStorage.setItem(LOCAL_STORAGE_KEYS.reports, JSON.stringify(updated));

    // Save in Firebase
    if (isFirebaseConfigured && db && user) {
      await setDoc(doc(db, 'hotelReports', newId), newReport);
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
