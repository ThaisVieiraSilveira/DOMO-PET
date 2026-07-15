import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { fetchPets } from './services/api';
import { isPetOnDay } from './utils/date';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PetChecklist from './components/PetChecklist';
import Reports from './components/Reports';
import CadastroLooker from './components/CadastroLooker';
import ChecklistLooker from './components/ChecklistLooker';
import Groups from './components/Groups';
import Cadastro from './components/Cadastro';
import UnicoLooker from './components/UnicoLooker';
import UnicoEdit from './components/UnicoEdit';
import Medication from './components/Medication';
import Hotel from './components/Hotel';
import Settings from './components/Settings';
import Login from './components/Login';
import Ajustes from './src/pages/Ajustes';
import CadastroPublico from './src/pages/CadastroPublico';
import PerfilPetPublico from './src/pages/PerfilPetPublico';
import { usePets } from './src/hooks/usePets';
import { Pet, ChecklistEntry, PetGroup, Medication as MedicationType, MedicationLog, HotelStay } from './types';
import { auth } from './src/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  const { pets, addPet, updatePet, deletePet: deletePetFromFirestore, loading: petsLoading, loadPetsFromFirestore } = usePets();
  const [checklists, setChecklists] = useState<ChecklistEntry[]>([]);
  const [groups, setGroups] = useState<PetGroup[]>([]);
  const [medications, setMedications] = useState<MedicationType[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [hotelStays, setHotelStays] = useState<HotelStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [zApiInstanceId, setZApiInstanceId] = useState<string>(localStorage.getItem('domo_zapi_instance') || '');
  const [zApiToken, setZApiToken] = useState<string>(localStorage.getItem('domo_zapi_token') || '');
  const [zApiClientToken, setZApiClientToken] = useState<string>(localStorage.getItem('domo_zapi_client_token') || '');

  // Firebase Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auto-redirect pathname public routes to hash router version to prevent 404 or redirecting to Login
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/perfil-pet/') || path.includes('/cadastro-publico')) {
      let publicSegment = '';
      if (path.includes('/perfil-pet/')) {
        publicSegment = '/perfil-pet/' + path.split('/perfil-pet/')[1];
      } else if (path.includes('/cadastro-publico')) {
        publicSegment = '/cadastro-publico';
      }
      if (publicSegment) {
        window.location.href = window.location.origin + window.location.search + '#' + publicSegment;
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // Migrate old kahu_ localStorage keys to domo_ safely so existing users do not lose their data
        const oldKeys = [
          'kahu_master_pets',
          'kahu_checklists',
          'kahu_groups',
          'kahu_medications',
          'kahu_medication_logs',
          'kahu_hotel_stays',
          'kahu_deleted_pets',
          'kahu_tutor_links',
          'kahu_activities',
          'kahu_zapi_instance',
          'kahu_zapi_token',
          'kahu_zapi_client_token'
        ];
        oldKeys.forEach(key => {
          const val = localStorage.getItem(key);
          if (val !== null) {
            const newKey = key.replace('kahu_', 'domo_');
            if (localStorage.getItem(newKey) === null) {
              localStorage.setItem(newKey, val);
            }
          }
        });

        const storedCheck = localStorage.getItem('domo_checklists');
        let localEntries: ChecklistEntry[] = storedCheck ? JSON.parse(storedCheck) : [];
        setChecklists(localEntries);

        const storedGroups = localStorage.getItem('domo_groups');
        if (storedGroups) {
          setGroups(JSON.parse(storedGroups));
        } else {
          // Inicializar grupos automáticos por dia se não houver nenhum
          const initialGroups: PetGroup[] = [
            { id: 'g_seg', name: 'Matilha de Segunda', petIds: [], color: 'bg-emerald-500' },
            { id: 'g_ter', name: 'Matilha de Terça', petIds: [], color: 'bg-sky-500' },
            { id: 'g_qua', name: 'Matilha de Quarta', petIds: [], color: 'bg-amber-500' },
            { id: 'g_qui', name: 'Matilha de Quinta', petIds: [], color: 'bg-rose-500' },
            { id: 'g_sex', name: 'Matilha de Sexta', petIds: [], color: 'bg-purple-500' },
            { id: 'g_sab', name: 'Matilha de Sábado', petIds: [], color: 'bg-pink-500' },
            { id: 'g_dom', name: 'Matilha de Domingo', petIds: [], color: 'bg-indigo-500' },
          ];
          setGroups(initialGroups);
          localStorage.setItem('domo_groups', JSON.stringify(initialGroups));
        }

        const storedMeds = localStorage.getItem('domo_medications');
        if (storedMeds) setMedications(JSON.parse(storedMeds));

        const storedMedLogs = localStorage.getItem('domo_medication_logs');
        if (storedMedLogs) setMedicationLogs(JSON.parse(storedMedLogs));

        const storedHotel = localStorage.getItem('domo_hotel_stays');
        if (storedHotel) setHotelStays(JSON.parse(storedHotel));

      } catch (e) {
        console.error("Erro ao carregar DOMO:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const saveChecklist = (entry: ChecklistEntry) => {
    const entryWithTimestamp = { ...entry, updatedAt: new Date().toISOString() };
    setChecklists(prev => {
      const filtered = prev.filter(c => !(c.petId === entry.petId && c.date === entry.date));
      const updated = [...filtered, entryWithTimestamp];
      try {
        localStorage.setItem('domo_checklists', JSON.stringify(updated));
      } catch (e) {
        console.error("Erro ao salvar no localStorage:", e);
        alert("Espaço de armazenamento cheio! Por favor, exporte seus dados e limpe o sistema.");
      }
      return updated;
    });
  };

  const updatePetMaster = async (updatedPet: Pet) => {
    const exists = pets.some(p => p.id === updatedPet.id);
    if (exists) {
      await updatePet(updatedPet.id, updatedPet);
    } else {
      await addPet(updatedPet);
    }

    // Auto-sync with day groups (g_seg, g_ter, etc)
    setGroups(prev => {
      const dayMap: Record<string, string> = {
        'g_seg': 'Segunda',
        'g_ter': 'Terça',
        'g_qua': 'Quarta',
        'g_qui': 'Quinta',
        'g_sex': 'Sexta',
        'g_sab': 'Sábado',
        'g_dom': 'Domingo'
      };

      const updatedGroups = prev.map(group => {
        const targetDay = dayMap[group.id];
        if (targetDay) {
          const isOnDay = isPetOnDay(updatedPet, targetDay);
          const currentIds = group.petIds || [];
          const hasPet = currentIds.includes(updatedPet.id);

          if (isOnDay && !hasPet) {
            return { ...group, petIds: [...currentIds, updatedPet.id] };
          } else if (!isOnDay && hasPet) {
            return { ...group, petIds: currentIds.filter(id => id !== updatedPet.id) };
          }
        }
        return group;
      });

      localStorage.setItem('domo_groups', JSON.stringify(updatedGroups));
      return updatedGroups;
    });
  };

  const saveGroups = (newGroups: PetGroup[]) => {
    setGroups(newGroups);
    localStorage.setItem('domo_groups', JSON.stringify(newGroups));
  };

  const saveMedication = (med: MedicationType) => {
    setMedications(prev => {
      const filtered = prev.filter(m => m.id !== med.id);
      const updated = [...filtered, med];
      localStorage.setItem('domo_medications', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteMedication = (id: string) => {
    setMedications(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem('domo_medications', JSON.stringify(updated));
      return updated;
    });
    // Also cleanup logs
    setMedicationLogs(prev => {
      const updated = prev.filter(l => l.medicationId !== id);
      localStorage.setItem('domo_medication_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const saveMedicationLog = (log: MedicationLog) => {
    setMedicationLogs(prev => {
      const filtered = prev.filter(l => 
        !(l.medicationId === log.medicationId && l.date === log.date && (l.slot === log.slot || (!l.slot && !log.slot)))
      );
      const updated = [...filtered, log];
      localStorage.setItem('domo_medication_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const saveHotelStay = (stay: HotelStay) => {
    setHotelStays(prev => {
      const filtered = prev.filter(s => s.id !== stay.id);
      const updated = [...filtered, stay];
      localStorage.setItem('domo_hotel_stays', JSON.stringify(updated));
      return updated;
    });
  };

  const saveZApiConfig = (instanceId: string, token: string, clientToken: string) => {
    setZApiInstanceId(instanceId);
    setZApiToken(token);
    setZApiClientToken(clientToken);
    localStorage.setItem('domo_zapi_instance', instanceId);
    localStorage.setItem('domo_zapi_token', token);
    localStorage.setItem('domo_zapi_client_token', clientToken);
  };

  const saveToLocal = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Erro ao salvar ${key}:`, e);
    }
  };

  const deleteHotelStay = (id: string) => {
    setHotelStays(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('domo_hotel_stays', JSON.stringify(updated));
      return updated;
    });
  };

  const deletePet = async (petId: string) => {
    // Adiciona ao registro de deletados para persistência
    const storedDeleted = localStorage.getItem('domo_deleted_pets');
    const deletedIds: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];
    if (!deletedIds.includes(petId)) {
      const newDeleted = [...deletedIds, petId];
      localStorage.setItem('domo_deleted_pets', JSON.stringify(newDeleted));
    }

    await deletePetFromFirestore(petId);
    
    // Também remove o pet de todos os grupos
    setGroups(prev => {
      const newGroups = prev.map(g => ({
        ...g,
        petIds: g.petIds.filter(id => id !== petId)
      }));
      localStorage.setItem('domo_groups', JSON.stringify(newGroups));
      return newGroups;
    });
  };

  const isPublicRoute = 
    window.location.hash.includes('/perfil-pet/') || 
    window.location.hash.includes('/cadastro-publico') ||
    window.location.pathname.includes('/perfil-pet/') ||
    window.location.pathname.includes('/cadastro-publico');

  // Loading Screen with beautiful 🐾 animation
  if (!isPublicRoute && (authLoading || loading || petsLoading)) {
    const currentNome = localStorage.getItem('domo_nome') || 'DOMO';
    const currentCor = localStorage.getItem('domo_cor') || '#085041';
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center">
        <div className="text-7xl animate-bounce mb-6 select-none font-sans">🐾</div>
        <h1 className="text-3xl font-black tracking-tighter" style={{ color: currentCor }}>
          {currentNome}
        </h1>
        <p className="font-bold animate-pulse mt-2 uppercase text-[10px] tracking-widest text-[#085041]">
          Carregando a matilha...
        </p>
      </div>
    );
  }

  // If not authenticated, render Login component (while keeping support for public routes)
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/cadastro-publico" element={<CadastroPublico />} />
          <Route path="/perfil-pet/:token" element={<PerfilPetPublico />} />
          <Route path="*" element={<Login onLogin={() => {}} />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/cadastro-publico" element={<CadastroPublico />} />
        <Route path="/perfil-pet/:token" element={<PerfilPetPublico />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              {/* Core Navigation Routes */}
              <Route path="/" element={
                <Dashboard 
                  pets={pets} 
                  checklists={checklists} 
                  groups={groups} 
                  medications={medications}
                  medicationLogs={medicationLogs}
                  hotelStays={hotelStays}
                  onSaveMedicationLog={saveMedicationLog}
                  onUpdatePet={updatePetMaster}
                  onSaveChecklist={saveChecklist}
                  zApiConfig={{
                    instanceId: zApiInstanceId,
                    token: zApiToken,
                    clientToken: zApiClientToken
                  }}
                />
              } />
              
              <Route path="/cadastro" element={<CadastroLooker pets={pets} onDeletePet={deletePet} onSavePet={updatePetMaster} loadPetsFromFirestore={loadPetsFromFirestore} />} />
              <Route path="/unico" element={<UnicoLooker pets={pets} />} />
              <Route path="/unico/:petId" element={<UnicoEdit pets={pets} onSave={updatePetMaster} />} />
              <Route path="/checklist_looker" element={<ChecklistLooker pets={pets} checklists={checklists} />} />
              <Route path="/cadastro/:petId" element={<Cadastro pets={pets} onSave={updatePetMaster} />} />
              <Route path="/grupos" element={<Groups pets={pets} groups={groups} onSaveGroups={saveGroups} />} />
              <Route path="/medicacao" element={<Medication pets={pets} medications={medications} medicationLogs={medicationLogs} onSaveMedication={saveMedication} onDeleteMedication={deleteMedication} onSaveLog={saveMedicationLog} />} />
              <Route path="/hotel" element={<Hotel pets={pets} hotelStays={hotelStays} medications={medications} medicationLogs={medicationLogs} onSaveStay={saveHotelStay} onDeleteStay={deleteHotelStay} onSaveMedLog={saveMedicationLog} onSaveMedication={saveMedication} />} />
              
              <Route path="/pet/:petId" element={
                <PetChecklist 
                  pets={pets} 
                  checklists={checklists} 
                  onSave={saveChecklist} 
                  onUpdatePet={updatePetMaster} 
                  zApiConfig={{
                    instanceId: zApiInstanceId,
                    token: zApiToken,
                    clientToken: zApiClientToken
                  }}
                />
              } />
              
              {/* Reports mapping both paths */}
              <Route path="/relatorios" element={<Reports pets={pets} checklists={checklists} />} />
              <Route path="/mensagens" element={<Reports pets={pets} checklists={checklists} />} />
              
              <Route path="/settings" element={
                <Settings 
                  pets={pets} 
                  checklists={checklists} 
                  medications={medications} 
                  medicationLogs={medicationLogs} 
                  hotelStays={hotelStays} 
                  zApiConfig={{
                    instanceId: zApiInstanceId,
                    token: zApiToken,
                    clientToken: zApiClientToken
                  }}
                  onSaveZApi={saveZApiConfig}
                />
              } />
              
              <Route path="/ajustes" element={<Ajustes />} />
              
              {/* Fallback to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
};

export default App;
