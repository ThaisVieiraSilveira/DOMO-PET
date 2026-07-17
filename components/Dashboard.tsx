import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pet, ChecklistEntry, PetGroup, Medication, MedicationLog, HotelStay } from '../types';
import { useTenant } from '../src/hooks/useTenant';
import { useHotel } from '../src/hooks/useHotel';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, storage, isFirebaseConfigured } from '../src/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStatusColor, getStatusEmoji, calculateStatus } from '../utils/status';
import { isPetOnDay } from '../utils/date';
import { getGeneratedMessage } from '../utils/messages';
import { 
  Bell, Calendar, Sparkles, Plus, CheckCircle2, AlertTriangle, 
  Activity, Clock, Settings, Search, Building2, Download, 
  Upload, PlusCircle, Check, Flame, Cake, RefreshCw, 
  Users, CheckSquare, Info, X, Zap, Heart, ShieldAlert, ChevronRight, Share2, Copy,
  Camera, CalendarX
} from 'lucide-react';

interface DashboardProps {
  pets: Pet[];
  checklists: ChecklistEntry[];
  groups: PetGroup[];
  medications?: Medication[];
  medicationLogs?: MedicationLog[];
  hotelStays?: HotelStay[];
  onSaveMedicationLog?: (log: MedicationLog) => void;
  onUpdatePet: (pet: Pet) => void;
  onSaveChecklist: (entry: ChecklistEntry) => void;
  zApiConfig?: {
    instanceId: string;
    token: string;
    clientToken: string;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ 
  pets, checklists, groups, 
  medications = [], 
  medicationLogs = [], 
  hotelStays = [], 
  onSaveMedicationLog,
  onUpdatePet, 
  onSaveChecklist, zApiConfig 
}) => {
  const navigate = useNavigate();
  const { stays: syncedHotelStays } = useHotel();
  const hotelStaysToUse = syncedHotelStays && syncedHotelStays.length > 0 ? syncedHotelStays : (hotelStays || []);
  
  const { nome: domoNome, cor: domoCor, logo: domoLogo } = useTenant();
  
  const [syncing, setSyncing] = useState<'none' | 'push' | 'pull'>('none');
  const [quickEntries, setQuickEntries] = useState<Record<string, ChecklistEntry['comeu']>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = new Date().getDay();
    const dayMap: Record<number, string> = {
      0: 'Domingo',
      1: 'Segunda',
      2: 'Terça',
      3: 'Quarta',
      4: 'Quinta',
      5: 'Sexta',
      6: 'Sábado'
    };
    return dayMap[today] || 'Segunda';
  });

  const todayLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState(todayLocal());
  const [isAddingToDay, setIsAddingToDay] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Filtering views
  const [showHotelOnly, setShowHotelOnly] = useState(false);
  
  // Modals Core States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showMedicationsModal, setShowMedicationsModal] = useState(false);
  const [medsFilterPetId, setMedsFilterPetId] = useState<string | null>(null);
  const [selectedTutorPet, setSelectedTutorPet] = useState<Pet | null>(null);
  const [copiedTutorLink, setCopiedTutorLink] = useState(false);
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [showHotelStaysModal, setShowHotelStaysModal] = useState(false);
  const [showBatchActivityModal, setShowBatchActivityModal] = useState(false);

  // Custom activities state & loader
  const [activitiesList, setActivitiesList] = useState<{ label: string, emoji: string }[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('domo_activities');
    if (stored) {
      try {
        setActivitiesList(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    } else {
      const defaultList = [
        { label: 'Piscina', emoji: '🏊‍♂️' },
        { label: 'Enriquecimento ambiental', emoji: '🌳' },
        { label: 'Brincadeira em grupo', emoji: '🐕‍🦺' },
        { label: 'Brincadeira individual', emoji: '🧸' },
        { label: 'Socialização', emoji: '🤝' },
        { label: 'Soneca', emoji: '💤' },
        { label: 'Pausa / descanso', emoji: '⏸️' },
        { label: 'Passeio', emoji: '🦮' },
        { label: 'Bolinha', emoji: '🎾' },
        { label: 'Cabo de guerra', emoji: '🦴' },
        { label: 'Momento de carinho', emoji: '❤️' },
        { label: 'Escovação', emoji: '🪮' },
        { label: 'Banho', emoji: '🧼' },
        { label: 'Treino leve', emoji: '🎓' },
        { label: 'Outro', emoji: '✨' }
      ];
      setActivitiesList(defaultList);
      localStorage.setItem('domo_activities', JSON.stringify(defaultList));
    }
  }, [showBatchActivityModal]);

  // Batch actions variables
  const [batchSelectedPets, setBatchSelectedPets] = useState<string[]>([]);
  const [batchEatenValue, setBatchEatenValue] = useState<ChecklistEntry['comeu']>('Comeu tudo');
  const [batchObservation, setBatchObservation] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // Batch activities states
  const [batchActivityType, setBatchActivityType] = useState('Piscina');
  const [batchActivityDate, setBatchActivityDate] = useState(todayLocal());
  const [batchActivityTime, setBatchActivityTime] = useState('');
  const [batchActivityResponsavel, setBatchActivityResponsavel] = useState('');
  const [batchActivitySelectedPets, setBatchActivitySelectedPets] = useState<string[]>([]);
  const [batchActivitySearchTerm, setBatchActivitySearchTerm] = useState('');
  const [batchActivityObservation, setBatchActivityObservation] = useState('');
  const [batchActivityVisivelTutor, setBatchActivityVisivelTutor] = useState(true);
  const [savingBatchActivity, setSavingBatchActivity] = useState(false);
  const [activitySaveProgress, setActivitySaveProgress] = useState('');
  const [batchActivityFile, setBatchActivityFile] = useState<File | null>(null);
  const [batchActivityFilePreview, setBatchActivityFilePreview] = useState<string | null>(null);

  // Moment modal states
  const [showMomentModal, setShowMomentModal] = useState(false);
  const [momentSelectedPets, setMomentSelectedPets] = useState<string[]>([]);
  const [momentFile, setMomentFile] = useState<File | null>(null);
  const [momentFilePreview, setMomentFilePreview] = useState<string | null>(null);
  const [momentTime, setMomentTime] = useState('');
  const [momentDate, setMomentDate] = useState(todayLocal());
  const [momentResponsavel, setMomentResponsavel] = useState('');
  const [momentLegenda, setMomentLegenda] = useState('');
  const [momentVisivelTutor, setMomentVisivelTutor] = useState(true);
  const [savingMoment, setSavingMoment] = useState(false);
  const [momentSearchTerm, setMomentSearchTerm] = useState('');

  // Pending tutor registrations list
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [editingPending, setEditingPending] = useState<any | null>(null);
  const [editingPendingIndex, setEditingPendingIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const loadPendings = () => {
      const stored = localStorage.getItem('domo_cadastros_pendentes');
      if (stored && !unsubscribeSnapshot) {
        try {
          setPendentes(JSON.parse(stored));
        } catch (e) {
          console.error("Erro canino ao carregar cadastros públicos:", e);
        }
      } else if (!unsubscribeSnapshot) {
        setPendentes([]);
      }
    };

    // If Firebase is configured and user is logged in, subscribe to live pending registrations
    const setupFirebaseSubscription = () => {
      if (isFirebaseConfigured && db && auth.currentUser) {
        const pendentesRef = collection(db, 'cadastros_pendentes');
        const q = query(pendentesRef, where('tenant_id', '==', auth.currentUser.uid));

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          if (!active) return;
          const fetchedPendings: any[] = [];
          snapshot.forEach((docSnap) => {
            fetchedPendings.push({
              ...docSnap.data(),
              id: docSnap.id,
            });
          });
          setPendentes(fetchedPendings);
          // Also sync to local storage for consistency/offline
          localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(fetchedPendings));
          window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));
        }, (error) => {
          console.error("Erro ao escutar cadastros pendentes:", error);
          loadPendings();
        });
      } else {
        loadPendings();
      }
    };

    setupFirebaseSubscription();

    window.addEventListener('domoPendingRegistrationsChanged', loadPendings);

    return () => {
      active = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      window.removeEventListener('domoPendingRegistrationsChanged', loadPendings);
    };
  }, []);

  interface LiveToast {
    id: string;
    type: 'yellow' | 'red' | 'green';
    medId: string;
    slotNum: number;
    petId: string;
    petName: string;
    medName: string;
    dosage: string;
    timeStr: string;
    text?: string;
    givenTime?: string;
    givenBy?: string;
    createdAt: number;
  }

  const [liveToasts, setLiveToasts] = useState<LiveToast[]>([]);
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>([]);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  const getNumSlots = (freq: string) => {
    if (freq === '12h') return 2;
    if (freq === '8h') return 3;
    if (freq === '6h') return 4;
    return 1;
  };

  const handleSaveMedicationLog = (log: MedicationLog) => {
    if (onSaveMedicationLog) {
      onSaveMedicationLog(log);
    } else {
      const stored = JSON.parse(localStorage.getItem('domo_medication_logs') || '[]');
      stored.push(log);
      localStorage.setItem('domo_medication_logs', JSON.stringify(stored));
    }

    // Trigger green success notification immediately!
    const med = medications.find(m => m.id === log.medicationId);
    const pet = pets.find(p => p.id === log.petId);
    if (med && pet) {
      const givenTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const userName = log.offeredBy || 'Camila';
      const toastId = `green-${log.medicationId}-${log.slot || 0}`;
      
      setLiveToasts(prev => {
        const filtered = prev.filter(t => t.id !== toastId);
        return [...filtered, {
          id: toastId,
          type: 'green',
          medId: med.id,
          slotNum: log.slot || 0,
          petId: pet.id,
          petName: pet.pet_nome,
          medName: med.name,
          dosage: med.dosage,
          timeStr: med.time,
          givenTime,
          givenBy: userName,
          createdAt: Date.now()
        }].slice(-3); // Limit to 3 stacked max
      });
    }
  };

  const handleRegisterNow = (toast: LiveToast) => {
    const userName = prompt("Qual o nome do cuidador aplicando a medicação?", "Camila");
    if (userName === null) return;
    const finalUser = userName.trim() || 'Camila';

    const newLog: MedicationLog = {
      id: `MLOG_${Date.now()}_${Math.floor(Math.random() * 1051)}`,
      medicationId: toast.medId,
      petId: toast.petId,
      date: todayLocal(),
      offered: true,
      offeredBy: finalUser,
      slot: toast.slotNum,
      notes: 'Aplicado via banner de notificação'
    };

    handleSaveMedicationLog(newLog);
  };

  // Auto-dismiss toasts after 10 seconds if not interacted
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setLiveToasts(prev => prev.filter(toast => now - toast.createdAt < 10000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const scanMedications = () => {
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotal = currentH * 60 + currentM;
    const todayDate = todayLocal();

    const activeMeds = medications.filter(m => m.active);
    const newToasts: LiveToast[] = [];

    activeMeds.forEach(med => {
      const pet = pets.find(p => p.id === med.petId);
      if (!pet) return;

      const isEscalado = selectedDay === 'Todos' || isPetOnDay(pet, selectedDay);
      if (!isEscalado) return;

      const numSlots = getNumSlots(med.frequency);
      for (let i = 0; i < numSlots; i++) {
        const slotNum = numSlots > 1 ? i + 1 : 0;
        
        const log = medicationLogs.find(l => l.medicationId === med.id && l.date === todayDate && (l.slot || 0) === slotNum);
        const isRegistered = log !== undefined;

        if (!isRegistered) {
          let slotHour = 0;
          let slotMin = 0;
          const [h, m_] = med.time.split(':').map(Number);
          if (numSlots > 1) {
            const interval = med.frequency === '12h' ? 12 : med.frequency === '8h' ? 8 : 6;
            slotHour = (h + (interval * (slotNum - 1))) % 24;
            slotMin = m_;
          } else {
            slotHour = h;
            slotMin = m_;
          }
          
          const displayTime = `${slotHour.toString().padStart(2, '0')}:${slotMin.toString().padStart(2, '0')}`;
          const slotTotal = slotHour * 60 + slotMin;
          const diffMinutes = slotTotal - currentTotal;

          let type: 'yellow' | 'red' | null = null;
          let toastText = '';

          if (diffMinutes > 5 && diffMinutes <= 30) {
            type = 'yellow';
            toastText = `${med.name} do ${pet.pet_nome} em ${diffMinutes} minutos — ${displayTime}`;
          } else if (diffMinutes <= 5 && diffMinutes >= -180) { // Limit to 3 hours overdue to be considered active red on Dashboard
            type = 'red';
            toastText = `${med.name} da ${pet.pet_nome} em ${diffMinutes >= 0 ? diffMinutes : 0} minutos — AGORA!`;
          }

          if (type) {
            const toastId = `${type}-${med.id}-${slotNum}`;
            if (!dismissedToastIds.includes(toastId)) {
              newToasts.push({
                id: toastId,
                type,
                medId: med.id,
                slotNum,
                petId: pet.id,
                petName: pet.pet_nome,
                medName: med.name,
                dosage: med.dosage,
                timeStr: displayTime,
                text: toastText,
                createdAt: Date.now()
              });
            }
          }
        }
      }
    });

    setLiveToasts(prev => {
      const greenToasts = prev.filter(t => t.type === 'green' && Date.now() - t.createdAt < 10000);
      const merged = [...greenToasts];
      newToasts.forEach(nt => {
        if (!merged.some(m => m.id === nt.id)) {
          merged.push(nt);
        }
      });
      return merged.slice(-3); // limit to 3 visible at once
    });
  };

  useEffect(() => {
    scanMedications();
    const interval = setInterval(() => {
      scanMedications();
    }, 60000);
    return () => clearInterval(interval);
  }, [medications, medicationLogs, pets, selectedDay, dismissedToastIds]);

  const medsTodayList = useMemo(() => {
    const todayDate = todayLocal();
    const activeMeds = medications.filter(m => m.active);
    const list: Array<{
      id: string;
      med: Medication;
      pet?: Pet;
      slotNum: number;
      displayTime: string;
      status: 'pending' | 'given' | 'refused';
      log?: MedicationLog;
    }> = [];

    activeMeds.forEach(med => {
      const pet = pets.find(p => p.id === med.petId);
      if (!pet) return;

      const isEscalado = selectedDay === 'Todos' || isPetOnDay(pet, selectedDay);
      if (!isEscalado) return;

      const numSlots = getNumSlots(med.frequency);
      for (let i = 0; i < numSlots; i++) {
        const slotNum = numSlots > 1 ? i + 1 : 0;
        const log = medicationLogs.find(l => l.medicationId === med.id && l.date === todayDate && (l.slot || 0) === slotNum);
        
        let status: 'pending' | 'given' | 'refused' = 'pending';
        if (log) {
          status = log.offered ? 'given' : 'refused';
        }

        let slotHour = 0;
        let slotMin = 0;
        const [h, m_] = med.time.split(':').map(Number);
        if (numSlots > 1) {
          const interval = med.frequency === '12h' ? 12 : med.frequency === '8h' ? 8 : 6;
          slotHour = (h + (interval * (slotNum - 1))) % 24;
          slotMin = m_;
        } else {
          slotHour = h;
          slotMin = m_;
        }
        const displayTime = `${slotHour.toString().padStart(2, '0')}:${slotMin.toString().padStart(2, '0')}`;

        list.push({
          id: `${med.id}-${slotNum}`,
          med,
          pet,
          slotNum,
          displayTime,
          status,
          log
        });
      }
    });

    return list.sort((a, b) => a.displayTime.localeCompare(b.displayTime));
  }, [medications, medicationLogs, pets, selectedDay, searchDate]);

  const pendingAlertCount = useMemo(() => medsTodayList.filter(item => item.status === 'pending').length, [medsTodayList]);

  const NAV_DAYS = ['Todos', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    NAV_DAYS.forEach(day => {
      counts[day] = pets.filter(pet => isPetOnDay(pet, day)).length;
    });
    return counts;
  }, [pets]);

  // Check if a pet is actively staying in the hotel today
  const isPetInHotelToday = (petId: string) => {
    return (hotelStaysToUse || []).some(stay => 
      stay.petId === petId && 
      (stay.active || stay.status === 'ativa') && 
      searchDate >= (stay.checkInDate || stay.checkIn) && 
      searchDate <= (stay.expectedCheckOutDate || stay.checkOut)
    );
  };

  const filteredPets = useMemo(() => {
    return pets
      .filter(pet => {
        const matchesDay = isPetOnDay(pet, selectedDay);
        const matchesSearch = 
          (pet.pet_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (pet.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesHotelFilter = !showHotelOnly || isPetInHotelToday(pet.id);
        return matchesDay && matchesSearch && matchesHotelFilter;
      })
      .sort((a, b) => (a.pet_nome || '').localeCompare(b.pet_nome || ''));
  }, [pets, selectedDay, searchTerm, showHotelOnly, hotelStaysToUse, searchDate]);

  const checklistsForDate = useMemo(() => checklists.filter(c => c.date === searchDate), [checklists, searchDate]);
  
  const getPetStatus = (petId: string) => checklistsForDate.find(c => c.petId === petId)?.status || 'Pendente';

  const petsNotInDay = useMemo(() => {
    if (selectedDay === 'Todos') return [];
    return pets
      .filter(pet => !isPetOnDay(pet, selectedDay))
      .filter(pet => 
        (pet.pet_nome || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
        (pet.id || '').toLowerCase().includes(modalSearchTerm.toLowerCase())
      )
      .sort((a, b) => (a.pet_nome || '').localeCompare(b.pet_nome || ''));
  }, [pets, selectedDay, modalSearchTerm]);

  const searchedBatchPets = useMemo(() => {
    return pets
      .filter(pet => {
        const name = (pet.pet_nome || '').toLowerCase();
        return name.includes(batchActivitySearchTerm.toLowerCase());
      })
      .sort((a, b) => (a.pet_nome || '').localeCompare(b.pet_nome || ''));
  }, [pets, batchActivitySearchTerm]);

  // Stable deterministic birthday algorithm based on string character keys
  const getDeterministicBirthday = (pet: Pet, dateStr: string) => {
    const [,, day] = dateStr.split('-');
    const dNum = parseInt(day || '1', 10);
    let hash = 0;
    const str = pet.id + pet.pet_nome;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 25 === dNum % 25;
  };

  // Compile real-time smart notifications list from actual records
  const smartNotifications = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: 'hotel' | 'feed_ok' | 'feed_alert' | 'med_pending' | 'birthday' | 'pending_register';
      title: string;
      description: string;
      emoji: string;
      colorClass: string;
      actionText?: string;
      onAction?: () => void;
    }> = [];

    // 1. Hotel departures today
    const departuresToday = (hotelStaysToUse || []).filter(stay => (stay.active || stay.status === 'ativa') && (stay.expectedCheckOutDate || stay.checkOut) === searchDate);
    departuresToday.forEach(stay => {
      const p = pets.find(x => x.id === stay.petId);
      if (p) {
        alerts.push({
          id: `hotel_out_${stay.id}`,
          type: 'hotel',
          title: `🏨 Check-out no Hotel hoje`,
          description: `O cão hoteleiro ${p.pet_nome} realiza seu checkout hoje!`,
          emoji: '🏨',
          colorClass: 'from-blue-50 to-indigo-50 border-indigo-200 text-indigo-900',
          actionText: 'Ver Hotel',
          onAction: () => navigate('/hotel')
        });
      }
    });

    // 2. Latest positive eaten action
    const positiveChecklists = [...checklistsForDate]
      .filter(entry => entry.comeu === 'Comeu tudo')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (positiveChecklists.length > 0) {
      const p = pets.find(x => x.id === positiveChecklists[0].petId);
      if (p) {
        alerts.push({
          id: `feed_positive_last`,
          type: 'feed_ok',
          title: `✅ Comendo Super Bem!`,
          description: `O peludo ${p.pet_nome} comeu tudo sua refeição hoje no capricho!`,
          emoji: '😋',
          colorClass: 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900',
        });
      }
    }

    // 3. Negatives / Missing registrations alert
    const presentPetsWithFeedingAlert = filteredPets.filter(p => {
      const entry = checklistsForDate.find(c => c.petId === p.id);
      return entry && entry.comeu === 'Não comeu';
    });
    presentPetsWithFeedingAlert.forEach(p => {
      alerts.push({
        id: `feed_warn_${p.id}`,
        type: 'feed_alert',
        title: `⚠️ Alerta de Alimentação`,
        description: `O fofuxo ${p.pet_nome} não comeu sua porção hoje! Verifique se precisa de amparo.`,
        emoji: '🔴',
        colorClass: 'from-orange-50 to-rose-50 border-rose-200 text-rose-950',
      });
    });

    const presentWithNoRecordCount = filteredPets.filter(p => !checklistsForDate.some(c => c.petId === p.id)).length;
    if (presentWithNoRecordCount > 0 && selectedDay !== 'Todos') {
      const firstNoRecord = filteredPets.find(p => !checklistsForDate.some(c => c.petId === p.id));
      if (firstNoRecord) {
        alerts.push({
          id: `feed_missing_record`,
          type: 'feed_alert',
          title: `🍽️ Pendências de Alimentação`,
          description: `${firstNoRecord.pet_nome} e outros ${presentWithNoRecordCount - 1} peludinhos estão sem registro hoje.`,
          emoji: '🥣',
          colorClass: 'from-amber-50 to-yellow-50 border-amber-200 text-amber-900',
          actionText: 'Registrar Lote',
          onAction: () => {
            const pendingIds = filteredPets
              .filter(p => !checklistsForDate.some(c => c.petId === p.id))
              .map(p => p.id);
            setBatchSelectedPets(pendingIds);
            setBatchEatenValue('Comeu tudo');
            setBatchObservation('');
            setShowBatchModal(true);
          }
        });
      }
    }

    // 4. Pending Medication today
    const activeMeds = (medications || []).filter(med => med.active);
    activeMeds.forEach(med => {
      const p = filteredPets.find(x => x.id === med.petId);
      if (p) {
        const wasGiven = (medicationLogs || []).some(log => log.medicationId === med.id && log.date === searchDate && log.offered);
        if (!wasGiven) {
          alerts.push({
            id: `med_pend_${med.id}`,
            type: 'med_pending',
            title: `💊 Medicação Pendente`,
            description: `${med.name} do ${p.pet_nome} (${med.dosage}) agendado para às ${med.time}`,
            emoji: '💊',
            colorClass: 'from-pink-50 to-rose-50 border-pink-200 text-rose-900',
            actionText: 'Anotar como Dado',
            onAction: () => {
              const newLog: MedicationLog = {
                id: `MLOG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                medicationId: med.id,
                petId: med.petId,
                date: searchDate,
                offered: true,
                offeredBy: 'Admin',
                notes: 'Aplicado pelo painel dinâmico'
              };
              handleSaveMedicationLog(newLog);
              alert(`Sucesso! Medicação ${med.name} para ${p.pet_nome} marcada como aplicada.`);
            }
          });
        }
      }
    });



    // 6. Multi-tenant public register approvals awaiting review
    pendentes.forEach((ped, idx) => {
      alerts.push({
        id: `pending_reg_${ped.id || idx}`,
        type: 'pending_register',
        title: `📥 Novo cadastro recebido`,
        description: `Novo cadastro recebido: ${ped.pet_nome}`,
        emoji: '📥',
        colorClass: 'from-amber-50 to-orange-50 border-amber-200 text-orange-950',
        actionText: 'Revisar Ficha',
        onAction: () => {
          setShowApprovalsModal(true);
        }
      });
    });

    return alerts;
  }, [hotelStaysToUse, searchDate, checklistsForDate, filteredPets, medications, medicationLogs, pendentes, selectedDay]);

  // Day Stats Overview variables
  const countPresent = filteredPets.length;
  
  const countCheckedFeedings = useMemo(() => {
    return filteredPets.filter(p => checklistsForDate.some(c => c.petId === p.id)).length;
  }, [filteredPets, checklistsForDate]);

  const countInHotel = useMemo(() => {
    return filteredPets.filter(p => isPetInHotelToday(p.id)).length;
  }, [filteredPets, hotelStaysToUse, searchDate]);

  // Actions trigger helpers
  const handleAddToDay = (pet: Pet) => {
    const currentDays = (pet.dia_semana || '').split(',').map(d => d.trim()).filter(Boolean);
    if (!currentDays.includes(selectedDay)) {
      const updatedPet = {
        ...pet,
        dia_semana: [...currentDays, selectedDay].join(', ')
      };
      onUpdatePet(updatedPet);
    }
    setIsAddingToDay(false);
  };

  const handleRemoveFromDay = (e: React.MouseEvent, pet: Pet) => {
    e.stopPropagation();
    if (selectedDay === 'Todos') return;
    
    const currentDays = (pet.dia_semana || '').split(',').map(d => d.trim()).filter(Boolean);
    const updatedPet = {
      ...pet,
      dia_semana: currentDays.filter(d => d !== selectedDay).join(', ')
    };
    onUpdatePet(updatedPet);
  };

  // Direct fast save feeding
  const handleQuickSave = async (e: React.MouseEvent, petId: string) => {
    e.stopPropagation();
    const eatVal = quickEntries[petId];
    if (!eatVal) return alert('Selecione uma opção de alimentação primeiro.');

    setSavingId(petId);
    
    const existing = checklists.find(c => c.petId === petId && c.date === searchDate);
    
    const newEntry: ChecklistEntry = {
      petId,
      date: searchDate,
      comeu: eatVal,
      status: calculateStatus({ comeu: eatVal }),
      agua: existing?.agua || 'Pouca água',
      teveEstimuloHidratacao: existing?.teveEstimuloHidratacao || 'Não',
      comportamento: existing?.comportamento || '-',
      alertas: existing?.alertas || '-',
      observacoes: Object.prototype.hasOwnProperty.call(quickEntries, `obs_${petId}`) 
        ? (quickEntries[`obs_${petId}`] as string) 
        : (existing?.observacoes || ''),
      escoreFecal: existing?.escoreFecal || 3,
      quantoOferecido: existing?.quantoOferecido || '-',
      quantoSobrou: existing?.quantoSobrou || '-',
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveChecklist(newEntry);
      setSavingId(null);
      setSavedId(petId);
      setTimeout(() => setSavedId(null), 3000);
    } catch (err) {
      setSavingId(null);
      console.error("Erro ao salvar:", err);
    }
  };

  const handleSendWhatsApp = async (pet: Pet, entry: ChecklistEntry) => {
    const text = getGeneratedMessage(pet, entry);
    const phone = pet.telefone?.replace(/\D/g, '') || '';
    
    onSaveChecklist({ ...entry, lastMessageSentAt: new Date().toISOString() });

    if (!phone) {
      navigator.clipboard.writeText(text);
      alert('Tutor sem telefone cadastrado. Mensagem copiada!');
      return;
    }

    if (zApiConfig?.instanceId && zApiConfig?.token) {
      try {
        const response = await fetch(`https://api.z-api.io/instances/${zApiConfig.instanceId}/token/${zApiConfig.token}/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zApiConfig.clientToken || ''
          },
          body: JSON.stringify({
            phone: `55${phone}`,
            message: text
          })
        });

        if (!response.ok) {
          throw new Error('Erro ao enviar via Z-API');
        }
        console.log(`Mensagem enviada com sucesso para ${pet.pet_nome}`);
      } catch (e) {
        console.error("Erro Z-API:", e);
        const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }
    } else {
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  const pendingMessages = useMemo(() => {
    return filteredPets.map(pet => {
      const entry = checklists.find(c => c.petId === pet.id && c.date === searchDate);
      if (entry && entry.comeu && !entry.lastMessageSentAt) {
        return { pet, entry };
      }
      return null;
    }).filter(Boolean) as { pet: Pet; entry: ChecklistEntry }[];
  }, [filteredPets, checklists, searchDate]);

  // Execute Batch saving action 
  const handleBatchSaveExecution = async () => {
    if (batchSelectedPets.length === 0) return alert('Selecione ao menos um cachorro para registrar.');
    setSavingBatch(true);
    try {
      for (const petId of batchSelectedPets) {
        const existing = checklists.find(c => c.petId === petId && c.date === searchDate);
        const newEntry: ChecklistEntry = {
          petId,
          date: searchDate,
          comeu: batchEatenValue,
          status: calculateStatus({ comeu: batchEatenValue }),
          agua: existing?.agua || 'Pouca água',
          teveEstimuloHidratacao: existing?.teveEstimuloHidratacao || 'Não',
          comportamento: existing?.comportamento || '-',
          alertas: existing?.alertas || '-',
          observacoes: batchObservation || existing?.observacoes || '',
          escoreFecal: existing?.escoreFecal || 3,
          quantoOferecido: existing?.quantoOferecido || '-',
          quantoSobrou: existing?.quantoSobrou || '-',
          updatedAt: new Date().toISOString()
        };
        await onSaveChecklist(newEntry);
      }
      alert(`Cadastrado alimentação de ${batchSelectedPets.length} cães com sucesso!`);
      setShowBatchModal(false);
      setBatchSelectedPets([]);
      setBatchObservation('');
    } catch (e) {
      console.error(e);
      alert('Erro inesperado de processo ao registrar lote.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Execute Batch Activity saving action
  const handleBatchActivitySaveExecution = async () => {
    if (!batchActivityResponsavel.trim()) {
      return alert('O nome do cuidador é obrigatório.');
    }
    if (batchActivitySelectedPets.length === 0) {
      return alert('Selecione ao menos um pet para registrar a atividade.');
    }

    setSavingBatchActivity(true);
    setActivitySaveProgress(`Iniciando gravação para ${batchActivitySelectedPets.length} pets...`);

    const crecheId = auth.currentUser?.uid || 'default_creche';
    const totalCount = batchActivitySelectedPets.length;
    let successCount = 0;
    const failures: string[] = [];

    // 1. Optional upload of batch activity file to Firebase Storage
    let uploadedImageUrl = '';
    if (batchActivityFile) {
      setActivitySaveProgress('Fazendo upload da foto anexada...');
      const momentId = `MOM_ACT_${Date.now()}`;
      if (isFirebaseConfigured && db && storage) {
        let storagePath = '';
        if (batchActivitySelectedPets.length === 1) {
          storagePath = `tenants/${crecheId}/pets/${batchActivitySelectedPets[0]}/moments/${momentId}`;
        } else {
          storagePath = `tenants/${crecheId}/moments/${momentId}`;
        }
        try {
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, batchActivityFile);
          uploadedImageUrl = await getDownloadURL(storageRef);
        } catch (err) {
          console.warn("Storage upload failed, falling back to Base64:", err);
          try {
            uploadedImageUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(batchActivityFile!);
            });
          } catch (b64Err) {
            console.error("Erro ao converter imagem para base64:", b64Err);
          }
        }
      } else {
        // Mock base64 for offline/preview
        try {
          uploadedImageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(batchActivityFile!);
          });
        } catch (err) {
          console.error("Erro ao converter imagem offline:", err);
        }
      }
    }

    // 2. Save master record
    const activityMasterId = `ACT_LOTE_${Date.now()}`;
    const masterData = {
      atividadeTipo: batchActivityType,
      data: batchActivityDate,
      horario: batchActivityTime,
      responsavel: batchActivityResponsavel.trim(),
      petIds: batchActivitySelectedPets,
      quantidadePets: totalCount,
      observacao: batchActivityObservation.trim(),
      visivelTutor: batchActivityVisivelTutor,
      imagemUrl: uploadedImageUrl || null,
      criadoEm: isFirebaseConfigured && db ? serverTimestamp() : new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'creches', crecheId, 'atividadesEmLote', activityMasterId), masterData);
      } catch (err) {
        console.warn("Erro ao salvar atividade mestre no Firestore:", err);
      }
    }

    // 3. Save individual records for each pet
    for (let i = 0; i < totalCount; i++) {
      const petId = batchActivitySelectedPets[i];
      const pet = pets.find(p => p.id === petId);
      const petName = pet ? pet.pet_nome : petId;

      setActivitySaveProgress(`Salvando atividade para ${i + 1} de ${totalCount} pets (${petName})...`);

      const eventId = `EVT_ACT_${Date.now()}_${i}`;
      const eventData: any = {
        tipo: "atividades",
        atividadeTipo: batchActivityType,
        data: batchActivityDate,
        horario: batchActivityTime,
        responsavel: batchActivityResponsavel.trim(),
        texto: `${batchActivityType} às ${batchActivityTime}, realizada por ${batchActivityResponsavel.trim()}.`,
        observacao: batchActivityObservation.trim(),
        visivelTutor: batchActivityVisivelTutor,
        origem: "atividade_em_lote",
        tenant_id: crecheId,
        criadoEm: isFirebaseConfigured && db ? serverTimestamp() : new Date().toISOString()
      };

      if (uploadedImageUrl) {
        eventData.imagemUrl = uploadedImageUrl;
      }

      try {
        // Save to project's equivalent timeline collection (pets/{petId}/timeline)
        if (isFirebaseConfigured && db) {
          await setDoc(doc(db, 'pets', petId, 'timeline', eventId), eventData);
          // Also save under creches subcollection to fully satisfy the request schema
          await setDoc(doc(db, 'creches', crecheId, 'pets', petId, 'timeline', eventId), eventData);
          
          if (uploadedImageUrl) {
            const petMomentId = `MOM_${Date.now()}_${i}`;
            const momentDoc = {
              url: uploadedImageUrl,
              categoria: "hoje",
              legenda: batchActivityObservation.trim() || `${batchActivityType} do dia`,
              data: batchActivityDate,
              horario: batchActivityTime,
              responsavel: batchActivityResponsavel.trim(),
              visivelTutor: batchActivityVisivelTutor,
              tenant_id: crecheId,
              criadoEm: serverTimestamp()
            };
            await setDoc(doc(db, 'pets', petId, 'moments', petMomentId), momentDoc);
          }
        }

        // Save to localStorage for robust offline fallback & synchronicity
        const localTimelineKey = `domo_timeline_${petId}`;
        const localTimelineStr = localStorage.getItem(localTimelineKey) || '[]';
        const localTimeline = JSON.parse(localTimelineStr);
        localTimeline.unshift({
          id: eventId,
          horario: batchActivityTime,
          tipo: 'atividades',
          texto: eventData.texto,
          atividadeTipo: batchActivityType,
          responsavel: batchActivityResponsavel.trim(),
          observacao: batchActivityObservation.trim(),
          visivelTutor: batchActivityVisivelTutor,
          imagemUrl: uploadedImageUrl || undefined
        });
        localStorage.setItem(localTimelineKey, JSON.stringify(localTimeline));

        if (uploadedImageUrl) {
          const localMomentsKey = `domo_moments_${petId}`;
          const localMomentsStr = localStorage.getItem(localMomentsKey) || '[]';
          const localMoments = JSON.parse(localMomentsStr);
          localMoments.unshift({
            id: `MOM_ACT_${Date.now()}_${i}`,
            url: uploadedImageUrl,
            categoria: 'hoje',
            legenda: batchActivityObservation.trim() || `${batchActivityType} do dia`,
            visivelTutor: batchActivityVisivelTutor,
            criadoEm: new Date().toISOString()
          });
          localStorage.setItem(localMomentsKey, JSON.stringify(localMoments));
        }

        successCount++;
      } catch (err) {
        console.error(`Erro ao salvar para o pet ${petName}:`, err);
        failures.push(petName);
      }
    }

    setSavingBatchActivity(false);
    setActivitySaveProgress('');
    setBatchActivityFile(null);
    setBatchActivityFilePreview(null);
    
    if (failures.length > 0) {
      alert(`Atividade registrada com sucesso para ${successCount} cães. Houve falhas para os seguintes cães: ${failures.join(', ')}.`);
    } else {
      alert(`Atividade registrada para ${successCount} pets.`);
    }

    setShowBatchActivityModal(false);
    setBatchActivitySelectedPets([]);
  };

  // Enviar Momento save logic
  const handleSaveMomentExecution = async () => {
    if (momentSelectedPets.length === 0) {
      return alert('Por favor, selecione ao menos um pet.');
    }
    if (!momentFile) {
      return alert('Por favor, faça upload de uma foto.');
    }
    if (!momentResponsavel.trim()) {
      return alert('Por favor, informe o nome do cuidador.');
    }

    setSavingMoment(true);

    try {
      const tenantId = auth.currentUser?.uid || 'default_tenant';
      const momentId = `MOM_${Date.now()}`;
      let imagemUrl = '';

      // 1. Upload to Firebase Storage
      if (isFirebaseConfigured && db && storage) {
        let storagePath = '';
        if (momentSelectedPets.length === 1) {
          storagePath = `tenants/${tenantId}/pets/${momentSelectedPets[0]}/moments/${momentId}`;
        } else {
          storagePath = `tenants/${tenantId}/moments/${momentId}`;
        }
        try {
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, momentFile);
          imagemUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn("Storage upload failed, falling back to Base64 dataURL:", storageErr);
          // Offline / dev fallback: convert file to Base64 dataURL
          imagemUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(momentFile!);
          });
        }
      } else {
        // Offline / dev fallback: convert file to Base64 dataURL
        imagemUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(momentFile!);
        });
      }

      // 2. Save in Firestore & localStorage for each pet
      for (let i = 0; i < momentSelectedPets.length; i++) {
        const petId = momentSelectedPets[i];
        const eventId = `EVT_MOM_${Date.now()}_${i}`;
        const petMomentId = `MOM_${Date.now()}_${i}`;

        const timelineDoc = {
          tipo: 'fotos',
          data: momentDate,
          horario: momentTime,
          responsavel: momentResponsavel.trim(),
          texto: momentLegenda.trim(),
          imagemUrl,
          visivelTutor: momentVisivelTutor,
          origem: 'momento_do_dia',
          tenant_id: tenantId,
          criadoEm: isFirebaseConfigured && db ? serverTimestamp() : new Date().toISOString()
        };

        const momentDoc = {
          url: imagemUrl,
          categoria: 'hoje',
          legenda: momentLegenda.trim(),
          data: momentDate,
          horario: momentTime,
          responsavel: momentResponsavel.trim(),
          visivelTutor: momentVisivelTutor,
          tenant_id: tenantId,
          criadoEm: isFirebaseConfigured && db ? serverTimestamp() : new Date().toISOString()
        };

        if (isFirebaseConfigured && db) {
          // Save both collections
          await setDoc(doc(db, 'pets', petId, 'timeline', eventId), timelineDoc);
          await setDoc(doc(db, 'pets', petId, 'moments', petMomentId), momentDoc);
        }

        // Local storage fallback
        const localTimelineKey = `domo_timeline_${petId}`;
        const localTimelineStr = localStorage.getItem(localTimelineKey) || '[]';
        const localTimeline = JSON.parse(localTimelineStr);
        localTimeline.unshift({
          id: eventId,
          horario: momentTime,
          tipo: 'fotos',
          texto: momentLegenda.trim(),
          imagemUrl,
          responsavel: momentResponsavel.trim(),
          visivelTutor: momentVisivelTutor,
          origem: 'momento_do_dia'
        });
        localStorage.setItem(localTimelineKey, JSON.stringify(localTimeline));

        const localMomentsKey = `domo_moments_${petId}`;
        const localMomentsStr = localStorage.getItem(localMomentsKey) || '[]';
        const localMoments = JSON.parse(localMomentsStr);
        localMoments.unshift({
          id: petMomentId,
          url: imagemUrl,
          categoria: 'hoje',
          legenda: momentLegenda.trim(),
          visivelTutor: momentVisivelTutor,
          criadoEm: new Date().toISOString()
        });
        localStorage.setItem(localMomentsKey, JSON.stringify(localMoments));
      }

      alert('Momento enviado com sucesso!');
      setShowMomentModal(false);
      setMomentSelectedPets([]);
      setMomentFile(null);
      setMomentFilePreview(null);
      setMomentLegenda('');
    } catch (err) {
      console.error('Erro ao salvar momento:', err);
      alert('Erro ao salvar o momento. Verifique sua conexão.');
    } finally {
      setSavingMoment(false);
    }
  };

  // Fast approve public forms
  const handleApproveForm = async (index: number) => {
    const target = pendentes[index];
    if (!target) return;

    const newPet: Pet = {
      id: target.id || `PET_${Date.now()}`,
      pet_nome: target.pet_nome,
      raca: target.raca || 'Mestiço',
      tutor_nome: target.tutor_nome,
      telefone: target.telefone,
      dia_semana: target.dia_semana || 'Segunda',
      possui_alergia: target.possui_alergia || 'Não',
      alimentos_proibidos: target.alimentos_proibidos || '',
      possui_doenca: 'Não',
      doenca_qual: '',
      comportamento_alimentar: 'Focado',
      precisa_estimulo: 'Não',
      tipo_alimentacao: target.tipo_alimentacao || 'Padrão',
      quantidade_oferecida: target.quantidade_oferecida || '',
      quantidade_aproximada: '',
      marca_racao: '',
      especificacao_racao: '',
      oferece_extras: 'Sim',
      ingestao_agua: 'Ideal',
      interesse_agua: 'Médio',
      ajuda_beber_agua: 'Não',
      sede_pos_creche: 'Não',
      escore_corporal: 'Ideal',
      observacoes: target.observacoes || 'Importado de cadastro público.',
      peso_pet: '10kg',
      foto: target.foto || ''
    };

    onUpdatePet(newPet);

    const updated = [...pendentes];
    updated.splice(index, 1);
    setPendentes(updated);
    localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updated));
    window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));

    if (isFirebaseConfigured && db && target.id) {
      try {
        const pendDocRef = doc(db, 'cadastros_pendentes', target.id);
        await deleteDoc(pendDocRef);
      } catch (err) {
        console.error("Erro ao deletar pendente do Firestore:", err);
      }
    }

    alert(`O pet ${target.pet_nome} foi adicionado com sucesso!`);
  };

  const handleRejectForm = async (index: number) => {
    const target = pendentes[index];
    if (!target) return;

    if (window.confirm(`Apagar pré-cadastro de ${target.pet_nome}?`)) {
      const updated = [...pendentes];
      updated.splice(index, 1);
      setPendentes(updated);
      localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updated));
      window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));

      if (isFirebaseConfigured && db && target.id) {
        try {
          const pendDocRef = doc(db, 'cadastros_pendentes', target.id);
          await deleteDoc(pendDocRef);
        } catch (err) {
          console.error("Erro ao deletar pendente do Firestore:", err);
        }
      }
    }
  };

  const handleSavePendingEdit = async (updatedData: any) => {
    if (editingPendingIndex === null || !editingPending) return;
    
    const updatedPendings = [...pendentes];
    updatedPendings[editingPendingIndex] = updatedData;
    
    setPendentes(updatedPendings);
    localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updatedPendings));
    window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));
    
    if (isFirebaseConfigured && db && updatedData.id) {
      try {
        const pendDocRef = doc(db, 'cadastros_pendentes', updatedData.id);
        await setDoc(pendDocRef, updatedData);
      } catch (err) {
        console.error("Erro ao atualizar pendente no Firestore:", err);
      }
    }
    
    setEditingPending(null);
    setEditingPendingIndex(null);
  };

  // CONDICIONAL: 0 pets → empty state | >0 pets → dashboard
  if (pets.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 text-left">
        <style>{`
          @keyframes bouncePaw {
            0%, 100% {
              transform: translateY(0) scale(1) rotate(0deg);
            }
            30% {
              transform: translateY(-12px) scale(1.1) rotate(15deg);
            }
            50% {
              transform: translateY(-15px) scale(1.1) rotate(-15deg);
            }
            70% {
              transform: translateY(-12px) scale(1.1) rotate(10deg);
            }
          }
          .animate-bounce-paw {
            animation: bouncePaw 1.4s infinite ease-in-out;
            display: inline-block;
          }
        `}</style>

        {/* HEADER SECTION WITH INTEGRATED RECOVERY AND CONTROLS */}
        <div className="bg-white rounded-[40px] p-8 border border-emerald-100/40 shadow-xl relative overflow-visible">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full -mr-28 -mt-28 blur-3xl"></div>
          
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3">
                {domoLogo ? (
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                    <img src={domoLogo} alt="Logo" className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <span className="text-4xl animate-bounce-paw">🐾</span>
                )}
                <div>
                  <h1 className="text-4xl font-black tracking-tighter" style={{ color: domoCor }}>
                    Matilha {domoNome}
                  </h1>
                  <p className="text-slate-400 font-extrabold text-xs uppercase tracking-widest mt-1">Painel Central de Gerenciamento e Escala canina</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">ATIVOS: 0</span>
                <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">ESCALA: Nenhuma</span>
                <span className="bg-[#085041] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                  <span>🔥</span> Firebase Ativo
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-emerald-50/70 py-2.5 px-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-0.5">DATA DO DIÁRIO</span>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="bg-transparent text-emerald-800 font-extrabold outline-none text-xs cursor-pointer select-none border-b border-transparent focus:border-emerald-400"
                  />
                </div>
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-xl text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="space-y-4">
            <span className="text-6xl animate-bounce-paw block">👋</span>
            <h2 className="text-3xl font-black text-[#085041] tracking-tight uppercase">👋 VAMOS COMEÇAR!</h2>
            <p className="text-slate-500 font-medium text-base max-w-md mx-auto leading-relaxed">
              Nenhum pet cadastrado ainda. Vá para{' '}
              <strong className="text-emerald-700 font-extrabold">CADASTRO</strong> e adicione seu primeiro pet para começar a gerenciar refeições, medicações e hospedagem.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/cadastro')}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-3xl transition-all shadow-lg hover:shadow-xl shadow-emerald-500/20 active:scale-95 border-b-4 border-emerald-700 inline-flex items-center gap-2"
          >
            IR PARA CADASTRO →
          </button>

          <div className="border-t border-dashed border-slate-100 pt-8">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              O que você verá após adicionar um pet
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
              <div className="p-3.5 bg-[#FAF9F5] border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1">
                <span className="text-2xl">🍖</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Refeições</span>
              </div>
              <div className="p-3.5 bg-[#FAF9F5] border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1">
                <span className="text-2xl">💊</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Medicações</span>
              </div>
              <div className="p-3.5 bg-[#FAF9F5] border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1">
                <span className="text-2xl">🏨</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Hospedagem</span>
              </div>
              <div className="p-3.5 bg-[#FAF9F5] border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1">
                <span className="text-2xl">📬</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Notificações</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <style>{`
        @keyframes bouncePaw {
          0%, 100% {
            transform: translateY(0) scale(1) rotate(0deg);
          }
          30% {
            transform: translateY(-12px) scale(1.1) rotate(15deg);
          }
          50% {
            transform: translateY(-15px) scale(1.1) rotate(-15deg);
          }
          70% {
            transform: translateY(-12px) scale(1.1) rotate(10deg);
          }
        }
        .animate-bounce-paw {
          animation: bouncePaw 1.4s infinite ease-in-out;
          display: inline-block;
        }
        .text-glow {
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        }
      `}</style>

      {/* MEDICATIONS AUTO-ALERTS STACK (Max 3) */}
      {liveToasts.length > 0 && (
        <div className="space-y-3 z-50">
          {liveToasts.map((toast) => {
            const isYellow = toast.type === 'yellow';
            const isRed = toast.type === 'red';
            const isGreen = toast.type === 'green';
            
            return (
              <div
                key={toast.id}
                className={`flex items-center justify-between p-4 px-5 rounded-[24px] border shadow-md transition-all duration-300 animate-in slide-in-from-top-4 ${
                  isYellow ? 'bg-amber-50 border-amber-200 text-amber-900' :
                  isRed ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' :
                  'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 select-none">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${
                    isYellow ? 'bg-amber-100 text-amber-700' :
                    isRed ? 'bg-rose-100 text-rose-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {isYellow ? '⏰' : isRed ? '🚨' : '✅'}
                  </div>
                  <div>
                    <span className="text-xs font-semibold leading-relaxed">
                      {isYellow ? (
                        <>
                          <strong className="font-extrabold">{toast.medName}</strong> do <strong className="font-extrabold">{toast.petName}</strong> em 30 minutos — {toast.timeStr}
                        </>
                      ) : isRed ? (
                        <>
                          <strong className="font-extrabold">{toast.medName}</strong> da <strong className="font-extrabold">{toast.petName}</strong> em 5 minutos — AGORA!
                        </>
                      ) : (
                        <>
                          <strong className="font-extrabold">{toast.medName}</strong> do <strong className="font-extrabold">{toast.petName}</strong> foi dado às {toast.givenTime || '14h02'} por <strong className="font-extrabold">{toast.givenBy || 'Camila'}</strong>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {(isYellow || isRed) && (
                    <button
                      type="button"
                      onClick={() => handleRegisterNow(toast)}
                      className="whitespace-nowrap px-3.5 py-1.5 bg-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 text-slate-800"
                    >
                      Registrar agora
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setLiveToasts(prev => prev.filter(t => t.id !== toast.id));
                      setDismissedToastIds(prev => [...prev, toast.id]);
                    }}
                    className="p-1.5 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 cursor-pointer text-current opacity-70 hover:opacity-100" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MESSAGE STATION */}
      {pendingMessages.length > 0 && (
        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-[#0a231d] rounded-[36px] p-7 border border-emerald-500/10 shadow-2xl relative overflow-hidden text-white/90">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] font-black tracking-wider uppercase text-emerald-400">Relatório de Envio Ativo</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight mt-1 text-white">Mensagens de Rotina Pendentes</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-white/10 border border-white/15 text-white/90 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md">
                   Pendentes: <span className="font-black text-emerald-400">{pendingMessages.length} tutores</span>
                </span>
                <button 
                  onClick={() => {
                    if (confirm('Marcar todas as mensagens de hoje como enviadas? (Não abrirá o WhatsApp)')) {
                      pendingMessages.forEach(({ entry }) => {
                        onSaveChecklist({ ...entry, lastMessageSentAt: new Date().toISOString() });
                      });
                    }
                  }}
                  className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl hover:bg-emerald-500/25 transition-all uppercase tracking-wider hover:scale-102 active:scale-95"
                >
                  Marcar todos enviados
                </button>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {pendingMessages.map(({ pet, entry }) => (
                <div key={pet.id} className="min-w-[280px] bg-white/[0.03] border border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.05] rounded-[26px] p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 border border-white/10 rounded-2xl flex items-center justify-center text-xl overflow-hidden">
                      {pet.foto ? (
                        <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        "🐶"
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm leading-tight">{pet.pet_nome}</p>
                      <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 mt-1 rounded-md ${
                        entry.comeu === 'Comeu tudo' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : entry.comeu === 'Não comeu'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {entry.comeu}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSendWhatsApp(pet, entry)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                  >
                    ENVIAR PARA TUTOR
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-medium text-white/40 italic mt-2 flex items-center gap-1.5">
              <span>💡</span> Clique em "Enviar para Tutor" para abrir o WhatsApp Web ou App pré-preenchido.
            </p>
          </div>
        </div>
      )}



      {/* HEADER SECTION WITH INTEGRATED RECOVERY AND CONTROLS */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100/40 shadow-xl relative overflow-visible">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full -mr-28 -mt-28 blur-3xl"></div>
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-4.5">
              {domoLogo ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border-2 border-slate-100 p-2 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                  <img src={domoLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <span className="text-5xl animate-bounce-paw">🐾</span>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter leading-tight" style={{ color: domoCor }}>
                  Matilha {domoNome}
                </h1>
                <p className="text-slate-500 font-black text-xs sm:text-sm uppercase tracking-wider mt-2">Painel Central de Gerenciamento e Escala canina</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <span className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm">ATIVOS: {pets.length}</span>
              <span className="bg-indigo-500 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm">Escala hoje ({selectedDay}): {filteredPets.length} cães</span>
              <span className="bg-[#085041] text-white px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <span>🔥</span> Firebase Ativo
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Date selector button */}
            <div className="bg-emerald-50/70 py-3 px-5 rounded-2xl border-2 border-emerald-100 flex items-center gap-3.5">
              <div className="flex flex-col text-right">
                <span className="text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">DATA DO DIÁRIO</span>
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="bg-transparent text-emerald-800 font-black outline-none text-sm sm:text-base cursor-pointer select-none border-b border-transparent focus:border-emerald-400"
                />
              </div>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>

            {/* Bell/Sino no topbar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBellDropdown(!showBellDropdown)}
                className="w-12 h-12 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-2xl flex items-center justify-center transition-all relative active:scale-95 cursor-pointer shadow-sm shrink-0"
                title={`${pendingAlertCount} medicações pendentes`}
              >
                <span className="text-xl">🔔</span>
                {pendingAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white animate-pulse">
                    {pendingAlertCount}
                  </span>
                )}
              </button>

              {showBellDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl border border-slate-150 shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 select-none">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 leading-none">Medicações ({medsTodayList.length})</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hoje • {pendingAlertCount} pendentes</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowBellDropdown(false)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-650 cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 text-left">
                    {medsTodayList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 select-none">
                        <span className="text-2xl mb-1 block">💊</span>
                        <p className="text-[10px] font-black uppercase tracking-wider">Sem tarefas de medicação</p>
                        <p className="text-[9px] font-bold opacity-60">Nenhum cão necessita medicações hoje.</p>
                      </div>
                    ) : (
                      medsTodayList.map(({ id, med, pet, slotNum, displayTime, status, log }) => {
                        return (
                          <div key={id} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100/80 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center font-bold shrink-0 text-sm overflow-hidden select-none">
                                {pet?.foto ? (
                                  <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  "🐶"
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-extrabold text-slate-800 leading-tight truncate">
                                  {med.name}
                                </p>
                                <p className="text-[9px] font-bold text-indigo-600 truncate uppercase mt-0.5 select-none">
                                  {pet?.pet_nome} • {displayTime} {slotNum > 0 && `(Dose ${slotNum})`}
                                </p>
                              </div>
                            </div>

                            <div className="flex-shrink-0">
                              {status === 'given' ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-black text-[9px] border border-emerald-150 uppercase select-none" title={`Dado por ${log?.offeredBy || 'Camila'}`}>
                                  Dado ✓
                                </span>
                              ) : status === 'refused' ? (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-black text-[9px] border border-rose-150 uppercase select-none">
                                  Recusado ✕
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const userName = prompt("Qual o nome do cuidador aplicando a medicação?", "Camila");
                                    if (userName === null) return;
                                    const finalUser = userName.trim() || 'Camila';

                                    const newLog: MedicationLog = {
                                      id: `MLOG_${Date.now()}_${Math.floor(Math.random() * 1051)}`,
                                      medicationId: med.id,
                                      petId: med.petId,
                                      date: todayLocal(),
                                      offered: true,
                                      offeredBy: finalUser,
                                      slot: slotNum,
                                      notes: 'Aplicado via menu do sino'
                                    };
                                    handleSaveMedicationLog(newLog);
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition cursor-pointer select-none"
                                >
                                  Dar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SMART NOTIFICATIONS BOX (TOP OF PANEL) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">Notificações Inteligentes</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alertas operacionais gerados em tempo real de acordo com as rotinas</p>
            </div>
          </div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-full">{smartNotifications.length} ativos</span>
        </div>

        {smartNotifications.length === 0 ? (
          <div className="bg-slate-50 rounded-[30px] p-6 text-center border-2 border-dashed border-slate-100 text-slate-400 flex flex-col items-center justify-center">
            <span className="text-3xl mb-1.5 opacity-55">💤</span>
            <p className="text-xs font-black uppercase tracking-wider">Tudo sob controle!</p>
            <p className="text-[10px] font-bold opacity-60">Nenhum evento ou pendência crítica detectada para hoje.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smartNotifications.map(alert => (
              <div 
                key={alert.id}
                className={`bg-gradient-to-r ${alert.colorClass} border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4 uppercase-none relative overflow-hidden`}
              >
                <span className="text-3xl w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner">
                  {alert.emoji}
                </span>
                <div className="flex-1 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-800 leading-tight flex items-center gap-1.5">
                    {alert.title}
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-600 leading-normal">
                    {alert.description}
                  </p>
                  {alert.actionText && (
                    <button
                      onClick={alert.onAction}
                      className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-150 hover:bg-slate-50 active:scale-95 transition-all mt-1.5 flex items-center gap-1"
                    >
                      {alert.actionText}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DASHBOARD STATISTICS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 1: Refeições */}
        <div className="bg-gradient-to-br from-[#085041] to-[#043329] text-white rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mb-10 blur-xl group-hover:bg-white/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300">🍖 REFEIÇÕES</span>
            <CheckSquare className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="flex items-end gap-2.5 mt-3">
            <p className="text-4xl sm:text-5xl font-black text-white leading-none">{countCheckedFeedings}</p>
            <p className="text-slate-400 font-black text-base sm:text-lg">/ {countPresent}</p>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-indigo-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${countPresent > 0 ? (countCheckedFeedings / countPresent) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-xs sm:text-sm font-black text-[#9EE5CC] mt-3.5 uppercase tracking-wide">Refeições registradas hoje</p>
        </div>

        {/* Card 2: Medicações */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mb-10 blur-xl group-hover:bg-white/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#B3C8FF]">💊 MEDICAÇÕES</span>
            <Users className="w-5 h-5 text-[#B3C8FF]" />
          </div>
          <div className="flex items-end gap-2.5 mt-3">
            <p className="text-4xl sm:text-5xl font-black text-white leading-none">
              {medsTodayList.filter(item => item.status === 'given').length}
            </p>
            <p className="text-slate-400 font-black text-base sm:text-lg">
              / {medsTodayList.length}
            </p>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-indigo-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${medsTodayList.length > 0 ? (medsTodayList.filter(item => item.status === 'given').length / medsTodayList.length) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-xs sm:text-sm font-black text-[#B3C8FF] mt-3.5 uppercase tracking-wide">Medicações aplicadas</p>
        </div>

        {/* Card 3: Hospedagem */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mb-10 blur-xl group-hover:bg-white/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-pink-300">🏨 HOSPEDAGEM</span>
            <Building2 className="w-5 h-5 text-pink-300" />
          </div>
          <div className="flex items-end gap-2.5 mt-3">
            <p className="text-4xl sm:text-5xl font-black text-white leading-none">{countInHotel}</p>
          </div>
          <p className="text-xs sm:text-sm font-black text-[#FBCFE8] mt-3.5 uppercase tracking-wide">Pets hospedados na creche hoje</p>
        </div>
      </div>

      {/* QUICK ACTIONS CARDS (4 ROW CARDS) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none font-sans">Ações de Resposta Rápida</h3>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">Acione fluxos produtivos em lote ou filtre relatórios instantaneamente</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Card 1: Batch registry */}
          <button 
            type="button"
            onClick={() => {
              const pendingIds = filteredPets
                .filter(p => !checklistsForDate.some(c => c.petId === p.id))
                .map(p => p.id);
              setBatchSelectedPets(pendingIds);
              setBatchEatenValue('Comeu tudo');
              setBatchObservation('');
              setShowBatchModal(true);
            }}
            className="p-4 rounded-2xl bg-gradient-to-b from-white to-slate-50 border-2 border-slate-100 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px]"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Alimentação</p>
              <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight mt-1">Registrar refeição</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">Vários cães</p>
            </div>
          </button>

          {/* Card 1B: Batch Activity registry */}
          <button 
            type="button"
            id="btn-atividades-em-lote"
            onClick={() => {
              setBatchActivitySelectedPets([]);
              setBatchActivityType('Piscina');
              setBatchActivityDate(todayLocal());
              const now = new Date();
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              setBatchActivityTime(`${hours}:${minutes}`);
              setBatchActivityResponsavel('');
              setBatchActivitySearchTerm('');
              setBatchActivityObservation('');
              setBatchActivityVisivelTutor(true);
              setActivitySaveProgress('');
              setBatchActivityFile(null);
              setBatchActivityFilePreview(null);
              setShowBatchActivityModal(true);
            }}
            className="p-4 rounded-2xl bg-gradient-to-b from-white to-slate-50 border-2 border-slate-100 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px]"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Recreação</p>
              <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight mt-1">Atividade em lote</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">Atividades em grupo</p>
            </div>
          </button>

          {/* Card 1C: Enviar Momento */}
          <button 
            type="button"
            onClick={() => {
              setMomentSelectedPets([]);
              setMomentFile(null);
              setMomentFilePreview(null);
              setMomentDate(todayLocal());
              const now = new Date();
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              setMomentTime(`${hours}:${minutes}`);
              setMomentResponsavel(auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '');
              setMomentLegenda('');
              setMomentVisivelTutor(true);
              setMomentSearchTerm('');
              setShowMomentModal(true);
            }}
            className="p-4 rounded-2xl bg-gradient-to-b from-white to-slate-50 border-2 border-slate-100 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px]"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-600">Momentos</p>
              <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight mt-1">Enviar momento</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">Envie fotos/vídeos</p>
            </div>
          </button>

          {/* Card 2: List hotel stays now */}
          <button 
            type="button"
            onClick={() => setShowHotelOnly(prev => !prev)}
            className={`p-4 rounded-2xl text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px] border-2 ${
              showHotelOnly 
                ? 'bg-gradient-to-b from-emerald-500 to-[#10b981]/90 border-emerald-600 text-white' 
                : 'bg-gradient-to-b from-white to-slate-50 border-slate-100'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner ${showHotelOnly ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${showHotelOnly ? 'text-emerald-100 animate-pulse' : 'text-indigo-600'}`}>
                {showHotelOnly ? 'FILTRO ATIVO ✅' : 'Hotel'}
              </p>
              <h4 className={`font-black text-sm sm:text-base leading-tight mt-1 ${showHotelOnly ? 'text-white' : 'text-slate-800'}`}>
                Ver hospedados
              </h4>
              <p className={`text-[11px] font-bold mt-0.5 leading-tight ${showHotelOnly ? 'text-emerald-100' : 'text-slate-400'}`}>
                Acompanhe o hotel
              </p>
            </div>
          </button>

          {/* Card 3: Pending daily medications list view */}
          <button 
            type="button"
            onClick={() => {
              setMedsFilterPetId(null);
              setShowMedicationsModal(true);
            }}
            className="p-4 rounded-2xl bg-gradient-to-b from-white to-slate-50 border-2 border-slate-100 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px]"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Medicação</p>
              <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight mt-1">Medicamentos</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">Remédios do dia</p>
            </div>
          </button>

          {/* Card 4: View tutor pending review cards */}
          <button 
            type="button"
            onClick={() => setShowApprovalsModal(true)}
            className="p-4 rounded-2xl bg-gradient-to-b from-white to-slate-50 border-2 border-slate-100 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between h-[155px] relative"
          >
            {pendentes.length > 0 && (
              <span className="absolute top-3 right-3 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center font-black text-[9px] border-2 border-white animate-pulse">
                {pendentes.length}
              </span>
            )}
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-500">Cadastros</p>
              <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight mt-1">Pendentes</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">Aprovar cadastros</p>
            </div>
          </button>
        </div>
      </div>
      
      {/* FILTER NOTIFY BAR */}
      {showHotelOnly && (
        <div className="bg-emerald-50 border-2 border-emerald-100 px-6 py-4 rounded-2xl flex items-center justify-between text-emerald-800 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛎️</span>
            <span className="text-xs font-black uppercase">Filtro Ativo: Exibindo apenas hóspedes hospedados no hotel hoje</span>
          </div>
          <button 
            onClick={() => setShowHotelOnly(false)}
            className="text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition"
          >
            Retirar Filtro ✕
          </button>
        </div>
      )}

      {/* EXPANDED DAYS NAVIGATOR BAR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-150 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-inner">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                {selectedDay === 'Todos' ? 'Pets de Hoje' : <>Pets de <span className="text-indigo-600 font-black" style={{ color: domoCor }}>{selectedDay}</span></>}
              </h3>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-xs md:text-sm font-bold text-slate-500">
                  Acompanhe os pets previstos e registre a rotina com poucos cliques.
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500/80">
                  Organize a matilha do dia com praticidade.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-4 rounded-[42px] border border-slate-100 shadow-inner">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 px-1.5">
            {NAV_DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                type="button"
                className={`w-full h-[160px] rounded-[38px] font-black transition-all border-[4px] flex flex-col items-center justify-center gap-2 active:scale-95 shadow-sm hover:shadow-md cursor-pointer ${
                  selectedDay === day 
                    ? 'text-white border-white shadow-xl scale-[1.03] z-10' 
                    : 'bg-white text-slate-400 border-transparent hover:border-emerald-50 hover:text-slate-500'
                }`}
                style={selectedDay === day ? { backgroundColor: domoCor, borderColor: '#ffffff' } : undefined}
              >
                {/* Enquadramento do dia da semana (frame/pill) para evitar overflow e ficar super legível */}
                <div 
                  className={`px-2.5 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center w-[85%] truncate transition-all shadow-sm border ${
                    selectedDay === day 
                      ? 'bg-black/15 text-white border-white/25' 
                      : 'bg-slate-50 text-slate-700 border-slate-100'
                  }`}
                >
                  {day}
                </div>
                
                {/* Contador de Cães em tamanho ampliado para facilitar a leitura */}
                <span className={`text-5xl block font-black leading-none tracking-tight ${selectedDay === day ? 'text-white text-glow' : 'text-slate-800'}`}>
                  {dayCounts[day] || 0}
                </span>
                
                {/* Unidade/Texto auxiliar mais visível */}
                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedDay === day ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                  cães
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FILTER AND SEARCH RACK */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative group flex-1">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-full group-focus-within:bg-emerald-500/10 transition-all"></div>
          <input
            type="text"
            placeholder={selectedDay === 'Todos' ? 'Buscar pet pelo nome...' : `Buscar pet na escala de ${selectedDay.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="relative w-full pl-14 pr-8 py-4 bg-white rounded-3xl border border-slate-200 focus:border-emerald-300 outline-none transition-all font-black text-slate-700 placeholder:text-slate-300 shadow-sm text-sm"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
        </div>
        {selectedDay !== 'Todos' && (
          <button 
            type="button"
            onClick={() => setIsAddingToDay(true)}
            className="bg-emerald-600 text-white px-7 rounded-3xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-700/5 hover:scale-103 active:scale-95 transition-all flex items-center justify-center gap-2 h-13 shrink-0"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={3} /> Adicionar pet ao dia
          </button>
        )}
      </div>

      {/* QUICK LOGGING ACTIONS BAR */}
      <div className="bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider">Rotina de {selectedDay === 'Todos' ? 'Hoje' : selectedDay}:</span>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              const pendingIds = filteredPets
                .filter(p => !checklistsForDate.some(c => c.petId === p.id))
                .map(p => p.id);
              setBatchSelectedPets(pendingIds);
              setBatchEatenValue('Comeu tudo');
              setBatchObservation('');
              setShowBatchModal(true);
            }}
            className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            🥣 <span className="truncate">Registrar refeição em lote</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setBatchActivitySelectedPets([]);
              
              const stored = localStorage.getItem('domo_activities');
              let defaultAct = 'Piscina';
              if (stored) {
                try {
                  const parsed = JSON.parse(stored);
                  if (parsed && parsed.length > 0) {
                    defaultAct = parsed[0].label;
                  }
                } catch(e){}
              }
              setBatchActivityType(defaultAct);
              
              setBatchActivityDate(todayLocal());
              const now = new Date();
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              setBatchActivityTime(`${hours}:${minutes}`);
              setBatchActivityResponsavel('');
              setBatchActivitySearchTerm('');
              setBatchActivityObservation('');
              setBatchActivityVisivelTutor(true);
              setActivitySaveProgress('');
              setShowBatchActivityModal(true);
            }}
            className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            ✨ <span className="truncate">Registrar atividade em lote</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMedsFilterPetId(null);
              setShowMedicationsModal(true);
            }}
            className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            💊 <span className="truncate">Registrar medicação</span>
          </button>

          {selectedDay !== 'Todos' && (
            <button
              type="button"
              onClick={() => setIsAddingToDay(true)}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              ➕ <span className="truncate">Adicionar pet ao dia</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN PET CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-16 w-full max-w-[1440px] mx-auto">
        {filteredPets.map((pet, index) => {
          const status = getPetStatus(pet.id);
          const isHotel = isPetInHotelToday(pet.id);
          const activeStay = isHotel ? (hotelStaysToUse || []).find(stay => 
            stay.petId === pet.id && 
            (stay.active || stay.status === 'ativa') &&
            searchDate >= (stay.checkInDate || stay.checkIn) && 
            searchDate <= (stay.expectedCheckOutDate || stay.checkOut)
          ) : undefined;
          const isBday = getDeterministicBirthday(pet, searchDate);
          const hasAnyTags = (pet.alertas_importantes && pet.alertas_importantes.length > 0) || 
                             (pet.perfil_comportamental && pet.perfil_comportamental.length > 0) ||
                             (pet.amizades && pet.amizades.length > 0);

          return (
            <div 
              key={pet.id}
              onClick={() => navigate(`/pet/${pet.id}?date=${searchDate}`)}
              className={`p-4 sm:p-5 rounded-3xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-full justify-between group relative overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 min-w-0 w-full ${
                isHotel 
                  ? 'bg-gradient-to-br from-indigo-50/35 via-white to-white border-indigo-200 ring-2 ring-indigo-500/5' 
                  : 'bg-white border-slate-150'
              }`}
              style={{ contentVisibility: 'auto' }}
            >
              {/* Highlight ribbon based on events */}
              {isHotel && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-700 to-indigo-500 text-white px-3 py-1.5 rounded-bl-xl font-black text-[10px] uppercase tracking-widest shadow-sm z-10 flex items-center gap-1">
                  <span>🏨 HOJE NO HOTEL</span>
                </div>
              )}
              {isBday && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-pink-500 to-rose-500 text-white px-3 py-1.5 rounded-bl-xl font-black text-[10px] uppercase tracking-widest shadow-sm z-10 flex items-center gap-1">
                  <span>🎂 ANIVERSÁRIO HOJE</span>
                </div>
              )}

              <div className="absolute top-0 left-0 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 px-3 py-2 rounded-br-xl font-black text-[11px] border-r border-b border-slate-100 z-10">
                #{index + 1}
              </div>

              <div className="flex justify-between items-start gap-3 mb-4 mt-3">
                <div className="flex gap-3 min-w-0 flex-1">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-3xl shadow-inner border group-hover:scale-105 transition-transform flex-shrink-0 overflow-hidden ${
                    isHotel 
                      ? 'bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-500/10' 
                      : 'bg-emerald-50/60 border-white'
                  }`}>
                    {pet.foto ? (
                      <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      "🐶"
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h4 className="font-black text-base sm:text-lg text-slate-800 group-hover:text-emerald-700 leading-tight flex items-center flex-wrap gap-1.5 mt-0.5" title={pet.pet_nome}>
                      <span className="truncate max-w-[150px]">{pet.pet_nome}</span>
                      {isHotel && (
                        <span className="inline-flex items-center text-[8px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-md leading-none gap-0.5 uppercase tracking-wider">
                          <span>🏨</span> HOTEL
                        </span>
                      )}
                    </h4>
                    {pet.tutor_nome && (
                      <p className="text-[11px] sm:text-xs font-black text-emerald-750 uppercase tracking-wide leading-tight mt-1 line-clamp-2 overflow-hidden text-ellipsis" title={pet.tutor_nome}>
                        👤 {pet.tutor_nome}
                      </p>
                    )}
                    <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wide mt-1 truncate" title={`${pet.id} • ${pet.raca || 'Mestiço'}`}>
                      {pet.id} • {pet.raca || 'Mestiço'}
                    </p>
                  </div>
                </div>

                <div className="relative flex flex-col items-end gap-1.5 shrink-0">
                  <div 
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base sm:text-lg shadow-sm border-2 border-white transition-all ${
                      status === 'Pendente' ? 'bg-slate-50 text-slate-300' : getStatusColor(status) + ' text-white'
                    }`}
                  >
                    {getStatusEmoji(status)}
                  </div>
                  {selectedDay !== 'Todos' && (
                    <button 
                      type="button"
                      onClick={(e) => handleRemoveFromDay(e, pet)}
                      className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-250 transition-all shadow-sm flex items-center gap-1 text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                      title="Remover este pet da escala de hoje"
                    >
                      <CalendarX className="w-3 h-3 shrink-0 text-rose-500" />
                      <span>Remover</span>
                    </button>
                  )}
                </div>
              </div>

              {/* QUICK INDIVIDUAL ACTION BUTTONS */}
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mb-4" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBatchActivitySelectedPets([pet.id]);
                    
                    const stored = localStorage.getItem('domo_activities');
                    let defaultAct = 'Piscina';
                    if (stored) {
                      try {
                        const parsed = JSON.parse(stored);
                        if (parsed && parsed.length > 0) {
                          defaultAct = parsed[0].label;
                        }
                      } catch(e){}
                    }
                    setBatchActivityType(defaultAct);
                    
                    setBatchActivityDate(todayLocal());
                    const now = new Date();
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    setBatchActivityTime(`${hours}:${minutes}`);
                    setBatchActivityResponsavel('');
                    setBatchActivitySearchTerm('');
                    setBatchActivityObservation('');
                    setBatchActivityVisivelTutor(true);
                    setActivitySaveProgress('');
                    setBatchActivityFile(null);
                    setBatchActivityFilePreview(null);
                    setShowBatchActivityModal(true);
                  }}
                  className="py-2 sm:py-2.5 px-0.5 rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/70 transition-all text-[11px] font-black uppercase text-indigo-850 flex items-center justify-center gap-0.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Registrar Atividade"
                >
                  <span>⚽</span> <span className="truncate">ATIV.</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMedsFilterPetId(pet.id);
                    setShowMedicationsModal(true);
                  }}
                  className="py-2 sm:py-2.5 px-0.5 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100/70 transition-all text-[11px] font-black uppercase text-rose-850 flex items-center justify-center gap-0.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Registrar Medicação"
                >
                  <span>💊</span> <span className="truncate">MED.</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMomentSelectedPets([pet.id]);
                    setMomentFile(null);
                    setMomentFilePreview(null);
                    setMomentDate(todayLocal());
                    const now = new Date();
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    setMomentTime(`${hours}:${minutes}`);
                    setMomentResponsavel(auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '');
                    setMomentLegenda('');
                    setMomentVisivelTutor(true);
                    setMomentSearchTerm('');
                    setShowMomentModal(true);
                  }}
                  className="py-2 sm:py-2.5 px-0.5 rounded-xl bg-purple-50 border border-purple-100 hover:bg-purple-100/70 transition-all text-[11px] font-black uppercase text-purple-850 flex items-center justify-center gap-0.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Registrar Foto"
                >
                  <span>📸</span> <span className="truncate">FOTO</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTutorPet(pet);
                  }}
                  className="py-2 sm:py-2.5 px-0.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100/70 transition-all text-[11px] font-black uppercase text-amber-850 flex items-center justify-center gap-0.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Ver Dados do Tutor"
                >
                  <span>👤</span> <span className="truncate">TUTOR</span>
                </button>
              </div>

              {/* CARD ALIMENTATION CONTROLS WITH GRACEFUL GRADIENTS */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-150 mt-auto space-y-3">
                <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] sm:text-xs font-black text-emerald-850 uppercase tracking-wider">Alimentação Rápida</span>
                    <button 
                      type="button"
                      onClick={(e) => handleQuickSave(e, pet.id)}
                      disabled={savingId === pet.id}
                      className={`px-4 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 ${
                        savingId === pet.id 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                          : savedId === pet.id
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.01] hover:shadow-md border-b-2 border-emerald-800'
                      }`}
                    >
                      {savingId === pet.id ? '⏳' : savedId === pet.id ? 'Salvo! ✔️' : 'Salvar'}
                    </button>
                  </div>

                  {activeStay && (
                    <div className="bg-indigo-50/70 border border-indigo-150 p-2.5 rounded-2xl text-[10px] text-indigo-950 font-semibold space-y-1 my-1">
                      <div className="flex justify-between font-black uppercase text-[8px] text-indigo-600 tracking-widest leading-none mb-1">
                        <span>🏨 CRONOGRAMA HOTEL</span>
                        <span>{activeStay.feedingTimesPerDay}x ao dia</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span>🥣</span>
                        <span><strong>Refeições:</strong> {activeStay.feedingSchedule?.join(' e ') || 'Não configurado'}</span>
                      </div>
                      {activeStay.feedingNotes && (
                        <div className="text-[9px] text-slate-500 italic mt-0.5">
                          Obs: {activeStay.feedingNotes}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Comeu tudo', internal: 'Comeu tudo', emoji: '😋' },
                      { label: 'Comeu metade', internal: 'Comeu metade', emoji: '😐' },
                      { label: 'Menos metade', internal: 'Comeu menos da metade', emoji: '😕' },
                      { label: 'Não comeu', internal: 'Não comeu', emoji: '🔴' }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setQuickEntries(prev => ({ ...prev, [pet.id]: opt.internal as any }))}
                        className={`py-2 px-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tight border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                          quickEntries[pet.id] === opt.internal 
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-[1.01]' 
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:text-slate-700 shadow-xs'
                        }`}
                      >
                        <span className="text-xs">{opt.emoji}</span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-1.5">
                    <input 
                      type="text"
                      placeholder="Obs. rápida (opcional)..."
                      value={quickEntries[`obs_${pet.id}`] || ''}
                      onChange={(e) => setQuickEntries(prev => ({ ...prev, [`obs_${pet.id}`]: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300 shadow-inner"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-250/50 pt-2.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center h-5">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Dias que frequenta</span>
                    <div className="flex gap-1 justify-end max-w-[150px] overflow-hidden truncate">
                      {(pet.dia_semana || '-').split(',').map(d => (
                         <span key={d} className="text-emerald-700 font-extrabold text-[9px] uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 shrink-0">{d.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-0.5 h-5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${(pet.possui_alergia || '').toLowerCase() === 'sim' ? 'text-rose-500 animate-pulse' : 'text-slate-350'}`}>
                      {(pet.possui_alergia || '').toLowerCase() === 'sim' ? '⚠️ Alergia Crítica' : '✅ Saudável'}
                    </span>
                    <span className="text-indigo-650 bg-indigo-50/70 px-2.5 py-0.5 rounded-lg border border-indigo-100 font-extrabold text-[10px] uppercase truncate max-w-[140px]" title={pet.tipo_alimentacao}>
                      {pet.tipo_alimentacao}
                    </span>
                  </div>

                  {/* INDICADORES COMPORTAMENTO, ALERTAS E AMIGOS */}
                  <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5 h-[65px] justify-center overflow-hidden">
                    {hasAnyTags ? (
                      <div className="space-y-1 overflow-y-auto pr-0.5 h-full max-h-[60px] text-left">
                        {(pet.alertas_importantes && pet.alertas_importantes.length > 0) && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider shrink-0">ALERTAS:</span>
                            {pet.alertas_importantes.map(alertTag => (
                              <span key={alertTag} className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-100/50 uppercase truncate max-w-[120px]" title={alertTag}>🚨 {alertTag}</span>
                            ))}
                          </div>
                        )}

                        {(pet.perfil_comportamental && pet.perfil_comportamental.length > 0) && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider shrink-0">PERFIL:</span>
                            {pet.perfil_comportamental.map(trait => (
                              <span key={trait} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100/30 uppercase truncate max-w-[120px]" title={trait}>🧠 {trait}</span>
                            ))}
                          </div>
                        )}

                        {(pet.amizades && pet.amizades.length > 0) && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider shrink-0">AMIGOS:</span>
                            {pet.amizades.map(friend => (
                              <span key={friend.id} className="text-[9px] font-extrabold text-slate-600 bg-white border border-slate-150 px-1 py-0.2 rounded shadow-sm truncate max-w-[120px]" title={`${friend.nivelAmizade}: ${friend.observacao}`}>❤️ {friend.petAmigo}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2 bg-slate-100/45 rounded-xl border border-dashed border-slate-200/80 flex items-center justify-center h-full">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">🟢 Sem restrições de rotina</span>
                      </div>
                    )}
                  </div>

                  {/* INDICADOR DE REVISÃO MENSAL */}
                  {pet.ultimo_responsavel_atualizacao ? (
                    <div className="flex items-center justify-between gap-1.5 mt-2 border-t border-slate-100/50 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest h-5">
                      <span>Ficha Mestre:</span>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-extrabold shrink-0 truncate max-w-[165px]" title={`Revisado por ${pet.ultimo_responsavel_atualizacao} em ${pet.ultima_data_atualizacao}`}>
                        📋 {pet.ultimo_mes_atualizacao} ({pet.ultimo_responsavel_atualizacao})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1.5 mt-2 border-t border-slate-100/50 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest h-5">
                      <span>Ficha Mestre:</span>
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 font-extrabold shrink-0">
                        ⚠️ Pendente
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPets.length === 0 && (
        <div className="py-24 text-center opacity-30 flex flex-col items-center">
          <span className="text-7xl mb-4 select-none">🦴</span>
          <p className="font-black text-slate-800 uppercase tracking-[0.3em] text-sm">Nenhum pet encontrado para {selectedDay}</p>
          <p className="text-[10px] font-bold mt-1 text-slate-400 uppercase tracking-wider">Tente selecionar outro dia ou retirar os filtros de hotel!</p>
        </div>
      )}

      {/* MODAL 1: BATCH FEEDING (REGISTRAR EM LOTE) */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-lg rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Registrar Alimentação em Lote</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Registre o almoço de múltiplos cães simultaneamente</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Passo 1: Selecione os cães</span>
                
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredPets.map(p => p.id);
                      setBatchSelectedPets(allIds);
                    }}
                    className="text-[9px] font-black uppercase text-[#055140] bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchSelectedPets([])}
                    className="text-[9px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Desmarcar Todos
                  </button>
                </div>

                <div className="border border-slate-150 rounded-2xl max-h-[160px] overflow-y-auto p-3 space-y-1.5 bg-slate-50 shadow-inner">
                  {filteredPets.map(pet => {
                    const isChecked = batchSelectedPets.includes(pet.id);
                    return (
                      <label key={pet.id} className="flex items-center gap-3 p-2 bg-white rounded-xl cursor-pointer hover:bg-emerald-50/30 transition-all text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setBatchSelectedPets(prev => prev.filter(id => id !== pet.id));
                            } else {
                              setBatchSelectedPets(prev => [...prev, pet.id]);
                            }
                          }}
                          className="w-4.5 h-4.5 accent-emerald-600 cursor-pointer rounded"
                        />
                        <span className="text-xs font-black">{pet.pet_nome}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">({pet.tipo_alimentacao})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Passo 2: Selecione o que comeram</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Comeu tudo', val: 'Comeu tudo', emoji: '😋' },
                    { label: 'Comeu metade', val: 'Comeu metade', emoji: '😐' },
                    { label: 'Menos que metade', val: 'Comeu menos da metade', emoji: '😕' },
                    { label: 'Não comeu', val: 'Não comeu', emoji: '🔴' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setBatchEatenValue(opt.val as any)}
                      className={`p-3 rounded-2xl text-[10px] font-black uppercase border flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        batchEatenValue === opt.val 
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                          : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observation text */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Passo 3: Observações de lote (Opcional)</span>
                <textarea
                  placeholder="Ex: Oferecidos extras conforme prontuário..."
                  value={batchObservation}
                  onChange={(e) => setBatchObservation(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-emerald-300 min-h-[70px]"
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-705 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchSaveExecution}
                disabled={savingBatch || batchSelectedPets.length === 0}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {savingBatch ? 'Gravando...' : `Registrar ${batchSelectedPets.length} cães`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: BATCH ACTIVITIES (REGISTRAR ATIVIDADE EM LOTE) */}
      {showBatchActivityModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Registrar Atividade em Lote</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Registre atividades recreativas ou rotinas para múltiplos pets</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowBatchActivityModal(false)}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              
              {/* Progress feedback */}
              {savingBatchActivity && activitySaveProgress && (
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3 text-indigo-700 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <p className="text-xs font-black uppercase tracking-wider">{activitySaveProgress}</p>
                </div>
              )}

              {/* Step 1: Activity Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo de atividade *</span>
                  <select
                    value={batchActivityType}
                    onChange={(e) => setBatchActivityType(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-300 bg-white text-slate-700 cursor-pointer"
                  >
                    {activitiesList.map((act) => (
                      <option key={act.label} value={act.label}>
                        {act.emoji} {act.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nome do Cuidador *</span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Lucas"
                    value={batchActivityResponsavel}
                    onChange={(e) => setBatchActivityResponsavel(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-300 bg-white text-slate-700"
                  />
                </div>
              </div>

              {/* Row 2: Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Data *</span>
                  <input
                    type="date"
                    value={batchActivityDate}
                    onChange={(e) => setBatchActivityDate(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-300 bg-white text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Horário *</span>
                  <input
                    type="text"
                    placeholder="Ex: 14:00"
                    value={batchActivityTime}
                    onChange={(e) => setBatchActivityTime(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-300 bg-white text-slate-700"
                  />
                </div>
              </div>

              {/* Step 2: Selecting Pets */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selecionar pets ({batchActivitySelectedPets.length} selecionados) *</span>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = searchedBatchPets.map(p => p.id);
                        setBatchActivitySelectedPets(allIds);
                      }}
                      className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchActivitySelectedPets([])}
                      className="text-[9px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Limpar seleção
                    </button>
                  </div>
                </div>

                {/* Pet Search Filter inside modal */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar pet por nome..."
                    value={batchActivitySearchTerm}
                    onChange={(e) => setBatchActivitySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-300 bg-white"
                  />
                </div>

                <div className="border border-slate-150 rounded-2xl max-h-[150px] overflow-y-auto p-3 space-y-1.5 bg-slate-50 shadow-inner">
                  {searchedBatchPets.length === 0 ? (
                    <p className="text-center text-[10px] text-slate-400 font-extrabold uppercase p-4">Nenhum pet encontrado</p>
                  ) : (
                    searchedBatchPets.map(pet => {
                      const isChecked = batchActivitySelectedPets.includes(pet.id);
                      return (
                        <label key={pet.id} className="flex items-center gap-3 p-2 bg-white rounded-xl cursor-pointer hover:bg-indigo-50/30 transition-all text-slate-700 border border-slate-100 shadow-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setBatchActivitySelectedPets(prev => prev.filter(id => id !== pet.id));
                              } else {
                                setBatchActivitySelectedPets(prev => [...prev, pet.id]);
                              }
                            }}
                            className="w-4.5 h-4.5 accent-indigo-600 cursor-pointer rounded"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-black">{pet.pet_nome}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Tutor: {pet.tutor_nome}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Step 3: Observations & Options */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observação (Opcional)</span>
                <textarea
                  placeholder="Ex: Participou super bem e brincou bastante com os amiguinhos..."
                  value={batchActivityObservation}
                  onChange={(e) => setBatchActivityObservation(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-300 min-h-[60px]"
                ></textarea>
              </div>

              {/* Optional Photo Attachment */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Anexar Foto (Opcional)</span>
                <div className="border-2 border-dashed border-slate-250 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-center hover:bg-indigo-50/10 transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        alert('Apenas imagens nos formatos JPG, PNG ou WEBP são permitidas.');
                        return;
                      }
                      const maxSize = 5 * 1024 * 1024; // 5MB
                      if (file.size > maxSize) {
                        alert('O tamanho máximo da imagem é de 5MB.');
                        return;
                      }
                      setBatchActivityFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setBatchActivityFilePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  {batchActivityFilePreview ? (
                    <div className="relative w-full flex flex-col items-center z-20">
                      <img src={batchActivityFilePreview} alt="Anexo de Atividade" className="max-h-[120px] rounded-xl object-contain shadow-sm" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatchActivityFile(null);
                          setBatchActivityFilePreview(null);
                        }}
                        className="mt-2 text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest cursor-pointer"
                      >
                        Remover Foto ✕
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1 py-1">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-slate-600">Clique ou arraste uma foto para anexar</p>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">JPG, PNG, WEBP até 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-xs font-black text-slate-700 block">Mostrar no perfil do tutor?</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Se "Sim", a atividade será visível na linha do tempo pública do pet</span>
                </div>
                <div className="flex bg-white p-1 rounded-full border border-slate-150">
                  <button
                    type="button"
                    onClick={() => setBatchActivityVisivelTutor(true)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                      batchActivityVisivelTutor 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchActivityVisivelTutor(false)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                      !batchActivityVisivelTutor 
                        ? 'bg-rose-500 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchActivityModal(false)}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchActivitySaveExecution}
                disabled={savingBatchActivity || batchActivitySelectedPets.length === 0 || !batchActivityResponsavel.trim()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {savingBatchActivity ? 'Gravando...' : `Registrar em ${batchActivitySelectedPets.length} cães`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1C: SEND MOMENT (ENVIAR MOMENTO DO DIA) */}
      {showMomentModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Enviar Momento do Pet</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Envie fotos carinhosas da rotina diária diretamente ao tutor</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowMomentModal(false)}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              
              {savingMoment && (
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex items-center gap-3 text-purple-700 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                  <p className="text-xs font-black uppercase tracking-wider">Fazendo upload do momento e registrando...</p>
                </div>
              )}

              {/* Step 1: Selecting Pets */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selecionar pets ({momentSelectedPets.length} selecionados) *</span>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = pets.map(p => p.id);
                        setMomentSelectedPets(allIds);
                      }}
                      className="text-[9px] font-black uppercase text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setMomentSelectedPets([])}
                      className="text-[9px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Limpar seleção
                    </button>
                  </div>
                </div>

                {/* Pet Search Filter */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar pet por nome..."
                    value={momentSearchTerm}
                    onChange={(e) => setMomentSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-purple-300 bg-white"
                  />
                </div>

                <div className="border border-slate-150 rounded-2xl max-h-[120px] overflow-y-auto p-3 space-y-1.5 bg-slate-50 shadow-inner">
                  {pets.filter(p => p.pet_nome.toLowerCase().includes(momentSearchTerm.toLowerCase())).length === 0 ? (
                    <p className="text-center text-[10px] text-slate-400 font-extrabold uppercase p-4">Nenhum pet encontrado</p>
                  ) : (
                    pets.filter(p => p.pet_nome.toLowerCase().includes(momentSearchTerm.toLowerCase())).map(pet => {
                      const isChecked = momentSelectedPets.includes(pet.id);
                      return (
                        <label key={pet.id} className="flex items-center gap-3 p-2 bg-white rounded-xl cursor-pointer hover:bg-purple-50/30 transition-all text-slate-700 border border-slate-100 shadow-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setMomentSelectedPets(prev => prev.filter(id => id !== pet.id));
                              } else {
                                setMomentSelectedPets(prev => [...prev, pet.id]);
                              }
                            }}
                            className="w-4.5 h-4.5 accent-purple-600 cursor-pointer rounded"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-black">{pet.pet_nome}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Tutor: {pet.tutor_nome}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Step 2: Upload de Foto */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Foto do momento *</span>
                <div className="border-2 border-dashed border-slate-250 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-center hover:bg-purple-50/10 transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        alert('Apenas imagens nos formatos JPG, PNG ou WEBP são permitidas.');
                        return;
                      }
                      const maxSize = 5 * 1024 * 1024; // 5MB
                      if (file.size > maxSize) {
                        alert('O tamanho máximo da imagem é de 5MB.');
                        return;
                      }
                      setMomentFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setMomentFilePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  {momentFilePreview ? (
                    <div className="relative w-full flex flex-col items-center z-20">
                      <img src={momentFilePreview} alt="Preview do Momento" className="max-h-[140px] rounded-xl object-contain shadow-sm" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMomentFile(null);
                          setMomentFilePreview(null);
                        }}
                        className="mt-2 text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest cursor-pointer"
                      >
                        Remover Foto ✕
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1 py-2">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-slate-600">Clique ou arraste uma foto para enviar</p>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">Formatos: JPG, PNG, WEBP até 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Row: Date, Time & Responsible */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Data *</span>
                  <input
                    type="date"
                    value={momentDate}
                    onChange={(e) => setMomentDate(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-purple-300 bg-white text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Horário *</span>
                  <input
                    type="text"
                    placeholder="Ex: 14:00"
                    value={momentTime}
                    onChange={(e) => setMomentTime(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-purple-300 bg-white text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nome do Cuidador *</span>
                  <input
                    type="text"
                    required
                    placeholder="Nome do colaborador"
                    value={momentResponsavel}
                    onChange={(e) => setMomentResponsavel(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-purple-300 bg-white text-slate-700"
                  />
                </div>
              </div>

              {/* Caption/Message */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Legenda / Mensagem Carinhosa (Opcional)</span>
                <textarea
                  placeholder="Escreva uma legenda fofa para o tutor ver..."
                  value={momentLegenda}
                  onChange={(e) => setMomentLegenda(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-purple-300 min-h-[70px]"
                ></textarea>
              </div>

              {/* Visible to Tutor switch */}
              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-xs font-black text-slate-700 block">Visível para o tutor?</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Se "Sim", aparecerá imediatamente no perfil do tutor</span>
                </div>
                <div className="flex bg-white p-1 rounded-full border border-slate-150">
                  <button
                    type="button"
                    onClick={() => setMomentVisivelTutor(true)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                      momentVisivelTutor 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setMomentVisivelTutor(false)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                      !momentVisivelTutor 
                        ? 'bg-rose-500 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowMomentModal(false)}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95 animate-duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMomentExecution}
                disabled={savingMoment || momentSelectedPets.length === 0 || !momentFile || !momentResponsavel.trim()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {savingMoment ? 'Enviando...' : `Enviar para ${momentSelectedPets.length} cães`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MEDICATIONS PENDING (MEDICAÇÕES PROGRAMADAS DO DIA) */}
      {showMedicationsModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-lg rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-rose-950 leading-none">
                  {medsFilterPetId 
                    ? `Medicamentos de ${pets.find(x => x.id === medsFilterPetId)?.pet_nome || 'Pet'}` 
                    : 'Controle de Medicamento Diário'
                  }
                </h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {medsFilterPetId 
                    ? 'Remédios programados para este pet hoje' 
                    : `Rotinas de saúde e remédios na data ${searchDate}`
                  }
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowMedicationsModal(false);
                  setMedsFilterPetId(null);
                }}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3.5">
              {medications.filter(m => m.active && (!medsFilterPetId || m.petId === medsFilterPetId)).length === 0 ? (
                <p className="text-center text-slate-450 italic font-bold py-10 uppercase text-[11px] tracking-wide">
                  {medsFilterPetId 
                    ? 'Nenhum medicamento ativo programado para este pet hoje.' 
                    : 'Nenhum medicamento ativo programado no sistema.'
                  }
                </p>
              ) : (
                medications.filter(m => m.active && (!medsFilterPetId || m.petId === medsFilterPetId)).map(med => {
                  const p = pets.find(x => x.id === med.petId);
                  const isGivenToday = medicationLogs.some(log => log.medicationId === med.id && log.date === searchDate && log.offered);
                  
                  return (
                    <div key={med.id} className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-black text-[8px] uppercase">{med.time}</span>
                          <span className="text-xs font-black text-rose-950 uppercase">{med.name}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 mt-1">Dose: {med.dosage} • {med.instructions || 'Sem observações adicionais'}</p>
                        {p && <p className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Pet: {p.pet_nome}</p>}
                      </div>
                      
                      <div className="flex-shrink-0">
                        {isGivenToday ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-black text-[10px] border border-emerald-250 uppercase tracking-wider">
                            Dado ✅
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const newLog: MedicationLog = {
                                id: `MLOG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                medicationId: med.id,
                                petId: med.petId,
                                date: searchDate,
                                offered: true,
                                offeredBy: 'Admin',
                                notes: 'Aplicado pelo painel rápido'
                              };
                              handleSaveMedicationLog(newLog);
                              alert(`Sucesso! Medicação ${med.name} para ${p?.pet_nome || 'Pet'} marcada como aplicada.`);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
                          >
                            Dar Remédio
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              {medsFilterPetId && (
                <button
                  type="button"
                  onClick={() => setMedsFilterPetId(null)}
                  className="flex-1 py-3 bg-white text-slate-700 font-black border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs uppercase tracking-widest transition-all text-center cursor-pointer"
                >
                  Ver todos os remédios 📋
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowMedicationsModal(false);
                  navigate('/medicacao');
                }}
                className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all text-center cursor-pointer"
              >
                Cadastrar novos planos ⚙️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2.5: TUTOR CONTACT INFO */}
      {selectedTutorPet && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-md rounded-[36px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Ficha de Contato do Tutor</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Tutor de {selectedTutorPet.pet_nome}</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setSelectedTutorPet(null);
                  setCopiedTutorLink(false);
                }}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Pet Quick Info Row */}
              <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-white shadow-inner">
                  {selectedTutorPet.foto ? (
                    <img src={selectedTutorPet.foto} alt={selectedTutorPet.pet_nome} className="w-full h-full object-cover" />
                  ) : (
                    "🐶"
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">{selectedTutorPet.pet_nome}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{selectedTutorPet.raca || 'Mestiço'} • {selectedTutorPet.peso_pet}kg</p>
                  <p className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Escala: {selectedTutorPet.dia_semana}</p>
                </div>
              </div>

              {/* Tutor details */}
              <div className="space-y-3.5">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Tutor</span>
                  <div className="text-sm font-extrabold text-slate-850 bg-white border border-slate-150 rounded-xl px-4 py-3 shadow-sm flex items-center gap-2">
                    👤 {selectedTutorPet.tutor_nome || 'Não preenchido'}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Telefone / Contato</span>
                  <div className="text-sm font-extrabold text-slate-850 bg-white border border-slate-150 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                    <span>📞 {selectedTutorPet.telefone || 'Não cadastrado'}</span>
                    {selectedTutorPet.telefone && (
                      <a 
                        href={`tel:${selectedTutorPet.telefone.replace(/\D/g, '')}`}
                        className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition cursor-pointer"
                      >
                        Ligar
                      </a>
                    )}
                  </div>
                </div>

                {selectedTutorPet.telefone && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=${
                      (() => {
                        const clean = selectedTutorPet.telefone.replace(/\D/g, '');
                        return clean.startsWith('55') ? clean : '55' + clean;
                      })()
                    }`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    <span>💬 Conversar no WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Public Timeline Link Tracking Section */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Link de Acompanhamento do Tutor</span>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Ao Vivo 🟢</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/#/perfil-pet/${selectedTutorPet.tutorAccessToken || ''}`}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-150 rounded-xl text-[10px] font-mono text-slate-500 outline-none select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/#/perfil-pet/${selectedTutorPet.tutorAccessToken || ''}`);
                      setCopiedTutorLink(true);
                      setTimeout(() => setCopiedTutorLink(false), 2000);
                    }}
                    className={`px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                      copiedTutorLink 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-250' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    }`}
                  >
                    {copiedTutorLink ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 leading-normal">
                  Envie este link seguro para o tutor acompanhar o diário do pet de hoje em tempo real.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const id = selectedTutorPet.id;
                  setSelectedTutorPet(null);
                  setCopiedTutorLink(false);
                  navigate(`/pet/${id}?date=${searchDate}`);
                }}
                className="flex-1 py-3 bg-white text-indigo-600 font-black border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs uppercase tracking-widest transition-all text-center cursor-pointer"
              >
                Ver ficha completa 📋
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTutorPet(null);
                  setCopiedTutorLink(false);
                }}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-black hover:bg-slate-300 rounded-2xl text-xs uppercase tracking-widest transition-all text-center cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PENDING APPROVALS FROM TUTORS (CADASTROS DA FILA DE ENTRADA) */}
      {showApprovalsModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Revisão de Fichas Públicas</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Enviadas pelos tutores via Link Externo White-Label</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowApprovalsModal(false)}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {pendentes.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <p className="text-slate-450 italic font-bold uppercase text-[10px] tracking-wide">Fila vazia! Nenhuma ficha pendente de aprovação.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApprovalsModal(false);
                      navigate('/cadastro');
                    }}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold rounded-2xl text-[10px] uppercase shadow hover:bg-emerald-700"
                  >
                    Gerar link de captação de clientes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendentes.map((ped, idx) => (
                    <div key={ped.id || idx} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-[10px] font-black">🐾</span>
                          <span className="font-extrabold text-sm text-slate-800">{ped.pet_nome}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 font-black px-1.5 py-0.5 rounded uppercase">{ped.raca}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1.5 space-y-0.5">
                          <p>👤 <strong>Tutor:</strong> {ped.tutor_nome}</p>
                          <p>📞 <strong>WhatsApp:</strong> {ped.telefone}</p>
                          <p>📅 <strong>Dia:</strong> {ped.dia_semana}</p>
                          {ped.alimentos_proibidos && <p className="text-rose-600">⚠️ <strong>Alergias:</strong> {ped.alimentos_proibidos}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveForm(idx)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition active:scale-95 flex items-center gap-1"
                        >
                          Aprovar ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPending(ped);
                            setEditingPendingIndex(idx);
                          }}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition active:scale-95 flex items-center gap-1"
                        >
                          📝 Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectForm(idx)}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider border border-rose-100 transition active:scale-95 flex items-center gap-1"
                          title="Recusar"
                        >
                          🗑️ Recusar/Arquivar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalsModal(false);
                  navigate('/cadastro');
                }}
                className="w-full py-3 bg-white text-slate-800 font-black border border-slate-200 hover:bg-slate-100 rounded-2xl text-xs uppercase tracking-widest transition-all text-center"
              >
                Acessar Portal de Prontuários Principal 🧩
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TO DAY MODAL OVERLAY */}
      {isAddingToDay && (
        <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-emerald-50/30">
              <div>
                <h3 className="text-2xl font-black text-emerald-950 tracking-tight">Escalar para {selectedDay}</h3>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Selecione um cão cadastrado na matilha principal</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsAddingToDay(false);
                  setModalSearchTerm('');
                }} 
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-rose-55 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Digitar nome do pet para busca rápida..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-400 font-bold text-sm shadow-inner"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {petsNotInDay.length === 0 ? (
                <p className="text-center py-10 text-slate-350 font-bold italic text-xs uppercase tracking-wider">Todos os cães ativos já estão agendados no dia.</p>
              ) : (
                petsNotInDay.map(pet => (
                  <button 
                    key={pet.id}
                    type="button"
                    onClick={() => handleAddToDay(pet)}
                    className="w-full p-4 hover:bg-emerald-50 bg-white rounded-2xl flex items-center gap-4 transition-all text-left group border border-slate-100 shadow-sm"
                  >
                    <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-white transition-colors flex-shrink-0 shadow-inner overflow-hidden border border-slate-100">
                      {pet.foto ? (
                        <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        "🐶"
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 leading-none text-sm">{pet.pet_nome}</p>
                      {pet.tutor_nome && <p className="text-[9px] font-black text-emerald-600 uppercase mt-1 leading-none">{pet.tutor_nome}</p>}
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">{pet.id} • {pet.raca || 'Mestiço'}</p>
                    </div>
                    <span className="ml-auto opacity-0 group-hover:opacity-100 bg-[#085041] text-white px-2.5 py-1.5 rounded-lg transition-opacity font-black text-[9px] uppercase tracking-wider shadow-sm">
                      ESCALAR +
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING EDIT MODAL */}
      {editingPending && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-left">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Editar Pré-Cadastro</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ajuste os dados de {editingPending.pet_nome} antes de aprovar</p>
              </div>
              <button 
                type="button"
                onClick={() => { setEditingPending(null); setEditingPendingIndex(null); }}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-left">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Nome do Pet</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  value={editingPending.pet_nome}
                  onChange={(e) => setEditingPending({ ...editingPending, pet_nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Raça</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.raca}
                    onChange={(e) => setEditingPending({ ...editingPending, raca: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Aniversário / Idade</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.data_aniversario || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, data_aniversario: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Nome do Tutor</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.tutor_nome}
                    onChange={(e) => setEditingPending({ ...editingPending, tutor_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.telefone}
                    onChange={(e) => setEditingPending({ ...editingPending, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Escala de Dias da Semana</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  value={editingPending.dia_semana}
                  onChange={(e) => setEditingPending({ ...editingPending, dia_semana: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Possui Alergia?</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white"
                    value={editingPending.possui_alergia}
                    onChange={(e) => setEditingPending({ ...editingPending, possui_alergia: e.target.value })}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Alimentação</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white"
                    value={editingPending.tipo_alimentacao}
                    onChange={(e) => setEditingPending({ ...editingPending, tipo_alimentacao: e.target.value })}
                  >
                    <option value="Padrão">Padrão</option>
                    <option value="Especial">Especial</option>
                  </select>
                </div>
              </div>

              {editingPending.possui_alergia === 'Sim' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Detalhes da Alergia / Restrições</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none h-20"
                    value={editingPending.alimentos_proibidos || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, alimentos_proibidos: e.target.value })}
                  />
                </div>
              )}

              {editingPending.tipo_alimentacao === 'Especial' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Instruções de Alimentação Especial</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none h-20"
                    value={editingPending.quantidade_oferecida || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, quantidade_oferecida: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setEditingPending(null); setEditingPendingIndex(null); }}
                className="px-5 py-3 bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-55 rounded-xl text-xs uppercase tracking-wider transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSavePendingEdit(editingPending)}
                className="px-6 py-3 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-xl text-xs uppercase tracking-wider transition shadow-md"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
