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
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState<string>(localStorage.getItem('kahu_sheets_url') || '');
  const [zApiInstanceId, setZApiInstanceId] = useState<string>(localStorage.getItem('kahu_zapi_instance') || '');
  const [zApiToken, setZApiToken] = useState<string>(localStorage.getItem('kahu_zapi_token') || '');
  const [zApiClientToken, setZApiClientToken] = useState<string>(localStorage.getItem('kahu_zapi_client_token') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>(localStorage.getItem('kahu_last_sync') || '');

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

  const syncToSheets = async (type: string, data: any) => {
    if (!sheetsWebhookUrl) return;
    setIsSyncing(true);
    try {
      // Enriquecer os dados com o nome do pet para facilitar a leitura no Sheets
      const enrichedData = { ...data };
      if (data.petId) {
        const pet = pets.find(p => p.id === data.petId);
        if (pet) {
          enrichedData.pet_nome = pet.pet_nome;
        }
      }

      await fetch(sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: enrichedData, timestamp: new Date().toISOString() })
      });
    } catch (e) {
      console.error("Erro ao sincronizar com Sheets:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const storedCheck = localStorage.getItem('kahu_checklists');
        let localEntries: ChecklistEntry[] = storedCheck ? JSON.parse(storedCheck) : [];
        setChecklists(localEntries);

        const storedGroups = localStorage.getItem('kahu_groups');
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
          localStorage.setItem('kahu_groups', JSON.stringify(initialGroups));
        }

        const storedMeds = localStorage.getItem('kahu_medications');
        if (storedMeds) setMedications(JSON.parse(storedMeds));

        const storedMedLogs = localStorage.getItem('kahu_medication_logs');
        if (storedMedLogs) setMedicationLogs(JSON.parse(storedMedLogs));

        const storedHotel = localStorage.getItem('kahu_hotel_stays');
        if (storedHotel) setHotelStays(JSON.parse(storedHotel));

        // Auto-pull se tiver URL
        if (sheetsWebhookUrl) {
          try {
            console.log("Tentando recuperar dados da nuvem...");
            const response = await fetch(sheetsWebhookUrl);
            if (response.ok) {
              const cloudData = await response.json();
              if (cloudData) {
                if (cloudData.pets && cloudData.pets.length > 0) {
                  localStorage.setItem('kahu_master_pets', JSON.stringify(cloudData.pets));
                }
                if (cloudData.checklists) {
                  setChecklists(cloudData.checklists);
                  localStorage.setItem('kahu_checklists', JSON.stringify(cloudData.checklists));
                }
                if (cloudData.groups) {
                  setGroups(cloudData.groups);
                  localStorage.setItem('kahu_groups', JSON.stringify(cloudData.groups));
                }
                if (cloudData.medications) {
                  setMedications(cloudData.medications);
                  localStorage.setItem('kahu_medications', JSON.stringify(cloudData.medications));
                }
                if (cloudData.medicationLogs) {
                  setMedicationLogs(cloudData.medicationLogs);
                  localStorage.setItem('kahu_medication_logs', JSON.stringify(cloudData.medicationLogs));
                }
                if (cloudData.hotelStays) {
                  setHotelStays(cloudData.hotelStays);
                  localStorage.setItem('kahu_hotel_stays', JSON.stringify(cloudData.hotelStays));
                }
                
                const now = new Date().toLocaleString('pt-BR');
                localStorage.setItem('kahu_last_sync', now);
                setLastSync(now);
                console.log("Dados recuperados com sucesso!");
              }
            }
          } catch (autoErr) {
            console.warn("Auto-pull inicial falhou. Verifique se o Web App permitiu acesso 'Qualquer Pessoa'.");
          }
        }
      } catch (e) {
        console.error("Erro ao carregar DOMO:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Debounced push to master sync
  const debouncedPush = React.useRef<NodeJS.Timeout | null>(null);
  const triggerMasterSync = () => {
    if (debouncedPush.current) clearTimeout(debouncedPush.current);
    debouncedPush.current = setTimeout(() => {
      pushMasterSync().catch(console.error);
    }, 5000); // 5 segundos de delay para acumular mudanças
  };

  const saveChecklist = (entry: ChecklistEntry) => {
    const entryWithTimestamp = { ...entry, updatedAt: new Date().toISOString() };
    setChecklists(prev => {
      const filtered = prev.filter(c => !(c.petId === entry.petId && c.date === entry.date));
      const updated = [...filtered, entryWithTimestamp];
      try {
        localStorage.setItem('kahu_checklists', JSON.stringify(updated));
      } catch (e) {
        console.error("Erro ao salvar no localStorage:", e);
        alert("Espaço de armazenamento cheio! Por favor, exporte seus dados e limpe o sistema.");
      }
      return updated;
    });
    syncToSheets('checklist', entryWithTimestamp);
    triggerMasterSync();
  };

  const updatePetMaster = async (updatedPet: Pet) => {
    const exists = pets.some(p => p.id === updatedPet.id);
    if (exists) {
      await updatePet(updatedPet.id, updatedPet);
    } else {
      await addPet(updatedPet);
    }

    // Auto-sync individual pet record
    syncToSheets('pet', updatedPet);
    
    // Auto-sync full state after structural change
    triggerMasterSync();
    
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

      localStorage.setItem('kahu_groups', JSON.stringify(updatedGroups));
      return updatedGroups;
    });
  };

  const saveGroups = (newGroups: PetGroup[]) => {
    setGroups(newGroups);
    localStorage.setItem('kahu_groups', JSON.stringify(newGroups));
    triggerMasterSync();
  };

  const saveMedication = (med: MedicationType) => {
    setMedications(prev => {
      const filtered = prev.filter(m => m.id !== med.id);
      const updated = [...filtered, med];
      localStorage.setItem('kahu_medications', JSON.stringify(updated));
      return updated;
    });
    triggerMasterSync();
  };

  const deleteMedication = (id: string) => {
    setMedications(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem('kahu_medications', JSON.stringify(updated));
      return updated;
    });
    // Also cleanup logs
    setMedicationLogs(prev => {
      const updated = prev.filter(l => l.medicationId !== id);
      localStorage.setItem('kahu_medication_logs', JSON.stringify(updated));
      return updated;
    });
    triggerMasterSync();
  };

  const saveMedicationLog = (log: MedicationLog) => {
    setMedicationLogs(prev => {
      const filtered = prev.filter(l => 
        !(l.medicationId === log.medicationId && l.date === log.date && (l.slot === log.slot || (!l.slot && !log.slot)))
      );
      const updated = [...filtered, log];
      localStorage.setItem('kahu_medication_logs', JSON.stringify(updated));
      return updated;
    });
    syncToSheets('medication_log', log);
    triggerMasterSync();
  };

  const saveHotelStay = (stay: HotelStay) => {
    setHotelStays(prev => {
      const filtered = prev.filter(s => s.id !== stay.id);
      const updated = [...filtered, stay];
      localStorage.setItem('kahu_hotel_stays', JSON.stringify(updated));
      return updated;
    });
    syncToSheets('hotel_stay', stay);
    triggerMasterSync();
  };

  const saveSheetsUrl = (url: string) => {
    setSheetsWebhookUrl(url);
    localStorage.setItem('kahu_sheets_url', url);
  };

  const saveZApiConfig = (instanceId: string, token: string, clientToken: string) => {
    setZApiInstanceId(instanceId);
    setZApiToken(token);
    setZApiClientToken(clientToken);
    localStorage.setItem('kahu_zapi_instance', instanceId);
    localStorage.setItem('kahu_zapi_token', token);
    localStorage.setItem('kahu_zapi_client_token', clientToken);
  };

  const saveToLocal = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Erro ao salvar ${key}:`, e);
    }
  };

  const pushMasterSync = async () => {
    if (!sheetsWebhookUrl) throw new Error("URL da planilha não configurada");
    
    // Get fresh data from localStorage or state if possible
    const masterData = {
      pets: JSON.parse(localStorage.getItem('kahu_master_pets') || '[]'),
      checklists: JSON.parse(localStorage.getItem('kahu_checklists') || '[]'),
      groups: JSON.parse(localStorage.getItem('kahu_groups') || '[]'),
      medications: JSON.parse(localStorage.getItem('kahu_medications') || '[]'),
      medicationLogs: JSON.parse(localStorage.getItem('kahu_medication_logs') || '[]'),
      hotelStays: JSON.parse(localStorage.getItem('kahu_hotel_stays') || '[]'),
      deletedPets: JSON.parse(localStorage.getItem('kahu_deleted_pets') || '[]')
    };

    try {
      await fetch(sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MASTER_SYNC', data: masterData })
      });
      const now = new Date().toLocaleString('pt-BR');
      setLastSync(now);
      localStorage.setItem('kahu_last_sync', now);
      return true;
    } catch (e) {
      console.error("Erro no Push Master Sync:", e);
      throw e;
    }
  };

  const pullMasterSync = async () => {
    if (!sheetsWebhookUrl) throw new Error("URL da planilha não configurada");
    
    try {
      const response = await fetch(sheetsWebhookUrl);
      const cloudData = await response.json();
      
      if (cloudData) {
        if (cloudData.pets) {
          saveToLocal('kahu_master_pets', cloudData.pets);
        }
        if (cloudData.checklists) {
          setChecklists(cloudData.checklists);
          saveToLocal('kahu_checklists', cloudData.checklists);
        }
        if (cloudData.groups) {
          setGroups(cloudData.groups);
          saveToLocal('kahu_groups', cloudData.groups);
        }
        if (cloudData.medications) {
          setMedications(cloudData.medications);
          saveToLocal('kahu_medications', cloudData.medications);
        }
        if (cloudData.medicationLogs) {
          setMedicationLogs(cloudData.medicationLogs);
          saveToLocal('kahu_medication_logs', cloudData.medicationLogs);
        }
        if (cloudData.hotelStays) {
          setHotelStays(cloudData.hotelStays);
          saveToLocal('kahu_hotel_stays', cloudData.hotelStays);
        }
        if (cloudData.deletedPets) {
          saveToLocal('kahu_deleted_pets', cloudData.deletedPets);
        }
        const now = new Date().toLocaleString('pt-BR');
        setLastSync(now);
        localStorage.setItem('kahu_last_sync', now);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Erro no Pull Master Sync:", e);
      throw e;
    }
  };

  const deleteHotelStay = (id: string) => {
    setHotelStays(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('kahu_hotel_stays', JSON.stringify(updated));
      return updated;
    });
  };

  const deletePet = async (petId: string) => {
    // Adiciona ao registro de deletados para persistência
    const storedDeleted = localStorage.getItem('kahu_deleted_pets');
    const deletedIds: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];
    if (!deletedIds.includes(petId)) {
      const newDeleted = [...deletedIds, petId];
      localStorage.setItem('kahu_deleted_pets', JSON.stringify(newDeleted));
    }

    await deletePetFromFirestore(petId);
    
    // Também remove o pet de todos os grupos
    setGroups(prev => {
      const newGroups = prev.map(g => ({
        ...g,
        petIds: g.petIds.filter(id => id !== petId)
      }));
      localStorage.setItem('kahu_groups', JSON.stringify(newGroups));
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
                  onPullSync={pullMasterSync}
                  onPushSync={pushMasterSync}
                  onSaveChecklist={saveChecklist}
                  lastSync={lastSync}
                  isSyncing={isSyncing}
                  sheetsWebhookUrl={sheetsWebhookUrl}
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
                  sheetsUrl={sheetsWebhookUrl} 
                  onSaveSheetsUrl={saveSheetsUrl}
                  onPushSync={pushMasterSync}
                  onPullSync={pullMasterSync}
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
