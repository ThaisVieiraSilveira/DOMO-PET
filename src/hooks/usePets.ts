import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { Pet } from '../../types';
import { fetchPets } from '../../services/api';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';

const LOCAL_STORAGE_KEYS = {
  pets: 'domo_master_pets',
};

export function usePets() {
  const [pets, setPets] = useState<Pet[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.pets);
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
        // Fallback to local storage or API default pets
        try {
          const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.pets);
          if (cached && active) {
            setPets(JSON.parse(cached));
          } else if (active) {
            const basePets = await fetchPets();
            setPets(basePets);
            localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(basePets));
          }
        } catch (e) {
          console.error("Erro ao carregar pets do localStorage fallback:", e);
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const petsRef = collection(db, 'pets');
        const q = query(petsRef, where('tenant_id', '==', user.uid));

        unsubscribeSnapshot = onSnapshot(
          q,
          async (snapshot) => {
            if (!active) return;
            const fetchedPets: Pet[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              fetchedPets.push({
                ...data,
                id: docSnap.id, // Ensure document ID is used as the pet ID
              } as Pet);
            });

            logLoad('pets', user.uid, fetchedPets.length);

            if (fetchedPets.length > 0) {
              setPets(fetchedPets);
              setLoading(false);
              try {
                localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(fetchedPets));
              } catch (err) {
                console.error("Erro ao salvar cache de pets no localStorage:", err);
              }
            } else {
              // Firestore of this tenant is empty! Check if we can migrate existing local storage pets
              try {
                const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.pets);
                const localPets: Pet[] = cached ? JSON.parse(cached) : [];
                
                if (localPets.length > 0) {
                  // Automatic migration of local storage pets to the newly authenticated cloud tenant!
                  console.log(`Migrando ${localPets.length} pets locais para a nuvem...`);
                  for (const localPet of localPets) {
                    const petDocRef = doc(db, 'pets', localPet.id);
                    const migrationData = {
                      ...localPet,
                      tenant_id: user.uid,
                      criado_em: new Date().toISOString()
                    };
                    logSave('pets', localPet.id, user.uid, migrationData);
                    await setDoc(petDocRef, migrationData);
                  }
                  // Let onSnapshot pick up the newly uploaded pets automatically
                } else {
                  // Since they are logged in, we do NOT load mock data. The pets list remains empty.
                  setPets([]);
                  setLoading(false);
                  localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify([]));
                }
              } catch (migrationErr) {
                console.error("Erro na migração de pets:", migrationErr);
                setLoading(false);
              }
            }
          },
          (error) => {
            console.error("Erro no listener em tempo real dos pets:", error);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Erro ao obter referência de pets:", err);
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

  const addPet = async (petData: Omit<Pet, 'id'> & { id?: string }) => {
    const tenantId = ensureAuthenticated();
    // We generate a deterministic ID if not provided, or a generic clean ID using Firestore or random ID.
    const newId = petData.id || doc(collection(db, 'pets')).id || Math.random().toString(36).substr(2, 9);
    
    const newPet: Pet = {
      ...petData,
      id: newId,
    } as Pet;

    const documentData = {
      ...newPet,
      tenant_id: tenantId,
      criado_em: new Date().toISOString(),
    };

    // 1. Save in state & localStorage immediately (Optimistic UI / Offline mode)
    const updatedPets = [...pets.filter((p) => p.id !== newId), newPet];
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
    } catch (e) {
      console.error(e);
    }

    // 2. Save to Firestore
    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', newId);
        logSave('pets', newId, tenantId, documentData);
        await setDoc(petDocRef, documentData);
      } catch (error) {
        console.error("Erro ao salvar pet no Firestore:", error);
        throw error;
      }
    }
    return newPet;
  };

  const updatePet = async (petId: string, updatedFields: Partial<Pet>) => {
    const tenantId = ensureAuthenticated();
    
    // Find current pet
    const currentPet = pets.find((p) => p.id === petId);
    if (!currentPet) return;

    const updatedPet: Pet = {
      ...currentPet,
      ...updatedFields,
      id: petId,
    };

    // 1. Save in state & localStorage immediately (Optimistic UI)
    const updatedPets = pets.map((p) => (p.id === petId ? updatedPet : p));
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
    } catch (e) {
      console.error(e);
    }

    // 2. Save in Firestore
    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', petId);
        const dataToSave = {
          ...updatedPet,
          tenant_id: tenantId,
          updatedAt: new Date().toISOString(),
        };
        logSave('pets', petId, tenantId, dataToSave);
        await setDoc(petDocRef, dataToSave, { merge: true });
      } catch (error) {
        console.error("Erro ao atualizar pet no Firestore:", error);
        throw error;
      }
    }
    return updatedPet;
  };

  const deletePet = async (petId: string) => {
    const tenantId = ensureAuthenticated();

    // 1. Remove from local state & localStorage immediately
    const updatedPets = pets.filter((p) => p.id !== petId);
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
      
      // Keep track of deleted items to sync if needed for legacy components
      const storedDeleted = localStorage.getItem('domo_deleted_pets');
      const deletedIds: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];
      if (!deletedIds.includes(petId)) {
        localStorage.setItem('domo_deleted_pets', JSON.stringify([...deletedIds, petId]));
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Remove from Firestore
    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', petId);
        console.log(`Deletando pet ${petId} do Firestore pelo tenant ${tenantId}`);
        await deleteDoc(petDocRef);
      } catch (error) {
        console.error("Erro ao deletar pet do Firestore:", error);
        throw error;
      }
    }
  };

  const loadPetsFromFirestore = async () => {
    const tenantId = ensureAuthenticated();
    if (!isFirebaseConfigured || !db) {
      console.warn("Firebase não configurado ao tentar recarregar pets.");
      return [];
    }
    try {
      console.log("Buscando pets com tenant_id:", tenantId);
      const petsRef = collection(db, 'pets');
      const q = query(petsRef, where('tenant_id', '==', tenantId));
      const querySnapshot = await getDocs(q);
      const fetchedPets: Pet[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedPets.push({
          ...data,
          id: docSnap.id,
        } as Pet);
      });
      logLoad('pets', tenantId, fetchedPets.length);
      setPets(fetchedPets);
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(fetchedPets));
      return fetchedPets;
    } catch (err) {
      console.error("Erro ao recarregar pets do Firestore:", err);
      throw err;
    }
  };

  return { pets, loading, addPet, updatePet, deletePet, loadPetsFromFirestore };
}
