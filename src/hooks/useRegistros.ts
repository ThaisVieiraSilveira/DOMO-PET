import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase';

export interface Registro {
  id: string;
  tenant_id: string;
  pet_id: string;
  tipo: string;
  status: string;
  observacao: string;
  responsavel: string;
  criado_em: string;
}

const LOCAL_STORAGE_KEYS = {
  registros: 'domo_registros',
};

export function useRegistros() {
  const [registros, setRegistros] = useState<Registro[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.registros);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user || !isFirebaseConfigured || !db) {
        // Fallback to local storage
        try {
          const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.registros);
          if (cached && active) {
            setRegistros(JSON.parse(cached));
          }
        } catch (e) {
          console.error("Erro ao carregar registros do localStorage fallback:", e);
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const registrosRef = collection(db, 'registros');
        const q = query(registrosRef, where('tenant_id', '==', user.uid));

        unsubscribeSnapshot = onSnapshot(
          q,
          (snapshot) => {
            if (!active) return;
            const fetchedRegistros: Registro[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              fetchedRegistros.push({
                ...data,
                id: docSnap.id,
              } as Registro);
            });

            // Sort by creation date descending
            fetchedRegistros.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

            setRegistros(fetchedRegistros);
            setLoading(false);

            // Sync with local storage offline fallback
            try {
              localStorage.setItem(LOCAL_STORAGE_KEYS.registros, JSON.stringify(fetchedRegistros));
            } catch (err) {
              console.error("Erro ao salvar cache de registros no localStorage:", err);
            }
          },
          (error) => {
            console.error("Erro no listener em tempo real dos registros:", error);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Erro ao obter referência de registros:", err);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const addRegistro = async (registroData: Omit<Registro, 'id' | 'tenant_id' | 'criado_em'>) => {
    const user = auth.currentUser;
    const newId = doc(collection(db, 'registros')).id || Math.random().toString(36).substr(2, 9);
    
    const newRegistro: Registro = {
      ...registroData,
      id: newId,
      tenant_id: user ? user.uid : 'local-user',
      criado_em: new Date().toISOString(),
    };

    // 1. Optimistic local update
    const updatedRegistros = [newRegistro, ...registros];
    setRegistros(updatedRegistros);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.registros, JSON.stringify(updatedRegistros));
    } catch (e) {
      console.error(e);
    }

    // 2. Save in cloud Firestore
    if (isFirebaseConfigured && db && user) {
      try {
        const docRef = doc(db, 'registros', newId);
        await setDoc(docRef, newRegistro);
      } catch (error) {
        console.error("Erro ao salvar registro no Firestore:", error);
        throw error;
      }
    }

    return newRegistro;
  };

  return { registros, loading, addRegistro };
}
