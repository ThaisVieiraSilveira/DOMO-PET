import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { Pet } from '../../types';
import { fetchPets } from '../../services/api';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';
import { resolveTenantIdForUser } from '../utils/tenantResolver';

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
        const tenantId = await resolveTenantIdForUser(user.uid);
        const petsRef = collection(db, 'pets');
        const q = query(petsRef, where('tenant_id', '==', tenantId));

        unsubscribeSnapshot = onSnapshot(
          q,
          async (snapshot) => {
            if (!active) return;
            let fetchedPets: Pet[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              fetchedPets.push({
                ...data,
                id: docSnap.id,
              } as Pet);
            });

            // If empty with tenant_id, check camelCase tenantId as fallback
            if (fetchedPets.length === 0) {
              try {
                const qAlt = query(petsRef, where('tenantId', '==', tenantId));
                const altSnap = await getDocs(qAlt);
                altSnap.forEach((docSnap) => {
                  const data = docSnap.data();
                  fetchedPets.push({
                    ...data,
                    id: docSnap.id,
                  } as Pet);
                });
              } catch (altErr) {
                console.warn("Fallback query tenantId:", altErr);
              }
            }

            logLoad('pets', tenantId, fetchedPets.length);

            if (fetchedPets.length > 0) {
              setPets(fetchedPets);
              setLoading(false);
              try {
                localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(fetchedPets));
              } catch (err) {
                console.error("Erro ao salvar cache de pets no localStorage:", err);
              }
            } else {
              // Check if we can migrate existing local storage pets
              try {
                const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.pets);
                const localPets: Pet[] = cached ? JSON.parse(cached) : [];
                
                if (localPets.length > 0) {
                  console.log(`Migrando ${localPets.length} pets locais para a nuvem (tenant ${tenantId})...`);
                  for (const localPet of localPets) {
                    const petDocRef = doc(db, 'pets', localPet.id);
                    const migrationData = {
                      ...localPet,
                      tenant_id: tenantId,
                      tenantId: tenantId,
                      criado_em: new Date().toISOString()
                    };
                    logSave('pets', localPet.id, tenantId, migrationData);
                    try {
                      await setDoc(petDocRef, migrationData);
                    } catch (error: any) {
                      console.error("ERRO MIGRACAO FIRESTORE PETS", error);
                    }
                  }
                } else {
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
    const userUid = ensureAuthenticated();
    const tenantId = await resolveTenantIdForUser(userUid);
    const newId = petData.id || doc(collection(db, 'pets')).id || Math.random().toString(36).substr(2, 9);
    
    const newPet: Pet = {
      ...petData,
      id: newId,
    } as Pet;

    const documentData = {
      ...newPet,
      tenant_id: tenantId,
      tenantId: tenantId,
      criado_em: new Date().toISOString(),
    };

    console.log("TENTANDO SALVAR PET", {
      collectionName: "pets",
      documentId: newId,
      tenantId,
      payload: documentData
    });

    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', newId);
        logSave('pets', newId, tenantId, documentData);
        await setDoc(petDocRef, documentData);
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    const updatedPets = [...pets.filter((p) => p.id !== newId), newPet];
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
    } catch (e) {
      console.error(e);
    }

    return newPet;
  };

  const updatePet = async (petId: string, updatedFields: Partial<Pet>) => {
    const userUid = ensureAuthenticated();
    const tenantId = await resolveTenantIdForUser(userUid);
    
    const currentPet = pets.find((p) => p.id === petId);
    if (!currentPet) return;

    const updatedPet: Pet = {
      ...currentPet,
      ...updatedFields,
      id: petId,
    };

    const dataToSave = {
      ...updatedPet,
      tenant_id: tenantId,
      tenantId: tenantId,
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', petId);
        logSave('pets', petId, tenantId, dataToSave);
        await setDoc(petDocRef, dataToSave, { merge: true });
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE UPDATE PET", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    const updatedPets = pets.map((p) => (p.id === petId ? updatedPet : p));
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
    } catch (e) {
      console.error(e);
    }

    return updatedPet;
  };

  const deletePet = async (petId: string) => {
    const userUid = ensureAuthenticated();
    const tenantId = await resolveTenantIdForUser(userUid);

    if (isFirebaseConfigured && db) {
      try {
        const petDocRef = doc(db, 'pets', petId);
        console.log(`Deletando pet ${petId} do Firestore pelo tenant ${tenantId}`);
        await deleteDoc(petDocRef);
      } catch (error: any) {
        console.error("ERRO FIRESTORE DELETE PET", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        throw error;
      }
    }

    const updatedPets = pets.filter((p) => p.id !== petId);
    setPets(updatedPets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.pets, JSON.stringify(updatedPets));
    } catch (e) {
      console.error(e);
    }
  };

  const loadPetsFromFirestore = async () => {
    const userUid = ensureAuthenticated();
    const tenantId = await resolveTenantIdForUser(userUid);
    if (!isFirebaseConfigured || !db) {
      console.warn("Firebase não configurado ao tentar recarregar pets.");
      return pets;
    }
    try {
      console.log("Buscando pets no Firestore para tenantId:", tenantId);
      const petsRef = collection(db, 'pets');
      const q = query(petsRef, where('tenant_id', '==', tenantId));
      const querySnapshot = await getDocs(q);
      let fetchedPets: Pet[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedPets.push({
          ...data,
          id: docSnap.id,
        } as Pet);
      });

      if (fetchedPets.length === 0) {
        const qAlt = query(petsRef, where('tenantId', '==', tenantId));
        const altSnap = await getDocs(qAlt);
        altSnap.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedPets.push({
            ...data,
            id: docSnap.id,
          } as Pet);
        });
      }

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

