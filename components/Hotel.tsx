import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pet, HotelStay, HotelRecord, HotelReport } from '../types';
import { useHotel } from '../src/hooks/useHotel';
import { usePets } from '../src/hooks/usePets';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Plus, Trash2, Heart, Shield, Check, Camera, Clipboard, Clock, 
  AlertTriangle, LogOut, CheckSquare, Search, ChevronRight, X, ExternalLink, 
  Send, FileText, User, Phone, ShoppingBag, Eye, RotateCcw, MessageSquare, ListTodo
} from 'lucide-react';

interface HotelProps {
  pets: Pet[];
  hotelStays?: any[]; // legacy compatibility
  medications?: any[]; // legacy compatibility
  medicationLogs?: any[]; // legacy compatibility
  onSaveStay?: any; // legacy compatibility
  onDeleteStay?: any; // legacy compatibility
  onSaveMedLog?: any; // legacy compatibility
  onSaveMedication?: any; // legacy compatibility
}

const ITEMS_OPTIONS = [
  'Ração',
  'Medicação',
  'Caminha',
  'Cobertor',
  'Guia/coleira',
  'Brinquedo',
  'Petiscos',
  'Pote',
  'Outros'
];

const Hotel: React.FC<HotelProps> = ({ pets: initialPets }) => {
  const navigate = useNavigate();
  const { pets, addPet } = usePets();
  const { 
    stays, records, reports, loading: hotelLoading, 
    addStay, updateStay, addRecord, deleteRecord, addReport, uploadPhoto 
  } = useHotel();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'hospedados' | 'historico'>('hospedados');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Dialog States
  const [isAddingStay, setIsAddingStay] = useState(false);
  const [isQuickAddingPet, setIsQuickAddingPet] = useState(false);
  const [isLoggingMeal, setIsLoggingMeal] = useState<HotelStay | null>(null);
  const [isLoggingMed, setIsLoggingMed] = useState<HotelStay | null>(null);
  const [isLoggingActivity, setIsLoggingActivity] = useState<HotelStay | null>(null);
  const [isLoggingPhoto, setIsLoggingPhoto] = useState<HotelStay | null>(null);
  const [isViewingStayRecords, setIsViewingStayRecords] = useState<HotelStay | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<HotelStay | null>(null);
  const [viewingReport, setViewingReport] = useState<HotelReport | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State - Quick Pet
  const [quickPet, setQuickPet] = useState({
    pet_nome: '',
    tutor_nome: '',
    telefone: '',
    possui_alergia: 'Não',
    alimentos_proibidos: '',
  });

  // Form State - Check-in (Add Stay)
  const [newStay, setNewStay] = useState({
    petId: '',
    checkInDate: new Date().toISOString().split('T')[0],
    expectedCheckOutDate: new Date().toISOString().split('T')[0],
    tutorInstructions: '',
    feedingTimesPerDay: 2,
    feedingSchedule: ['08:00', '18:00'],
    feedingNotes: '',
    medicationEnabled: false,
    medications: [] as Array<{ name: string; dosage: string; time: string; instructions: string }>,
    broughtItems: {} as Record<string, boolean>,
    broughtItemsPhotos: [] as string[],
  });

  // Inline medication inputs during check-in
  const [tempMed, setTempMed] = useState({ name: '', dosage: '', time: '08:00', instructions: '' });

  // Quick Action Input States
  const [mealForm, setMealForm] = useState({ slot: 0, status: 'Comeu tudo', responsible: '', notes: '' });
  const [medForm, setMedForm] = useState({ medIndex: 0, customName: '', dosage: '', responsible: '', notes: '' });
  const [activityForm, setActivityForm] = useState({ type: 'Recreação', responsible: '', notes: '', visibleToTutor: true });
  const [photoForm, setPhotoForm] = useState({ caption: '', visibleToTutor: true, uploading: false });
  const [checkoutItemsCheck, setCheckoutItemsCheck] = useState<Record<string, boolean>>({});
  const [checkoutReportText, setCheckoutReportText] = useState('');

  // Media upload state
  const [uploadingItemPhoto, setUploadingItemPhoto] = useState(false);
  const [uploadingPhotoFormFile, setUploadingPhotoFormFile] = useState(false);
  const [photoFormFileUrl, setPhotoFormFileUrl] = useState<string | null>(null);

  // Resolved Pets dictionary
  const petsMap = useMemo(() => {
    const map = new Map<string, Pet>();
    const allPets = [...pets, ...initialPets];
    allPets.forEach(p => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [pets, initialPets]);

  // Stays filter
  const activeStays = useMemo(() => {
    return stays.filter(s => s.status === 'ativa').map(stay => {
      const pet = petsMap.get(stay.petId);
      return { ...stay, pet };
    }).filter(item => {
      if (!searchQuery) return true;
      const name = item.pet?.pet_nome || '';
      const tutor = item.tutorNome || item.pet?.tutor_nome || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             tutor.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [stays, petsMap, searchQuery]);

  const historicalStays = useMemo(() => {
    return stays.filter(s => s.status === 'finalizada').map(stay => {
      const pet = petsMap.get(stay.petId);
      const report = reports.find(r => r.hotelStayId === stay.id);
      return { ...stay, pet, report };
    });
  }, [stays, petsMap, reports]);

  // Compute Missing/Pending Meals
  const pendingMealsByStay = useMemo(() => {
    const alerts: Record<string, string[]> = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const currentMin = new Date().getMinutes();

    stays.forEach(stay => {
      if (stay.status !== 'ativa') return;
      const sched = stay.feedingSchedule || [];
      if (sched.length === 0) return;

      const todayRecords = records.filter(r => 
        r.hotelStayId === stay.id && 
        r.type === 'feeding' && 
        r.date === todayStr
      );

      const missing: string[] = [];
      sched.forEach((time, idx) => {
        // Match record by slot index
        const fed = todayRecords.some(r => r.notes?.includes(`Slot #${idx + 1}`) || (r as any).slot === idx);
        if (!fed) {
          const [h, m] = time.split(':').map(Number);
          if (currentHour > h || (currentHour === h && currentMin >= m)) {
            const mealLabel = idx === 0 ? 'Café' : idx === 1 ? 'Almoço' : 'Jantar';
            missing.push(`${mealLabel} (${time})`);
          }
        }
      });
      if (missing.length > 0) {
        alerts[stay.id] = missing;
      }
    });

    return alerts;
  }, [stays, records]);

  // Handle Quick Pet Save
  const handleQuickPetSave = async () => {
    if (!quickPet.pet_nome || !quickPet.tutor_nome || !quickPet.telefone) {
      alert('Por favor, preencha o Nome do Pet, Tutor e Telefone.');
      return;
    }
    try {
      const newCreatedPet = await addPet({
        pet_nome: quickPet.pet_nome,
        peso_pet: '10',
        dia_semana: '-',
        comportamento_alimentar: 'Normal',
        precisa_estimulo: 'Não',
        tipo_alimentacao: 'Ração',
        quantidade_oferecida: '100g',
        quantidade_aproximada: '100g',
        marca_racao: '-',
        especificacao_racao: '-',
        oferece_extras: 'Não',
        ingestao_agua: 'Normal',
        interesse_agua: 'Normal',
        ajuda_beber_agua: 'Não',
        sede_pos_creche: 'Não',
        possui_alergia: quickPet.possui_alergia,
        alimentos_proibidos: quickPet.alimentos_proibidos,
        possui_doenca: 'Não',
        doenca_qual: '-',
        escore_corporal: 'Ideal',
        observacoes: 'Cadastrado rapidamente pelo Hotel',
        tutor_nome: quickPet.tutor_nome,
        telefone: quickPet.telefone,
        tutorAccessEnabled: true,
        tutorAccessToken: Math.random().toString(36).substring(2, 11).toUpperCase()
      });
      setNewStay(prev => ({ ...prev, petId: newCreatedPet.id }));
      setIsQuickAddingPet(false);
      setSuccessToast(`Pet ${quickPet.pet_nome} cadastrado com sucesso e selecionado no check-in!`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
      setQuickPet({ pet_nome: '', tutor_nome: '', telefone: '', possui_alergia: 'Não', alimentos_proibidos: '' });
    } catch (err) {
      alert('Erro ao cadastrar pet.');
    }
  };

  // Adjust Feeding times array length when changing count
  const handleFeedingCountChange = (count: number) => {
    let sched = ['08:00'];
    if (count === 2) sched = ['08:00', '18:00'];
    if (count === 3) sched = ['08:00', '13:00', '19:00'];
    setNewStay(prev => ({ ...prev, feedingTimesPerDay: count, feedingSchedule: sched }));
  };

  // Upload stay item photos
  const handleItemPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingItemPhoto(true);
    try {
      const file = e.target.files[0];
      const url = await uploadPhoto(file, 'hotel_items');
      setNewStay(prev => ({ ...prev, broughtItemsPhotos: [...prev.broughtItemsPhotos, url] }));
    } catch (err) {
      alert('Erro no upload.');
    } finally {
      setUploadingItemPhoto(false);
    }
  };

  // Check-in Confirmation
  const handleConfirmCheckIn = async () => {
    if (!newStay.petId) {
      alert('Por favor, selecione ou cadastre um pet.');
      return;
    }

    const selectedPetObj = petsMap.get(newStay.petId);
    const tNome = selectedPetObj?.tutor_nome || 'Tutor';
    const tTel = selectedPetObj?.telefone || '-';

    await addStay({
      petId: newStay.petId,
      tutorNome: tNome,
      tutorTelefone: tTel,
      checkInDate: newStay.checkInDate,
      expectedCheckOutDate: newStay.expectedCheckOutDate,
      checkIn: newStay.checkInDate,
      checkOut: newStay.expectedCheckOutDate,
      tutorInstructions: newStay.tutorInstructions,
      instructions: newStay.tutorInstructions,
      feedingTimesPerDay: newStay.feedingTimesPerDay,
      feedingSchedule: newStay.feedingSchedule,
      feedingNotes: newStay.feedingNotes,
      medicationEnabled: newStay.medicationEnabled,
      medications: newStay.medications,
      broughtItems: newStay.broughtItems,
      broughtItemsPhotos: newStay.broughtItemsPhotos,
      active: true
    });

    // Close form & reset
    setIsAddingStay(false);
    setSuccessToast(`Check-in de ${selectedPetObj?.pet_nome || 'Pet'} realizado com sucesso!`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
    setNewStay({
      petId: '',
      checkInDate: new Date().toISOString().split('T')[0],
      expectedCheckOutDate: new Date().toISOString().split('T')[0],
      tutorInstructions: '',
      feedingTimesPerDay: 2,
      feedingSchedule: ['08:00', '18:00'],
      feedingNotes: '',
      medicationEnabled: false,
      medications: [],
      broughtItems: {},
      broughtItemsPhotos: [],
    });
  };

  // Add temp medication to array during check-in
  const handleAddTempMed = () => {
    if (!tempMed.name || !tempMed.time) {
      alert('Insira nome e horário do remédio.');
      return;
    }
    setNewStay(prev => ({
      ...prev,
      medications: [...prev.medications, { ...tempMed }]
    }));
    setTempMed({ name: '', dosage: '', time: '08:00', instructions: '' });
  };

  // Quick Action - Meal Log Save
  const handleSaveMealLog = async () => {
    if (!isLoggingMeal) return;
    const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    await addRecord({
      hotelStayId: isLoggingMeal.id,
      petId: isLoggingMeal.petId,
      type: 'feeding',
      date: todayStr,
      time: timeNow,
      responsible: mealForm.responsible || 'Equipe',
      notes: `Slot #${mealForm.slot + 1} - Refeição ${mealForm.slot + 1}. Status: ${mealForm.status}. Obs: ${mealForm.notes || 'Sem observações.'}`,
      visibleToTutor: true
    });

    setIsLoggingMeal(null);
    setMealForm({ slot: 0, status: 'Comeu tudo', responsible: '', notes: '' });
  };

  // Quick Action - Medication Log Save
  const handleSaveMedLog = async () => {
    if (!isLoggingMed) return;
    const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    let medName = medForm.customName;
    let medDose = medForm.dosage;

    if (isLoggingMed.medications && isLoggingMed.medications[medForm.medIndex]) {
      const selectedM = isLoggingMed.medications[medForm.medIndex];
      medName = selectedM.name;
      medDose = selectedM.dosage;
    }

    if (!medName) {
      alert('Selecione ou escreva o nome da medicação.');
      return;
    }

    await addRecord({
      hotelStayId: isLoggingMed.id,
      petId: isLoggingMed.petId,
      type: 'medication',
      date: todayStr,
      time: timeNow,
      responsible: medForm.responsible || 'Equipe',
      notes: `Medicação Administrada: ${medName} (Dose: ${medDose || '-'}). Responsável: ${medForm.responsible || 'Equipe'}. Obs: ${medForm.notes || '-'}`,
      visibleToTutor: true
    });

    setIsLoggingMed(null);
    setMedForm({ medIndex: 0, customName: '', dosage: '', responsible: '', notes: '' });
  };

  // Quick Action - Activity Log Save
  const handleSaveActivityLog = async () => {
    if (!isLoggingActivity) return;
    const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    await addRecord({
      hotelStayId: isLoggingActivity.id,
      petId: isLoggingActivity.petId,
      type: 'activity',
      date: todayStr,
      time: timeNow,
      responsible: activityForm.responsible || 'Equipe',
      notes: `Atividade de ${activityForm.type}. Obs: ${activityForm.notes}`,
      visibleToTutor: activityForm.visibleToTutor
    });

    setIsLoggingActivity(null);
    setActivityForm({ type: 'Recreação', responsible: '', notes: '', visibleToTutor: true });
  };

  // Photo Log Upload File helper
  const handlePhotoFormFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingPhotoFormFile(true);
    try {
      const url = await uploadPhoto(e.target.files[0], 'hotel_moments');
      setPhotoFormFileUrl(url);
    } catch (err) {
      alert('Erro no upload.');
    } finally {
      setUploadingPhotoFormFile(false);
    }
  };

  // Quick Action - Photo Log Save
  const handleSavePhotoLog = async () => {
    if (!isLoggingPhoto || !photoFormFileUrl) {
      alert('Por favor, carregue uma foto.');
      return;
    }
    const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    await addRecord({
      hotelStayId: isLoggingPhoto.id,
      petId: isLoggingPhoto.petId,
      type: 'photo',
      date: todayStr,
      time: timeNow,
      responsible: 'Equipe',
      notes: photoForm.caption || 'Registro fotográfico da hospedagem!',
      photoUrl: photoFormFileUrl,
      visibleToTutor: photoForm.visibleToTutor
    });

    setIsLoggingPhoto(null);
    setPhotoFormFileUrl(null);
    setPhotoForm({ caption: '', visibleToTutor: true, uploading: false });
  };

  // Checkout Phase 1 - Open Modal and Compute Default Warm Text
  const handleStartCheckout = (stay: HotelStay) => {
    setIsCheckingOut(stay);

    // Initialize return checks as false
    const initialChecks: Record<string, boolean> = {};
    if (stay.broughtItems) {
      Object.keys(stay.broughtItems).forEach(item => {
        if (stay.broughtItems?.[item]) {
          initialChecks[item] = false;
        }
      });
    }
    setCheckoutItemsCheck(initialChecks);

    // Generate personalized warm checkout bulletin text based on records
    const pName = petsMap.get(stay.petId)?.pet_nome || 'o pet';
    const stayRecords = records.filter(r => r.hotelStayId === stay.id);
    const feedCount = stayRecords.filter(r => r.type === 'feeding').length;
    const medCount = stayRecords.filter(r => r.type === 'medication').length;
    const playCount = stayRecords.filter(r => r.type === 'activity').length;

    // Strict Rule: No generic statements like "esperamos que se sinta seguro" or "prioridade é a transparência"
    // Human-written concrete logs summary
    let detailsText = `${pName} concluiu com sucesso sua hospedagem no nosso hotel! `;
    detailsText += `Durante a estadia, realizamos o controle operacional completo:\n`;
    detailsText += `- Alimentação: Foram servidas e registradas ${feedCount} refeições programadas com sucesso.\n`;
    if (stay.medicationEnabled) {
      detailsText += `- Cuidados Médicos: Administramos ${medCount} dosagens de medicamentos conforme as recomendações do tutor.\n`;
    }
    detailsText += `- Atividades recreativas: Participou de ${playCount} sessões de enriquecimento ambiental e integração com os companheiros de matilha, mantendo excelente gasto de energia e descanso de qualidade no hotel.\n`;
    detailsText += `Tudo ocorreu perfeitamente e os pertences já foram revisados no check-out.`;

    setCheckoutReportText(detailsText);
  };

  // Finalize Checkout
  const handleConfirmCheckout = async () => {
    if (!isCheckingOut) return;

    // Check if items checklist are fully returned
    const unreturned = Object.keys(checkoutItemsCheck).filter(k => !checkoutItemsCheck[k]);
    if (unreturned.length > 0) {
      const confirmForce = confirm(`Atenção: Os seguintes pertences ainda não foram marcados como devolvidos: ${unreturned.join(', ')}. Deseja prosseguir com o check-out mesmo assim?`);
      if (!confirmForce) return;
    }

    const pObj = petsMap.get(isCheckingOut.petId);
    const pName = pObj?.pet_nome || 'Pet';
    const cName = localStorage.getItem('domo_nome') || 'Hotel Domo Pet';

    const stayRecords = records.filter(r => r.hotelStayId === isCheckingOut.id);
    const feedCount = stayRecords.filter(r => r.type === 'feeding').length;
    const medCount = stayRecords.filter(r => r.type === 'medication').length;
    const playCount = stayRecords.filter(r => r.type === 'activity').length;
    const restCount = stayRecords.filter(r => r.type === 'rest').length;

    // 1. Create Report
    await addReport({
      hotelStayId: isCheckingOut.id,
      petId: isCheckingOut.petId,
      crecheName: cName,
      petName: pName,
      reportText: checkoutReportText,
      summary: {
        mealsCount: feedCount,
        medsCount: medCount,
        activitiesCount: playCount,
        restsCount: restCount
      },
      photos: isCheckingOut.broughtItemsPhotos || []
    });

    // 2. Finalize Stay Status
    await updateStay(isCheckingOut.id, {
      status: 'finalizada',
      active: false,
      realCheckOutDate: new Date().toISOString().split('T')[0],
      finishedAt: new Date().toISOString()
    });

    setIsCheckingOut(null);
    setCheckoutItemsCheck({});
    setCheckoutReportText('');
    setSuccessToast('Hospedagem encerrada e boletim gerado com sucesso!');
    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // Helper to share bulletin report on WhatsApp
  const shareReportWhatsApp = (report: HotelReport, tutorPhone: string) => {
    const text = `*BOLETIM DE HOSPEDAGEM - ${report.petName.toUpperCase()}*\n\n${report.reportText}\n\nEnviado com carinho por *${report.crecheName}* 🐾`;
    const cleanPhone = tutorPhone ? tutorPhone.replace(/\D/g, '') : '';
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Helper to get public tutor URL
  const copyTutorLink = (pet: Pet) => {
    if (!pet || !pet.tutorAccessToken) {
      alert('Acesso do tutor não configurado para este pet.');
      return;
    }
    const url = `${window.location.origin}/#/perfil-pet/${pet.tutorAccessToken}?petId=${pet.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setSuccessToast('Link do tutor copiado com sucesso!');
      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    }).catch(() => {
      alert('Não foi possível copiar automaticamente. Use: ' + url);
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Toast de Sucesso customizado */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-[#085041] border border-emerald-500/20 text-white rounded-[24px] shadow-2xl font-bold text-sm min-w-[300px] max-w-md"
          >
            <span className="text-xl">✅</span>
            <div className="flex-1 text-left font-black">{successToast}</div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-white/60 hover:text-white ml-2 text-xs font-black cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-indigo-50 shadow-sm">
        <div className="text-left">
          <h2 className="text-4xl font-black text-indigo-950 tracking-tighter flex items-center gap-2">
            <span>🏨</span> Módulo Hotel
          </h2>
          <p className="text-indigo-600/70 font-bold text-xs uppercase tracking-[0.2em] mt-1">
            Hospedagem Canina, Registros Diários e Boletins Integrados
          </p>
        </div>

        {/* CONTROLES E ABAS */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Navegação de Abas */}
          <div className="bg-slate-100 p-1 rounded-full flex border border-slate-200">
            <button
              onClick={() => setActiveTab('hospedados')}
              className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === 'hospedados' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hospedados Agora ({activeStays.length})
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === 'historico' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Histórico / Arquivado
            </button>
          </div>

          <button 
            onClick={() => setIsAddingStay(true)}
            className="bg-emerald-600 text-white px-8 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Plus size={14} className="stroke-[3]" /> Hospedar pet
          </button>
        </div>
      </div>

      {/* ÁREA DE BUSCA */}
      {activeTab === 'hospedados' && (
        <div className="bg-white p-4 rounded-3xl border border-indigo-50 shadow-sm flex items-center gap-3">
          <Search size={18} className="text-slate-400 shrink-0 ml-2" />
          <input
            type="text"
            placeholder="Buscar por nome do pet ou tutor hospedado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none font-bold text-sm text-slate-700 placeholder-slate-450"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-slate-100 rounded-full">
              <X size={16} className="text-slate-500" />
            </button>
          )}
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      {hotelLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin text-4xl mb-4">🐾</div>
          <p className="font-bold text-indigo-900/60 uppercase text-[10px] tracking-widest animate-pulse">
            Carregando estadias do banco de dados...
          </p>
        </div>
      ) : activeTab === 'hospedados' ? (
        
        /* GRID DE CARD DE HOSPEDADOS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
          {activeStays.length === 0 ? (
            <div className="col-span-full py-28 bg-white rounded-[40px] border-4 border-dashed border-indigo-50 flex flex-col items-center justify-center opacity-40">
              <span className="text-7xl mb-4">🏨</span>
              <p className="font-black uppercase tracking-[0.3em] text-xs text-indigo-950">Nenhum pet correspondente hospedado</p>
            </div>
          ) : (
            activeStays.map(stay => {
              const petAlerts = pendingMealsByStay[stay.id] || [];
              return (
                <div 
                  key={stay.id} 
                  id={`hotel-stay-${stay.id}`}
                  className="bg-white rounded-[40px] border border-indigo-50 shadow-md hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden relative min-w-[360px] md:min-w-[400px]"
                >
                  
                  {/* ALERTA DE ALIMENTAÇÃO INTEGRADO */}
                  {petAlerts.length > 0 && (
                    <div className="absolute top-4 right-4 bg-amber-500 text-white px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md z-10 animate-pulse border border-white/20">
                      <AlertTriangle size={12} className="stroke-[3]" />
                      <span>{petAlerts[0]} pendente</span>
                    </div>
                  )}

                  <div className="p-8 space-y-6">
                    
                    {/* CABEÇALHO DO CARD - IDENTIDADE */}
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 bg-indigo-50 rounded-[24px] flex items-center justify-center text-4xl border-2 border-indigo-100/50 overflow-hidden shrink-0 shadow-inner">
                        {stay.pet?.foto ? (
                          <img src={stay.pet.foto} alt={stay.pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>🐶</span>
                        )}
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                            🏨 HOTEL
                          </span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-extrabold text-indigo-950 tracking-tight truncate leading-none">
                          {stay.pet?.pet_nome || 'Sem Nome'}
                        </h3>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-500 truncate leading-none">
                            👤 {stay.tutorNome || stay.pet?.tutor_nome || '-'}
                          </p>
                          <p className="text-[10px] font-extrabold text-slate-400 tracking-wide leading-none">
                            📱 {stay.tutorTelefone || stay.pet?.telefone || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DATAS DA HOSPEDAGEM */}
                    <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/40 text-left">
                      <div>
                        <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Check-in</span>
                        <span className="text-xs font-bold text-indigo-900">
                          📅 {stay.checkInDate ? new Date(stay.checkInDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Saída Prevista</span>
                        <span className="text-xs font-bold text-indigo-900">
                          🏁 {stay.expectedCheckOutDate ? new Date(stay.expectedCheckOutDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                    </div>

                    {/* INSTRUÇÕES DO TUTOR COMPLETA */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">RECOMENDAÇÕES IMPORTANTES</span>
                      <p className="text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed italic line-clamp-2">
                        "{stay.tutorInstructions || 'Sem recomendações especiais registradas.'}"
                      </p>
                    </div>

                    {/* ALIMENTAÇÃO RÁPIDA VISÍVEL NO CARD */}
                    <div className="space-y-2 text-left pt-2 border-t border-slate-100">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <span>🥣</span> ALIMENTAÇÃO ATIVA ({stay.feedingTimesPerDay}x ao dia)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {stay.feedingSchedule?.map((time, sIdx) => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const fed = records.some(r => 
                            r.hotelStayId === stay.id && 
                            r.type === 'feeding' && 
                            r.date === todayStr &&
                            (r.notes?.includes(`Slot #${sIdx + 1}`) || (r as any).slot === sIdx)
                          );
                          return (
                            <button
                              key={sIdx}
                              onClick={() => {
                                setMealForm(prev => ({ ...prev, slot: sIdx }));
                                setIsLoggingMeal(stay);
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[10px] transition-all flex items-center gap-1 uppercase border shrink-0 ${
                                fed 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-sm'
                              }`}
                            >
                              <span>{fed ? '✓' : '⏰'}</span> {time}
                            </button>
                          );
                        })}
                      </div>
                      {stay.feedingNotes && (
                        <p className="text-[10px] text-slate-500 font-bold leading-tight">Nota: {stay.feedingNotes}</p>
                      )}
                    </div>

                    {/* STATUS DE MEDICAÇÃO ATIVA */}
                    {stay.medicationEnabled && (
                      <div className="space-y-2 text-left pt-2 border-t border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <span>💊</span> REMÉDIOS PROGRAMADOS
                        </span>
                        <div className="space-y-1">
                          {stay.medications?.map((m, mIdx) => (
                            <div key={mIdx} className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-700 flex justify-between items-center">
                              <span>💊 {m.name} ({m.dosage}) às {m.time}</span>
                              <button 
                                onClick={() => {
                                  setMedForm(prev => ({ ...prev, medIndex: mIdx }));
                                  setIsLoggingMed(stay);
                                }}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors rounded font-black text-[8px] uppercase tracking-wider"
                              >
                                Dar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO DE BOTÕES PRINCIPAIS VISÍVEIS E AMPLOS */}
                  <div className="bg-slate-50 p-6 border-t border-slate-150 rounded-b-[40px] space-y-3 mt-auto">
                    
                    {/* Botões operacionais rápidos em Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setIsLoggingActivity(stay)}
                        className="py-3 bg-white border border-slate-200 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        🎾 Ativ.
                      </button>
                      <button
                        onClick={() => setIsLoggingMed(stay)}
                        className="py-3 bg-white border border-slate-200 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        💊 Med.
                      </button>
                      <button
                        onClick={() => setIsLoggingPhoto(stay)}
                        className="py-3 bg-white border border-slate-200 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        📸 Foto
                      </button>
                      <button
                        onClick={() => copyTutorLink(stay.pet!)}
                        className="py-3 bg-white border border-slate-200 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        👤 Tutor
                      </button>
                    </div>

                    {/* Botões de controle de estadia e encerramento */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsViewingStayRecords(stay)}
                        className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1 border border-indigo-100"
                      >
                        <ListTodo size={12} /> Acompanhar
                      </button>
                      <button
                        onClick={() => handleStartCheckout(stay)}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1 shadow-md shadow-rose-600/10"
                      >
                        <LogOut size={12} /> Finalizar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        
        /* LISTA DE HISTÓRICO DE ESTADIAS ARQUIVADAS */
        <div className="bg-white p-8 rounded-[40px] border border-indigo-50 shadow-sm text-left">
          <div className="mb-6">
            <h3 className="text-xl font-extrabold text-indigo-950">Estadias Finalizadas</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Hospedagens concluídas e boletins arquivados permanentemente.</p>
          </div>

          <div className="space-y-4">
            {historicalStays.length === 0 ? (
              <p className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                Nenhum registro de hospedagem finalizada encontrado.
              </p>
            ) : (
              historicalStays.map(stay => (
                <div key={stay.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl border border-slate-200 overflow-hidden shrink-0">
                      {stay.pet?.foto ? (
                        <img src={stay.pet.foto} alt={stay.pet?.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>🐶</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-slate-800 leading-tight">{stay.pet?.pet_nome || 'Pet'}</h4>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 font-semibold mt-1">
                        <span>👤 Tutor: {stay.tutorNome || stay.pet?.tutor_nome || '-'}</span>
                        <span>•</span>
                        <span>📅 Período: {stay.checkInDate ? new Date(stay.checkInDate + 'T12:00:00').toLocaleDateString() : '-'} a {stay.realCheckOutDate ? new Date(stay.realCheckOutDate + 'T12:00:00').toLocaleDateString() : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {stay.report ? (
                      <button
                        onClick={() => setViewingReport(stay.report)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all flex items-center gap-1"
                      >
                        <FileText size={12} /> Ver Boletim
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic py-2">Sem boletim</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: CHECK-IN / REGISTRAR HOSPEDAGEM */}
      <AnimatePresence>
        {isAddingStay && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[40px] border-2 border-indigo-100 shadow-2xl max-w-3xl w-full p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setIsAddingStay(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} className="stroke-[3]" />
              </button>

              <div className="text-left">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">NOVA HOSPEDAGEM</span>
                <h3 className="text-3xl font-black text-indigo-950 tracking-tight">Check-in de Hospedagem</h3>
              </div>

              <div className="space-y-6">
                
                {/* LINHA 1: PET SELECT + BOTÃO QUICK CADASTRO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">PET HOSPEDADO</label>
                    <div className="flex gap-2">
                      <select 
                        value={newStay.petId}
                        onChange={(e) => setNewStay(prev => ({ ...prev, petId: e.target.value }))}
                        className="w-full p-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl font-bold outline-none focus:border-indigo-300 transition-all text-sm"
                      >
                        <option value="">Selecionar pet...</option>
                        {pets.map(p => (
                          <option key={p.id} value={p.id}>{p.pet_nome}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setIsQuickAddingPet(true)}
                        className="px-4 bg-indigo-50 border-2 border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                      >
                        + Novo
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">DATA ENTRADA</label>
                      <input 
                        type="date"
                        value={newStay.checkInDate}
                        onChange={(e) => setNewStay(prev => ({ ...prev, checkInDate: e.target.value }))}
                        className="w-full p-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl font-bold outline-none focus:border-indigo-300 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">SAÍDA PREVISTA</label>
                      <input 
                        type="date"
                        value={newStay.expectedCheckOutDate}
                        onChange={(e) => setNewStay(prev => ({ ...prev, expectedCheckOutDate: e.target.value }))}
                        className="w-full p-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl font-bold outline-none focus:border-indigo-300 transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* LINHA 2: RECOMENDAÇÕES DO TUTOR */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">INSTRUÇÕES DO TUTOR</label>
                  <textarea
                    value={newStay.tutorInstructions}
                    onChange={(e) => setNewStay(prev => ({ ...prev, tutorInstructions: e.target.value }))}
                    placeholder="Instruções gerais, comportamento, convívio ou cuidados que a equipe precisa saber..."
                    className="w-full p-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl font-semibold text-sm outline-none focus:border-indigo-300 transition-all h-24 resize-none"
                  />
                </div>

                {/* SEÇÃO: CONFIGURAÇÕES DE ALIMENTAÇÃO */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-150 space-y-4 text-left">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1">
                    <span>🥣</span> Ficha Alimentar do Hotel
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">QUANTAS VEZES COME AO DIA?</label>
                      <div className="flex gap-2">
                        {[1, 2, 3].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handleFeedingCountChange(v)}
                            className={`flex-1 py-2.5 font-black text-xs rounded-xl transition-all ${
                              newStay.feedingTimesPerDay === v 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-250 hover:bg-slate-100'
                            }`}
                          >
                            {v}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left block">HORÁRIOS SELECIONADOS</label>
                      <div className="flex gap-2">
                        {newStay.feedingSchedule.map((time, idx) => (
                          <div key={idx} className="flex-1 flex flex-col">
                            <span className="text-[8px] font-bold text-slate-400 mb-1">Ref. {idx + 1}</span>
                            <input
                              type="time"
                              value={time}
                              onChange={(e) => {
                                const sched = [...newStay.feedingSchedule];
                                sched[idx] = e.target.value;
                                setNewStay(prev => ({ ...prev, feedingSchedule: sched }));
                              }}
                              className="p-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OBSERVAÇÕES ALIMENTARES</label>
                    <input
                      type="text"
                      placeholder="Ex: Oferecer sachê misturado na ração, deixar a ração disponível..."
                      value={newStay.feedingNotes}
                      onChange={(e) => setNewStay(prev => ({ ...prev, feedingNotes: e.target.value }))}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-xs outline-none"
                    />
                  </div>
                </div>

                {/* SEÇÃO: CONTROLE DE MEDICAÇÃO */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-150 space-y-4 text-left">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="text-sm font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1">
                      <span>💊</span> Cuidados de Medicação
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={newStay.medicationEnabled}
                        onChange={(e) => setNewStay(prev => ({ ...prev, medicationEnabled: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                      />
                      <span className="text-sm font-black text-slate-600 uppercase tracking-widest">Habilitar Medicações</span>
                    </label>
                  </div>

                  {newStay.medicationEnabled && (
                    <div className="space-y-4">
                      
                      {/* Formulário Inline de adição de medicação */}
                      <div className="bg-white p-5 rounded-2xl border-2 border-indigo-50 space-y-4 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Remédio</span>
                            <input
                              type="text"
                              placeholder="Nome do remédio"
                              value={tempMed.name}
                              onChange={(e) => setTempMed(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dosagem</span>
                            <input
                              type="text"
                              placeholder="Dosagem (ex: 1 comp)"
                              value={tempMed.dosage}
                              onChange={(e) => setTempMed(prev => ({ ...prev, dosage: e.target.value }))}
                              className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horário</span>
                            <input
                              type="time"
                              value={tempMed.time}
                              onChange={(e) => setTempMed(prev => ({ ...prev, time: e.target.value }))}
                              className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações</span>
                            <input
                              type="text"
                              placeholder="Recomendações / Instruções"
                              value={tempMed.instructions}
                              onChange={(e) => setTempMed(prev => ({ ...prev, instructions: e.target.value }))}
                              className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-colors"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddTempMed}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-[0.99] border-0"
                        >
                          + Adicionar remédio na estadia
                        </button>
                      </div>

                      {/* Lista de remédios inseridos */}
                      {newStay.medications.length > 0 ? (
                        <div className="space-y-2">
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remédios Programados</span>
                          {newStay.medications.map((m, idx) => (
                            <div key={idx} className="bg-indigo-50/40 p-4 rounded-xl border-2 border-indigo-100/50 text-sm font-bold text-indigo-950 flex justify-between items-center gap-4">
                              <span className="flex items-center gap-2">
                                <span>💊</span> 
                                <span><strong>{m.name}</strong> - {m.dosage} às <strong>{m.time}</strong> <span className="text-indigo-600/80 font-semibold">({m.instructions || 'Sem obs.'})</span></span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setNewStay(prev => ({
                                  ...prev,
                                  medications: prev.medications.filter((_, i) => i !== idx)
                                }))}
                                className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider text-center py-2">Nenhum remédio adicionado ainda</p>
                      )}
                    </div>
                  )}
                </div>

                {/* SEÇÃO: ITENS TRAZIDOS PELO TUTOR */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-150 space-y-4 text-left">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1">
                    <span>🎒</span> Pertences e Itens Trazidos no Check-in
                  </h4>

                  {/* Checklist de itens */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ITEMS_OPTIONS.map(item => {
                      const hasItem = newStay.broughtItems[item] || false;
                      return (
                        <label key={item} className="flex items-center gap-2.5 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-600">
                          <input
                            type="checkbox"
                            checked={hasItem}
                            onChange={(e) => {
                              const bItems = { ...newStay.broughtItems };
                              bItems[item] = e.target.checked;
                              setNewStay(prev => ({ ...prev, broughtItems: bItems }));
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Upload de fotos de pertences */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fotos dos Pertences</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-600 flex items-center gap-1.5 shadow-sm transition-colors shrink-0">
                        <Camera size={14} />
                        <span>Carregar Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleItemPhotoFile}
                          className="hidden"
                          disabled={uploadingItemPhoto}
                        />
                      </label>
                      {uploadingItemPhoto && (
                        <span className="text-[10px] font-black text-indigo-600 animate-pulse">Enviando foto...</span>
                      )}
                    </div>

                    {newStay.broughtItemsPhotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {newStay.broughtItemsPhotos.map((url, idx) => (
                          <div key={idx} className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden relative group">
                            <img src={url} alt="Item" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={() => setNewStay(prev => ({
                                ...prev,
                                broughtItemsPhotos: prev.broughtItemsPhotos.filter((_, i) => i !== idx)
                              }))}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-150"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BOTÕES DE CONFIRMAÇÃO DO CHECK-IN */}
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingStay(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black uppercase text-xs tracking-widest rounded-2xl transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCheckIn}
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-600/20 rounded-2xl transition-all"
                >
                  CONCLUIR CHECK-IN DO PET 🐾
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CADASTRO RÁPIDO DE NOVO PET INLINE */}
      <AnimatePresence>
        {isQuickAddingPet && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[35px] border-2 border-indigo-100 shadow-2xl max-w-md w-full p-6 space-y-4 relative"
            >
              <button 
                onClick={() => setIsQuickAddingPet(false)}
                className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X size={18} />
              </button>

              <div className="text-left">
                <h4 className="text-lg font-black text-indigo-950">Novo Pet Rápido</h4>
                <p className="text-xs text-slate-500">Cadastre o pet no sistema de forma simplificada</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">NOME DO PET *</label>
                  <input
                    type="text"
                    placeholder="Ex: Totó"
                    value={quickPet.pet_nome}
                    onChange={(e) => setQuickPet(prev => ({ ...prev, pet_nome: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">TUTOR RESPONSÁVEL *</label>
                  <input
                    type="text"
                    placeholder="Nome completo do tutor"
                    value={quickPet.tutor_nome}
                    onChange={(e) => setQuickPet(prev => ({ ...prev, tutor_nome: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">TELEFONE TUTOR *</label>
                  <input
                    type="text"
                    placeholder="WhatsApp do tutor"
                    value={quickPet.telefone}
                    onChange={(e) => setQuickPet(prev => ({ ...prev, telefone: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs focus:border-indigo-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">POSSUI ALERGIA?</label>
                  <select
                    value={quickPet.possui_alergia}
                    onChange={(e) => setQuickPet(prev => ({ ...prev, possui_alergia: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs bg-transparent"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>

                {quickPet.possui_alergia === 'Sim' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">ALIMENTOS / PROIBIDOS *</label>
                    <input
                      type="text"
                      placeholder="Qual a alergia?"
                      value={quickPet.alimentos_proibidos}
                      onChange={(e) => setQuickPet(prev => ({ ...prev, alimentos_proibidos: e.target.value }))}
                      className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs focus:border-indigo-300"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddingPet(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleQuickPetSave}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md"
                >
                  Criar Pet 🐾
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REGISTRAR ALIMENTAÇÃO / REFEIÇÃO */}
      <AnimatePresence>
        {isLoggingMeal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[35px] border border-indigo-50 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="text-left">
                <h4 className="text-xl font-black text-indigo-950">Registrar Refeição</h4>
                <p className="text-xs text-slate-500">Log de alimentação de {petsMap.get(isLoggingMeal.petId)?.pet_nome}</p>
              </div>

              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SELECIONE A REFEIÇÃO</label>
                  <select
                    value={mealForm.slot}
                    onChange={(e) => setMealForm(prev => ({ ...prev, slot: Number(e.target.value) }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs bg-transparent"
                  >
                    {isLoggingMeal.feedingSchedule?.map((time, idx) => {
                      const total = isLoggingMeal.feedingSchedule?.length || 0;
                      let label = `Refeição ${idx + 1} (${time})`;
                      if (total === 1) {
                        label = `Refeição Única (${time})`;
                      } else if (total === 2) {
                        label = idx === 0 ? `Café da Manhã (${time})` : `Jantar (${time})`;
                      } else if (total === 3) {
                        label = idx === 0 ? `Café da Manhã (${time})` : idx === 1 ? `Almoço (${time})` : `Jantar (${time})`;
                      }
                      return <option key={idx} value={idx}>{label}</option>;
                    })}
                  </select>
                  <p className="text-[10px] text-indigo-650 bg-indigo-50/50 p-2.5 rounded-xl font-semibold leading-relaxed mt-1">
                    ⚠️ Este pet está configurado com <strong>{isLoggingMeal.feedingSchedule?.length || 0} refeições ao dia</strong>. Apenas os horários oficiais estão disponíveis para lançamento, evitando erros (como oferecer almoço por engano)!
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">QUANTIDADE CONSUMIDA</label>
                  <select
                    value={mealForm.status}
                    onChange={(e) => setMealForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs bg-transparent"
                  >
                    <option value="Comeu tudo">Comeu tudo</option>
                    <option value="Comeu metade">Comeu metade</option>
                    <option value="Comeu pouco">Comeu menos da metade</option>
                    <option value="Recusou">Não comeu / Recusou</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">NOME DO CUIDADOR</label>
                  <input
                    type="text"
                    placeholder="Quem ofereceu a ração?"
                    value={mealForm.responsible}
                    onChange={(e) => setMealForm(prev => ({ ...prev, responsible: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OBSERVAÇÕES</label>
                  <input
                    type="text"
                    placeholder="Alguma reação ou comportamento alimentar?"
                    value={mealForm.notes}
                    onChange={(e) => setMealForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsLoggingMeal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMealLog}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-indigo-600/10"
                >
                  Confirmar Refeição ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REGISTRAR MEDICAÇÃO */}
      <AnimatePresence>
        {isLoggingMed && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] border-2 border-indigo-100 shadow-2xl max-w-lg w-full p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setIsLoggingMed(null)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} className="stroke-[3]" />
              </button>

              <div className="text-left">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">REGISTRO DE SAÚDE</span>
                <h4 className="text-2xl font-black text-indigo-950 tracking-tight">Registrar Medicação</h4>
                <p className="text-sm text-slate-500 font-bold mt-1">Log de remédio administrado de {petsMap.get(isLoggingMed.petId)?.pet_nome}</p>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-450 uppercase tracking-widest ml-1">SELECIONE A MEDICAÇÃO *</label>
                  <select
                    value={medForm.medIndex}
                    onChange={(e) => setMedForm(prev => ({ ...prev, medIndex: Number(e.target.value) }))}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-extrabold text-sm bg-transparent focus:border-indigo-400 outline-none transition-colors"
                  >
                    {isLoggingMed.medications?.map((m, idx) => (
                      <option key={idx} value={idx}>{m.name} ({m.dosage}) às {m.time}</option>
                    ))}
                    <option value={-1}>-- Outro remédio não programado --</option>
                  </select>
                </div>

                {medForm.medIndex === -1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-amber-50/50 rounded-2xl border-2 border-amber-100/50">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-450 uppercase tracking-widest ml-1">NOME DO REMÉDIO *</label>
                      <input
                        type="text"
                        placeholder="Ex: Ibuprofeno"
                        value={medForm.customName}
                        onChange={(e) => setMedForm(prev => ({ ...prev, customName: e.target.value }))}
                        className="w-full p-3.5 border-2 border-slate-200 bg-white rounded-xl font-bold text-sm focus:border-indigo-400 outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-450 uppercase tracking-widest ml-1">DOSAGEM *</label>
                      <input
                        type="text"
                        placeholder="Ex: 5ml"
                        value={medForm.dosage}
                        onChange={(e) => setMedForm(prev => ({ ...prev, dosage: e.target.value }))}
                        className="w-full p-3.5 border-2 border-slate-200 bg-white rounded-xl font-bold text-sm focus:border-indigo-400 outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-450 uppercase tracking-widest ml-1">NOME DO CUIDADOR *</label>
                  <input
                    type="text"
                    placeholder="Quem aplicou a dose?"
                    value={medForm.responsible}
                    onChange={(e) => setMedForm(prev => ({ ...prev, responsible: e.target.value }))}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold text-sm focus:border-indigo-400 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-450 uppercase tracking-widest ml-1">OBSERVAÇÕES / REAÇÃO DO PET</label>
                  <textarea
                    placeholder="Ex: Tomou junto com patê sem problemas..."
                    value={medForm.notes}
                    onChange={(e) => setMedForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-semibold text-sm focus:border-indigo-400 outline-none transition-colors h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoggingMed(null)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveMedLog}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all border-0"
                >
                  Registrar Dose ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REGISTRAR ATIVIDADE */}
      <AnimatePresence>
        {isLoggingActivity && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[35px] border border-indigo-50 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="text-left">
                <h4 className="text-xl font-black text-indigo-950">Registrar Atividade</h4>
                <p className="text-xs text-slate-500">Log de rotina / enriquecimento de {petsMap.get(isLoggingActivity.petId)?.pet_nome}</p>
              </div>

              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TIPO DE ATIVIDADE</label>
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs bg-transparent"
                  >
                    <option value="Recreação">Recreação na Matilha</option>
                    <option value="Enriquecimento Ambiental">Enriquecimento Ambiental</option>
                    <option value="Adestramento de rotina">Adestramento / Comandos de rotina</option>
                    <option value="Cochilo e Repouso">Tempo de Repouso e Sono</option>
                    <option value="Comportamento Geral">Comportamento Geral / Relato</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CUIDADOR RESPONSÁVEL</label>
                  <input
                    type="text"
                    placeholder="Nome do monitor"
                    value={activityForm.responsible}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, responsible: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DESCRIÇÃO DOS FATOS</label>
                  <textarea
                    placeholder="Como o pet se comportou na atividade? O que ele fez?"
                    value={activityForm.notes}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-semibold text-xs h-20 resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={activityForm.visibleToTutor}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, visibleToTutor: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tornar visível para o tutor no link</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsLoggingActivity(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveActivityLog}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-indigo-600/10"
                >
                  Salvar Atividade ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CARREGAR MOMENTO / FOTO */}
      <AnimatePresence>
        {isLoggingPhoto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[35px] border border-indigo-50 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="text-left">
                <h4 className="text-xl font-black text-indigo-950">Enviar Momento / Foto</h4>
                <p className="text-xs text-slate-500">Enviar imagem para o feed do tutor de {petsMap.get(isLoggingPhoto.petId)?.pet_nome}</p>
              </div>

              <div className="space-y-3 text-left">
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">SELECIONE A IMAGEM</label>
                  <label className="cursor-pointer py-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition-colors">
                    <Camera size={24} className="text-slate-450" />
                    <span className="text-xs font-bold text-slate-600">Escolher arquivo de foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFormFile}
                      className="hidden"
                      disabled={uploadingPhotoFormFile}
                    />
                  </label>
                  {uploadingPhotoFormFile && (
                    <p className="text-[10px] font-black text-indigo-600 animate-pulse text-center">Processando imagem...</p>
                  )}
                  {photoFormFileUrl && (
                    <div className="w-full h-32 rounded-xl border overflow-hidden mt-2 relative">
                      <img src={photoFormFileUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setPhotoFormFileUrl(null)}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LEGENDA DO MOMENTO</label>
                  <input
                    type="text"
                    placeholder="Ex: Se divertindo muito na matilha!"
                    value={photoForm.caption}
                    onChange={(e) => setPhotoForm(prev => ({ ...prev, caption: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={photoForm.visibleToTutor}
                    onChange={(e) => setPhotoForm(prev => ({ ...prev, visibleToTutor: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tornar visível na timeline do tutor</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsLoggingPhoto(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePhotoLog}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md"
                >
                  Postar Foto ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VER TODOS OS REGISTROS DA ESTADIA */}
      <AnimatePresence>
        {isViewingStayRecords && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[35px] border border-indigo-50 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-2 border-b">
                <div className="text-left">
                  <h4 className="text-xl font-black text-indigo-950">Acompanhamento de Estadia</h4>
                  <p className="text-xs text-slate-500">Histórico de registros de {petsMap.get(isViewingStayRecords.petId)?.pet_nome}</p>
                </div>
                <button onClick={() => setIsViewingStayRecords(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {records.filter(r => r.hotelStayId === isViewingStayRecords.id).length === 0 ? (
                  <p className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    Nenhum registro lançado para esta estadia ainda.
                  </p>
                ) : (
                  records.filter(r => r.hotelStayId === isViewingStayRecords.id).map(rec => (
                    <div key={rec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex justify-between items-start gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            rec.type === 'feeding' ? 'bg-amber-100 text-amber-800' :
                            rec.type === 'medication' ? 'bg-purple-100 text-purple-800' :
                            rec.type === 'photo' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {rec.type === 'feeding' ? 'Alimentação' :
                             rec.type === 'medication' ? 'Medicação' :
                             rec.type === 'photo' ? 'Foto' : 'Atividade'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{rec.date} • {rec.time}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 leading-relaxed text-left break-words">{rec.notes}</p>
                        {rec.photoUrl && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden border mt-1">
                            <img src={rec.photoUrl} alt="Momento" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Lançado por: {rec.responsible}</p>
                      </div>

                      <button
                        onClick={() => deleteRecord(rec.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors shrink-0 p-1 hover:bg-rose-50 rounded-full"
                        title="Deletar Registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CHECK-OUT E EMISSÃO DE BOLETIM */}
      <AnimatePresence>
        {isCheckingOut && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] border-2 border-indigo-100 shadow-2xl max-w-2xl w-full p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="text-left">
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">CHECK-OUT OPERACIONAL</span>
                <h3 className="text-3xl font-black text-indigo-950 tracking-tight">Finalizar Estadia & Gerar Boletim</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Pet: {petsMap.get(isCheckingOut.petId)?.pet_nome}</p>
              </div>

              {/* FASE 1: CONFERÊNCIA DE DEVOLUÇÃO DE PERTENCES */}
              {isCheckingOut.broughtItems && Object.keys(isCheckingOut.broughtItems).filter(k => isCheckingOut.broughtItems?.[k]).length > 0 && (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-150 space-y-4 text-left">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1">
                    <span>🎒</span> Revisão e Devolução de Pertences
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold">Confirme se todos os pertences que o tutor trouxe no check-in estão sendo devolvidos agora:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(isCheckingOut.broughtItems).filter(k => isCheckingOut.broughtItems?.[k]).map(item => (
                      <label key={item} className="flex items-center gap-2.5 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={checkoutItemsCheck[item] || false}
                          onChange={(e) => setCheckoutItemsCheck(prev => ({ ...prev, [item]: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>Confirmar Devolução de: <strong className="text-indigo-950">{item}</strong></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* FASE 2: TEXTO OFICIAL DO BOLETIM (SEM FRASES GENÉRICAS) */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">BOLETIM DE ESTADIA (EDITÁVEL)</label>
                <textarea
                  value={checkoutReportText}
                  onChange={(e) => setCheckoutReportText(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-xs leading-relaxed outline-none focus:border-indigo-300 transition-all h-48"
                  placeholder="Escreva como foi a estadia de forma personalizada..."
                />
                <p className="text-[9px] text-rose-500 font-extrabold uppercase tracking-wider ml-1">
                  * Regra de Escrita: Fale concretamente sobre o dia a dia do pet no hotel, refeições e brincadeiras reais.
                </p>
              </div>

              {/* BOTÕES DE CHECK-OUT */}
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsCheckingOut(null)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black uppercase text-xs tracking-widest rounded-2xl transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleConfirmCheckout}
                  className="flex-[2] py-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-600/20 rounded-2xl transition-all"
                >
                  CONFIRMAR CHECK-OUT & ARQUIVAR 🏨
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VISUALIZAR BOLETIM FINAL DO HISTÓRICO */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] border border-indigo-50 shadow-2xl max-w-xl w-full p-8 space-y-6"
            >
              <div className="flex justify-between items-center pb-2 border-b">
                <div className="text-left">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">BOLETIM GERADO</span>
                  <h4 className="text-2xl font-black text-indigo-950 tracking-tight mt-1">Resumo de Hospedagem</h4>
                </div>
                <button onClick={() => setViewingReport(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 pt-2 text-left">
                
                {/* Resumo de métricas registradas */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Refeições</span>
                    <strong className="text-base font-black text-slate-700">🥣 {viewingReport.summary?.mealsCount || 0}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Remédios</span>
                    <strong className="text-base font-black text-slate-700">💊 {viewingReport.summary?.medsCount || 0}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Atividades</span>
                    <strong className="text-base font-black text-slate-700">🎾 {viewingReport.summary?.activitiesCount || 0}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Repouso</span>
                    <strong className="text-base font-black text-slate-700">💤 {viewingReport.summary?.restsCount || 0}</strong>
                  </div>
                </div>

                <div className="p-6 bg-[#FDFBF7] rounded-3xl border border-amber-100 text-slate-700 font-semibold text-xs leading-relaxed text-left break-words italic whitespace-pre-line">
                  "{viewingReport.reportText}"
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setViewingReport(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    const matchedP = petsMap.get(viewingReport.petId);
                    shareReportWhatsApp(viewingReport, matchedP?.telefone || '');
                  }}
                  className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} /> Compartilhar via WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Hotel;
