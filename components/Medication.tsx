import React, { useState, useMemo } from 'react';
import { Pet, Medication as MedicationType, MedicationLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ChevronDown, Plus, Trash2, User, Clock, Check, X, 
  AlertCircle, Calendar, MessageSquare, ArrowLeft, Heart, 
  Sparkles, Building2, CheckCircle2, XCircle, ChevronRight, HelpCircle
} from 'lucide-react';

interface MedicationProps {
  pets: Pet[];
  medications: MedicationType[];
  medicationLogs: MedicationLog[];
  onSaveMedication: (medication: MedicationType) => void;
  onDeleteMedication: (id: string) => void;
  onSaveLog: (log: MedicationLog) => void;
}

const Medication: React.FC<MedicationProps> = ({ 
  pets, 
  medications, 
  medicationLogs, 
  onSaveMedication, 
  onDeleteMedication, 
  onSaveLog 
}) => {
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [medType, setMedType] = useState<'Continua' | 'Pontual'>('Continua');
  const [newMed, setNewMed] = useState<Partial<MedicationType>>({
    name: '',
    dosage: '',
    time: '',
    frequency: '24h',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    instructions: '',
    active: true
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Persist the last user who administered medication for friction-free clicks
  const [globalOperator, setGlobalOperator] = useState<string>(() => {
    return localStorage.getItem('domo_last_med_provider') || '';
  });

  const [offeredByInputs, setOfferedByInputs] = useState<Record<string, string>>({});

  // Parse the instructions tag logic beautifully
  const getInstructionsText = (instructions: string) => {
    if (!instructions) return 'Sem instruções adicionais';
    return instructions.replace(/\[(Continua|Pontual)\]\s*/i, '').trim() || 'Sem instruções adicionais';
  };

  const isContinuousMed = (med: MedicationType) => {
    if (med.instructions?.includes('[Continua]')) return true;
    if (med.instructions?.includes('[Pontual]')) return false;
    return !med.endDate; // fallback configuration
  };

  // Filter cães dynamically from fuzzy search term
  const searchedPets = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return pets.filter(p => 
      (p.pet_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.raca || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pets, searchTerm]);

  // Retrieve pet detail helper
  const selectedPet = useMemo(() => {
    return pets.find(p => p.id === selectedPetId);
  }, [pets, selectedPetId]);

  // Medications for selected pet
  const selectedPetMedications = useMemo(() => {
    if (!selectedPetId) return [];
    return medications.filter(m => m.petId === selectedPetId);
  }, [medications, selectedPetId]);

  // Medications of ALL pets grouped by cão
  const groupedMedications = useMemo(() => {
    const map: Record<string, { pet: Pet; medications: MedicationType[] }> = {};
    
    // Warm initialize existing pets that actually have medication records
    medications.forEach(med => {
      const p = pets.find(x => x.id === med.petId);
      if (p) {
        if (!map[p.id]) {
          map[p.id] = { pet: p, medications: [] };
        }
        map[p.id].medications.push(med);
      }
    });

    return Object.values(map).sort((a, b) => a.pet.pet_nome.localeCompare(b.pet.pet_nome));
  }, [medications, pets]);

  const handleAddMedication = () => {
    if (!selectedPetId) return;
    if (!newMed.name || !newMed.time) {
      alert('Por favor, preencha o nome e o horário planejado da medicação.');
      return;
    }

    // Attach treatment type tag smoothly inside instructions parameter
    const formattedInstructions = `[${medType}] ${newMed.instructions || ''}`;

    const medication: MedicationType = {
      id: `MED_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      petId: selectedPetId,
      name: newMed.name || '',
      dosage: newMed.dosage || '',
      time: newMed.time || '',
      frequency: newMed.frequency || '24h',
      startDate: newMed.startDate || '',
      endDate: medType === 'Continua' ? '' : (newMed.endDate || ''),
      instructions: formattedInstructions,
      active: true
    };

    onSaveMedication(medication);
    setNewMed({ 
      name: '', 
      dosage: '', 
      time: '', 
      frequency: '24h', 
      startDate: new Date().toISOString().split('T')[0], 
      endDate: '', 
      instructions: '', 
      active: true 
    });
    setIsAddingMed(false);
  };

  // Perform green validation confirm log
  const handleConfirmLog = (medicationId: string, slot: number = 0, petId: string) => {
    const inputKey = `${medicationId}-${slot}`;
    const opVal = offeredByInputs[inputKey] || globalOperator;
    
    if (!opVal.trim() || opVal === 'Cuidador') {
      alert('Por favor, informe o nome do monitor que administrou a medicação para fazer o registro.');
      return;
    }

    localStorage.setItem('domo_last_med_provider', opVal);
    setGlobalOperator(opVal);

    const log: MedicationLog = {
      id: Date.now().toString(),
      medicationId,
      petId,
      date: selectedDate,
      offered: true,
      slot,
      offeredBy: opVal,
      notes: 'Administrado'
    };

    onSaveLog(log);
  };

  // Perform red validation deny / not given log
  const handleNotGivenLog = (medicationId: string, slot: number = 0, petId: string) => {
    const inputKey = `${medicationId}-${slot}`;
    const opVal = offeredByInputs[inputKey] || globalOperator;

    if (!opVal.trim() || opVal === 'Cuidador') {
      alert('Por favor, informe o nome do monitor que administrou ou recusou a medicação.');
      return;
    }

    localStorage.setItem('domo_last_med_provider', opVal);
    setGlobalOperator(opVal);

    const log: MedicationLog = {
      id: Date.now().toString(),
      medicationId,
      petId,
      date: selectedDate,
      offered: false,
      slot,
      offeredBy: opVal,
      notes: 'Não foi dado'
    };

    onSaveLog(log);
  };

  // Get log status
  const getLog = (medicationId: string, slot: number = 0) => {
    return medicationLogs.find(l => l.medicationId === medicationId && l.date === selectedDate && (l.slot || 0) === slot);
  };

  // Helper function to extract exact clock hour given numeric ID structure
  const getLogFormattedTime = (log: MedicationLog) => {
    if (!log) return '';
    if (!isNaN(Number(log.id)) && Number(log.id) > 1000000000000) {
      const d = new Date(Number(log.id));
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };

  const handleWhatsAppNotify = (med: MedicationType, slot: number, offeredBy: string, targetPetId: string) => {
    const pet = pets.find(p => p.id === targetPetId);
    if (!pet?.telefone) {
      alert('Este tutor não possui telefone configurado no cadastro de pets.');
      return;
    }

    const cleanPhone = pet.telefone.replace(/\D/g, '');
    const numSlots = med.frequency === '12h' ? 2 : med.frequency === '8h' ? 3 : med.frequency === '6h' ? 4 : 1;
    
    let displayTime = med.time;
    if (numSlots > 1 && slot > 1) {
      const [hours, minutes] = med.time.split(':').map(Number);
      const interval = med.frequency === '12h' ? 12 : med.frequency === '8h' ? 8 : 6;
      const newHours = (hours + (interval * (slot - 1))) % 24;
      displayTime = `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    const message = `Olá! Informamos que o pet *${pet.pet_nome}* acabou de receber a medicação *${med.name}* (${displayTime}) oferecida por *${offeredBy}*. Tudo certo com ele por aqui! 🐕🏥`;
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getNumSlots = (freq: string) => {
    if (freq === '12h') return 2;
    if (freq === '8h') return 3;
    if (freq === '6h') return 4;
    return 1;
  };

  // Clear focus and terms
  const handleSelectPetFromSearch = (petId: string) => {
    setSelectedPetId(petId);
    setSearchTerm('');
    setIsSearchFocused(false);
  };

  // Custom initial color helpers
  const getAvatarGradient = (id: string) => {
    const colors = [
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-indigo-600',
      'from-teal-500 to-emerald-600',
      'from-orange-400 to-amber-600',
      'from-purple-500 to-indigo-600'
    ];
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const overallStats = useMemo(() => {
    let totalDosesCount = 0;
    let dosesGivenToday = 0;
    let dosesFailedOrDeniedToday = 0;
    let dosesPendingToday = 0;

    medications.forEach(med => {
      const numSlots = getNumSlots(med.frequency);
      if (numSlots === 1) {
        totalDosesCount++;
        const log = medicationLogs.find(l => l.medicationId === med.id && l.date === selectedDate && (l.slot || 0) === 0);
        if (log) {
          if (log.offered) {
            dosesGivenToday++;
          } else {
            dosesFailedOrDeniedToday++;
          }
        } else {
          dosesPendingToday++;
        }
      } else {
        for (let s = 1; s <= numSlots; s++) {
          totalDosesCount++;
          const log = medicationLogs.find(l => l.medicationId === med.id && l.date === selectedDate && (l.slot || 0) === s);
          if (log) {
            if (log.offered) {
              dosesGivenToday++;
            } else {
              dosesFailedOrDeniedToday++;
            }
          } else {
            dosesPendingToday++;
          }
        }
      }
    });

    return { totalDosesCount, dosesGivenToday, dosesFailedOrDeniedToday, dosesPendingToday };
  }, [medications, medicationLogs, selectedDate]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 border-b border-slate-200/60 pb-6">
        <div className="space-y-4 flex-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-[#0c4a3e] bg-emerald-50 border border-emerald-150/70 px-3 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Controle Hospitalar
              </span>
              {selectedPetId && (
                <span className="text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-150/70 px-3 py-1 rounded-full uppercase">
                  Foco: paciente {selectedPet?.pet_nome}
                </span>
              )}
            </div>
            <h2 className="text-4xl font-black text-slate-900 mt-2 tracking-tight flex items-center gap-2">
              Medicações da Matilha
              <Sparkles className="w-6 h-6 text-indigo-500" />
            </h2>
            <p className="text-slate-400 font-extrabold text-xs uppercase tracking-widest mt-1">Administre prescrições sob rígida cronologia operacional</p>
          </div>

          {/* Stats indicators - beautifully responsive */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Remédios Ativos: <span className="font-black text-indigo-600">{medications.length}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-100 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Doses Dadas: <span className="font-black text-emerald-600">{overallStats.dosesGivenToday}</span>
            </div>
            {overallStats.dosesFailedOrDeniedToday > 0 && (
              <div className="bg-rose-50/70 border border-rose-100 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Recusadas: <span className="font-black text-rose-600">{overallStats.dosesFailedOrDeniedToday}</span>
              </div>
            )}
            <div className="bg-amber-50/70 border border-amber-100 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs font-bold text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Pendentes: <span className="font-black text-amber-600">{overallStats.dosesPendingToday}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
          {/* Dynamic Progress indicator wheel or bar */}
          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl px-4.5 py-3 flex items-center gap-3">
            <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
              <span className="text-[11px] font-black text-indigo-700">
                {overallStats.totalDosesCount > 0 
                  ? Math.round(((overallStats.dosesGivenToday + overallStats.dosesFailedOrDeniedToday) / overallStats.totalDosesCount) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">PROGRESSO DIÁRIO</p>
              <p className="font-extrabold text-xs text-slate-700 mt-1">
                {overallStats.dosesGivenToday + overallStats.dosesFailedOrDeniedToday} de {overallStats.totalDosesCount} doses
              </p>
            </div>
          </div>

          <div className="bg-white px-5 py-3.5 rounded-[24px] border border-slate-150/80 shadow-md hover:shadow-lg transition-all flex items-center gap-4 hover:border-indigo-350 flex-shrink-0 cursor-pointer group">
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-500 transition-colors uppercase tracking-widest leading-none mb-1">DATA DOS REGISTROS</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-800 font-extrabold outline-none text-sm cursor-pointer select-none"
              />
            </div>
            <Calendar className="w-5 h-5 text-indigo-500 transition-transform group-hover:scale-110" />
          </div>
        </div>
      </div>

      {/* SEARCH ROW WITH LUPA ICON */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-150/70 shadow-sm relative z-40">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">PRESCRITOR E FILTRO DE PACIENTE</label>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lupa Search input */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder="Buscar pet pelo nome, matrícula ou raça..."
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchFocused(true);
              }}
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-400 placeholder:font-semibold"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            
            {searchTerm && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setIsSearchFocused(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs hover:bg-slate-300"
              >
                ✕
              </button>
            )}

            {/* SELECTION DROPDOWN PORTAL */}
            <AnimatePresence>
              {isSearchFocused && searchTerm.trim() !== '' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto z-50 divide-y divide-slate-100"
                >
                  <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Cães encontrados: {searchedPets.length}
                  </div>
                  {searchedPets.length === 0 ? (
                    <div className="p-5 text-center text-slate-400 text-xs font-semibold">
                      🐕 Nenhum pet encontrado para "{searchTerm}"
                    </div>
                  ) : (
                    searchedPets.map(pet => (
                      <div
                        key={pet.id}
                        onClick={() => handleSelectPetFromSearch(pet.id)}
                        className="p-3 hover:bg-slate-50/80 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(pet.id)} text-white flex items-center justify-center text-base font-black shadow-sm`}>
                            {pet.pet_nome.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{pet.pet_nome}</p>
                            <p className="text-[10px] font-semibold text-slate-500">{pet.raca || 'Sem raça cadastrada'} • Tutor: {pet.tutor_nome || 'N/A'}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black bg-indigo-50 border border-indigo-150/40 text-indigo-600 uppercase px-2.5 py-1 rounded-lg">Selecionar</span>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick staff selector input to prefill "Quem aplicou" */}
          <div className="relative">
            <input
              type="text"
              placeholder="Nome do Monitor"
              value={globalOperator}
              onChange={(e) => {
                setGlobalOperator(e.target.value);
                localStorage.setItem('domo_last_med_provider', e.target.value);
              }}
              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-400"
            />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
          </div>
        </div>
        
        {isSearchFocused && (
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1 font-medium">
            <span>Para fechar a busca sem selecionar, clique fora ou limpe o termo.</span>
            <button onClick={() => setIsSearchFocused(false)} className="text-indigo-600 font-bold hover:underline">Fechar lista</button>
          </div>
        )}
      </div>

      {/* SELECTED PET WORKFLOW SCREEN */}
      {selectedPetId ? (
        <div className="space-y-6">
          {/* PROFILE CARD OF THE DOG */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
              <div className="flex items-center gap-5">
                <div className={`w-18 h-18 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedPet?.id || '')} text-white flex items-center justify-center text-4xl font-black shadow-lg border-2 border-white/10 overflow-hidden`}>
                  {selectedPet?.foto ? (
                    <img src={selectedPet?.foto} alt={selectedPet?.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    "🐶"
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-indigo-500/30 text-indigo-300 text-[8px] font-black px-2 py-0.5 rounded-md uppercase border border-indigo-550/30">MATRÍCULA {selectedPet?.id}</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black px-2 py-0.5 rounded-md uppercase border border-emerald-550/20">ATENDIMENTO ATIVO</span>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight mt-1">{selectedPet?.pet_nome}</h3>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 font-medium mt-1">
                    <span>Raça: <strong className="text-white">{selectedPet?.raca || 'Sem raça'}</strong></span>
                    <span>•</span>
                    <span>Tutor: <strong className="text-white">{selectedPet?.tutor_nome || 'N/A'}</strong></span>
                    {selectedPet?.telefone && (
                      <>
                        <span>•</span>
                        <span>Tel: <strong className="text-white">{selectedPet?.telefone}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                {/* Monitor Name Input in Pet profile card */}
                <div className="flex flex-col gap-1 w-full md:w-44">
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest ml-1">Nome do Monitor *</span>
                  <input
                    type="text"
                    required
                    value={globalOperator}
                    onChange={(e) => {
                      setGlobalOperator(e.target.value);
                      localStorage.setItem('domo_last_med_provider', e.target.value);
                    }}
                    placeholder="Nome do monitor"
                    className="bg-white/10 border border-white/20 hover:border-white/45 focus:border-indigo-400 text-white placeholder:text-slate-500 font-extrabold px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all w-full"
                  />
                </div>

                <div className="flex gap-2.5 w-full md:w-auto">
                  <button
                    onClick={() => setSelectedPetId('')}
                    className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                  >
                    Voltar para Todos
                  </button>
                  <button
                    onClick={() => setIsAddingMed(prev => !prev)}
                    className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10 active:scale-95 whitespace-nowrap"
                  >
                    {isAddingMed ? 'FECHAR FORMULÁRIO ✕' : '+ NOVO REMÉDIO'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ADD MEDICINE INTERACTIVE FORM */}
          <AnimatePresence>
            {isAddingMed && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white rounded-[32px] border border-slate-150 p-6 shadow-xl overflow-hidden space-y-6"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="text-lg">📋</span>
                  <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Cadastrar Prescrição</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">NOME DO MEDICAMENTO</label>
                    <input 
                      type="text"
                      value={newMed.name}
                      onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                      placeholder="Ex: Apoquel, Prednisolona, Simparic..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-400 transition-all text-sm"
                    />
                  </div>

                  {/* Treatment type inline toggle */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">TIPO DE TRATAMENTO</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMedType('Continua')}
                        className={`py-3.5 rounded-xl font-black text-xs transition-all ${
                          medType === 'Continua'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        ♾️ Contínua
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedType('Pontual')}
                        className={`py-3.5 rounded-xl font-black text-xs transition-all ${
                          medType === 'Pontual'
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-100'
                            : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        📆 Pontual
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">DOR DE HORÁRIO PRINCIPAL</label>
                    <input 
                      type="time"
                      value={newMed.time}
                      onChange={(e) => setNewMed({...newMed, time: e.target.value})}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-400 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">DOSAGEM E INSTRUÇÕES DE POSOLOGIA</label>
                    <input 
                      type="text"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
                      placeholder="Ex: 1 comprimido, 5 gotas, 2ml..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-400 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">FREQUÊNCIA DE REPETIÇÃO</label>
                    <select 
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({...newMed, frequency: e.target.value as any})}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-400 transition-all text-sm"
                    >
                      <option value="24h">Uma vez ao dia (A cada 24 horas)</option>
                      <option value="12h">Duas vezes ao dia (A cada 12 horas)</option>
                      <option value="8h">Três vezes ao dia (A cada 8 horas)</option>
                      <option value="6h">Quatro vezes ao dia (A cada 6 horas)</option>
                      <option value="outra">Outras frequências customizadas</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">DATA DE INÍCIO</label>
                    <input 
                      type="date"
                      value={newMed.startDate}
                      onChange={(e) => setNewMed({...newMed, startDate: e.target.value})}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-400 transition-all text-sm animate-none"
                    />
                  </div>

                  {medType === 'Pontual' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-2">DATA DE TÉRMINO PLANEJADA</label>
                      <input 
                        type="date"
                        value={newMed.endDate}
                        onChange={(e) => setNewMed({...newMed, endDate: e.target.value})}
                        className="w-full p-3.5 bg-amber-50 border border-amber-200 rounded-xl font-semibold outline-none focus:border-amber-400 transition-all text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">OBSERVAÇÕES ADICIONAIS DO TRATAMENTO</label>
                    <input 
                      type="text"
                      value={newMed.instructions}
                      onChange={(e) => setNewMed({...newMed, instructions: e.target.value})}
                      placeholder="Ex: Fornecer junto com sachê de carne após refeição principal."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-400 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingMed(false)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    Retroceder Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={handleAddMedication}
                    className="flex-[2] py-4 bg-[#085041] hover:bg-[#043329] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-teal-500/10 transition-all"
                  >
                    Salvar na Ficha ✨
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PRESCRIPTION DETAIL LIST GRID */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-sm text-slate-400 uppercase tracking-widest ml-1">Medicamentos Prescritos</h4>

            {selectedPetMedications.length === 0 ? (
              <div className="py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-150 flex flex-col items-center justify-center text-slate-400">
                <span className="text-4xl">💊</span>
                <p className="font-extrabold uppercase tracking-widest text-xs mt-3">Sem medicação prescrita hoje</p>
                <p className="text-[10px] font-semibold text-slate-400 leading-none mt-1">Este peludinho não possui receitas pendentes ou cadastradas no sistema.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {selectedPetMedications.map(med => {
                  const numSlots = getNumSlots(med.frequency);
                  const isContinuous = isContinuousMed(med);

                  return (
                    <div 
                      key={med.id} 
                      className="bg-white border border-slate-150 rounded-[32px] p-6 shadow-sm relative overflow-hidden"
                    >
                      {/* Top banner info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            isContinuous 
                              ? 'bg-blue-50 text-blue-600 border border-blue-150' 
                              : 'bg-amber-50 text-amber-700 border border-amber-250/50'
                          }`}>
                            {isContinuous ? '♾️ Contínua' : '📅 Pontual'}
                          </span>
                          <span className="text-xs font-black text-slate-400">({med.frequency})</span>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir a medicação "${med.name}" do pet "${selectedPet?.pet_nome}"?`)) {
                              onDeleteMedication(med.id);
                            }
                          }}
                          className="text-[10px] font-bold text-rose-500 hover:text-rose-700 border border-rose-100 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition"
                        >
                          Excluir Receita
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex-1">
                          <h5 className="font-black text-2xl text-slate-900 tracking-tight">{med.name}</h5>
                          <p className="text-[12px] font-bold text-indigo-600 mt-0.5 uppercase tracking-wide">Dosagem: {med.dosage}</p>
                          <p className="text-[11px] font-medium text-slate-400 mt-1">
                            Instruções: <span className="text-slate-600 font-semibold">{getInstructionsText(med.instructions)}</span>
                          </p>
                          {med.startDate && (
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              Vigência: {new Date(med.startDate).toLocaleDateString('pt-BR')} {med.endDate ? `até ${new Date(med.endDate).toLocaleDateString('pt-BR')}` : 'em diante'}
                            </p>
                          )}
                        </div>

                        {/* Rendering SLOTS based on frequency */}
                        <div className="space-y-3 pt-3 border-t border-slate-50">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Doses Agendadas para Hoje</p>
                          
                          {Array.from({ length: numSlots }, (_, i) => {
                            const slotNum = numSlots > 1 ? i + 1 : 0;
                            const log = getLog(med.id, slotNum);
                            const hasBeenAddressed = log !== undefined; // True if either offered:true or offered:false has been saved
                            const isOffered = log?.offered || false;
                            
                            // Calculate slot hour offsets
                            const displayTime = slotNum > 1 ? (() => {
                              const [h, m] = med.time.split(':').map(Number);
                              const interval = med.frequency === '12h' ? 12 : med.frequency === '8h' ? 8 : 6;
                              const newH = (h + (interval * (slotNum - 1))) % 24;
                              return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                            })() : med.time;

                            return (
                              <div 
                                key={slotNum} 
                                className={`rounded-2xl p-4.5 border transition-all flex flex-col md:flex-row items-center justify-between gap-4 ${
                                  hasBeenAddressed 
                                    ? isOffered 
                                      ? 'bg-emerald-50/50 border-emerald-200' 
                                      : 'bg-rose-50/50 border-rose-100'
                                    : 'bg-slate-50/50 border-slate-150'
                                }`}
                              >
                                <div className="flex items-center gap-3.5 flex-1 w-full sm:w-auto">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border ${
                                    hasBeenAddressed 
                                      ? isOffered 
                                        ? 'bg-emerald-500 text-white border-emerald-400' 
                                        : 'bg-rose-500 text-white border-rose-450' 
                                      : 'bg-white text-slate-400 border-slate-150'
                                  }`}>
                                    {hasBeenAddressed ? isOffered ? '✓' : '✗' : '⏰'}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-slate-800">{displayTime}</span>
                                      {slotNum > 0 && <span className="bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Dose {slotNum}</span>}
                                    </div>
                                    
                                    {hasBeenAddressed ? (
                                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                        Registrado por <strong className="text-slate-800">{log.offeredBy}</strong> {isOffered ? 'como administrado' : 'como recusado/não dado'} {getLogFormattedTime(log) && `sinteticamente às ${getLogFormattedTime(log)}`}.
                                      </p>
                                    ) : (
                                      <p className="text-[10px] font-bold text-amber-600">Aguardando aplicação pelo monitor</p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
                                  {/* Action Buttons if pending */}
                                  {!hasBeenAddressed ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmLog(med.id, slotNum, med.petId)}
                                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1 hover:scale-102"
                                      >
                                        ✓ Registrar dose dada
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleNotGivenLog(med.id, slotNum, med.petId)}
                                        className="flex-1 sm:flex-none bg-rose-50/80 hover:bg-rose-100 text-rose-600 font-extrabold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                                      >
                                        ✗ Não foi dado
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2 w-full justify-end">
                                      {isOffered && (
                                        <button
                                          type="button"
                                          onClick={() => handleWhatsAppNotify(med, slotNum, log.offeredBy || '', med.petId)}
                                          className="text-[9px] bg-emerald-600 text-white font-black px-3 py-2 rounded-xl transition hover:bg-emerald-700 uppercase"
                                        >
                                          📱 Enviar Whatsapp
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Delete/reset corresponding log easily
                                          const index = medicationLogs.findIndex(l => l.medicationId === med.id && l.date === selectedDate && (l.slot || 0) === slotNum);
                                          if (index !== -1) {
                                            // Save log but set non-present values
                                            onSaveLog({ ...log, offered: !isOffered, id: `${Date.now()}` }); // inverted or reset trigger
                                            alert('Atualizado o log com sucesso!');
                                          }
                                        }}
                                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-2 rounded-xl transition uppercase"
                                      >
                                        Inverter Status / Alterar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SEM PET SELECIONADO: LISTS ALL MEDICATIONS FOR ALL PETS */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-slate-400 uppercase tracking-widest ml-1">Grade Geral de Medicações da Matilha ({groupedMedications.length} cães monitorados)</h4>
          </div>

          {groupedMedications.length === 0 ? (
            <div className="py-24 bg-white rounded-[32px] border-2 border-dashed border-slate-150 flex flex-col items-center justify-center text-slate-400 text-center px-4">
              <span className="text-5xl animate-bounce">💊</span>
              <h5 className="font-black uppercase tracking-widest text-sm mt-4 text-slate-700">Tudo limpo na matilha!</h5>
              <p className="text-slate-400 text-[11px] font-semibold leading-relaxed max-w-sm mt-1.5">Nenhum cão cadastrado possui medicação ativa no momento. Use a busca acima para selecionar um cão e registrar prescrições.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedMedications.map(({ pet, medications: petMeds }) => (
                <div key={pet.id} className="space-y-4">
                  {/* Custom headers for cão group */}
                  <div 
                    onClick={() => handleSelectPetFromSearch(pet.id)}
                    className="p-4 bg-slate-100/80 hover:bg-indigo-50 border border-slate-200/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1"
                  >
                    <div className="flex items-center gap-3">
                      {pet.foto ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                          <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <span className="text-2xl">🐶</span>
                      )}
                      <div>
                        <h4 className="font-extrabold text-base text-slate-800 leading-none">{pet.pet_nome}</h4>
                        <p className="text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-wider">{pet.raca || 'Sem raça'} • Tutor: {pet.tutor_nome || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white/90 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200">{petMeds.length} remédios</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Medications list representing each pet's prescription inside general dashboard */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pl-1.5 md:pl-4">
                    {petMeds.map(med => {
                      const numSlots = getNumSlots(med.frequency);
                      const isContinuous = isContinuousMed(med);

                      return (
                        <div 
                          key={med.id} 
                          className="bg-white border border-slate-150 rounded-[28px] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                isContinuous 
                                  ? 'bg-blue-50 text-blue-600' 
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {isContinuous ? 'Contínua' : 'Pontual'}
                              </span>
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{med.frequency}</span>
                            </div>

                            <p className="text-lg font-black text-slate-800 leading-tight">{med.name}</p>
                            <p className="text-[11px] font-bold text-indigo-600 mt-0.5 leading-none">Dose: {med.dosage}</p>
                            
                            {med.instructions && (
                              <p className="text-[10px] font-semibold text-slate-400 leading-relaxed mt-1.5 italic">
                                Info: {getInstructionsText(med.instructions)}
                              </p>
                            )}
                          </div>

                          {/* Simplified scheduler for the grouped view card */}
                          <div className="mt-4 pt-3 border-t border-slate-50 space-y-2">
                            {Array.from({ length: numSlots }, (_, i) => {
                              const slotNum = numSlots > 1 ? i + 1 : 0;
                              const log = getLog(med.id, slotNum);
                              const hasBeenAddressed = log !== undefined;
                              const isOffered = log?.offered || false;
                              
                              const displayTime = slotNum > 1 ? (() => {
                                const [h, m] = med.time.split(':').map(Number);
                                const interval = med.frequency === '12h' ? 12 : med.frequency === '8h' ? 8 : 6;
                                const newH = (h + (interval * (slotNum - 1))) % 24;
                                return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                              })() : med.time;

                              return (
                                <div key={slotNum} className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-slate-700">{displayTime}</span>
                                    {slotNum > 0 && <span className="text-[7px] font-black text-slate-400 bg-slate-100 rounded px-1">D{slotNum}</span>}
                                  </div>

                                  {hasBeenAddressed ? (
                                    <div className="flex items-center gap-1 text-[10px] font-bold">
                                      <span className={isOffered ? 'text-emerald-600' : 'text-rose-500'}>
                                        {isOffered ? '✓ Dado por' : '✗ Negado por'} {log.offeredBy}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmLog(med.id, slotNum, med.petId)}
                                        className="text-[8px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-100 px-2 py-0.5 rounded shadow-xs"
                                      >
                                        ✓ Confirmar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleNotGivenLog(med.id, slotNum, med.petId)}
                                        className="text-[8px] font-extrabold uppercase tracking-widest text-rose-500 hover:text-rose-600 bg-white border border-rose-100 px-2 py-0.5 rounded shadow-xs"
                                      >
                                        ✗ Negado
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Medication;
