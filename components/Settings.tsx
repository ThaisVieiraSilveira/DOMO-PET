import React, { useState, useEffect } from 'react';
import { Pet, ChecklistEntry, Medication, MedicationLog, HotelStay } from '../types';
import { useTenant } from '../src/hooks/useTenant';
import { db, auth, isFirebaseConfigured } from '../src/firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

interface SettingsProps {
  pets: Pet[];
  checklists: ChecklistEntry[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  hotelStays: HotelStay[];
  zApiConfig: {
    instanceId: string;
    token: string;
    clientToken: string;
  };
  onSaveZApi: (instanceId: string, token: string, clientToken: string) => void;
}

const COLOR_OPTIONS = [
  { value: '#2d512e', name: 'Verde Domo' },
  { value: '#085041', name: 'Floresta Real' },
  { value: '#7F77DD', name: 'Roxo Lavanda' },
  { value: '#D85A30', name: 'Laranja Coral' },
  { value: '#378ADD', name: 'Azul Celeste' },
  { value: '#D4537E', name: 'Rosa Hibisco' },
  { value: '#BA7517', name: 'Dourado Mel' },
];

const Settings: React.FC<SettingsProps> = ({ 
  pets, checklists, medications, medicationLogs, hotelStays, zApiConfig, onSaveZApi
}) => {
// Navigation Tabs: 'brand' (Ajustes de Marca), 'tech' (Conectividade e Relatórios) or 'activities' (Atividades)
  const [activeTab, setActiveTab] = useState<'brand' | 'tech' | 'activities'>('brand');

  const { nome, cor, logo, slogan, email, salvar, loading: tenantLoading } = useTenant();

  // White-Label State variables
  const [domoNome, setDomoNome] = useState('DOMO');
  const [domoSlogan, setDomoSlogan] = useState('Gestão canina de ponta a ponta');
  const [domoCor, setDomoCor] = useState('#085041');
  const [domoLogo, setDomoLogo] = useState('');
  const [domoEmail, setDomoEmail] = useState('');
  
  // Custom activities state & handlers
  const [activities, setActivities] = useState<{ label: string; emoji: string }[]>([]);
  const [newActivityLabel, setNewActivityLabel] = useState('');
  const [newActivityEmoji, setNewActivityEmoji] = useState('⚽');

  // Firebase Diagnostic Test States
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<{
    writeTimeMs?: number;
    readTimeMs?: number;
    deleteTimeMs?: number;
    totalTimeMs?: number;
    message?: string;
    details?: string;
  } | null>(null);

  const runFirebaseTest = async () => {
    setTestStatus('running');
    setTestResult(null);
    
    if (!isFirebaseConfigured || !db) {
      setTestStatus('error');
      setTestResult({
        message: 'Firebase não está devidamente configurado nas variáveis de ambiente ou o Firestore está offline.',
        details: 'Certifique se as chaves API, Project ID e outras variáveis foram carregadas com sucesso.'
      });
      return;
    }

    try {
      const user = auth.currentUser;
      const testId = `diag_test_${Date.now()}`;
      const docRef = doc(db, 'firebase_tests', testId);
      
      // 1. Measure write time
      const startWrite = performance.now();
      await setDoc(docRef, {
        status: 'online',
        timestamp: new Date().toISOString(),
        testBy: user?.email || 'anonymous_diagnostic',
        device: navigator.userAgent
      });
      const endWrite = performance.now();
      const writeTime = Math.round(endWrite - startWrite);

      // 2. Measure read time
      const startRead = performance.now();
      const snap = await getDoc(docRef);
      const endRead = performance.now();
      const readTime = Math.round(endRead - startRead);

      if (!snap.exists()) {
        throw new Error('O documento foi gravado no Firestore, mas não pôde ser recuperado de volta.');
      }

      // 3. Measure delete time (cleanup)
      const startDelete = performance.now();
      await deleteDoc(docRef);
      const endDelete = performance.now();
      const deleteTime = Math.round(endDelete - startDelete);

      setTestStatus('success');
      setTestResult({
        writeTimeMs: writeTime,
        readTimeMs: readTime,
        deleteTimeMs: deleteTime,
        totalTimeMs: writeTime + readTime + deleteTime,
        message: 'Conexão e gravação com o Firebase Firestore realizadas com sucesso!',
        details: `Gravação: ${writeTime}ms | Leitura: ${readTime}ms | Limpeza: ${deleteTime}ms. Total: ${writeTime + readTime + deleteTime}ms.`
      });
    } catch (error: any) {
      console.error("Firebase diagnostic test error:", error);
      setTestStatus('error');
      setTestResult({
        message: 'Falha ao gravar ou ler dados no Firebase Firestore.',
        details: error?.message || 'Erro de rede ou regras de segurança bloqueando a operação.'
      });
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('domo_activities');
    if (stored) {
      try {
        setActivities(JSON.parse(stored));
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
      setActivities(defaultList);
      localStorage.setItem('domo_activities', JSON.stringify(defaultList));
    }
  }, []);

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityLabel.trim()) {
      alert('Por favor, preencha o nome da atividade.');
      return;
    }
    const label = newActivityLabel.trim();
    if (activities.some(act => act.label.toLowerCase() === label.toLowerCase())) {
      alert('Já existe uma atividade com este nome.');
      return;
    }
    const updated = [...activities, { label, emoji: newActivityEmoji || '✨' }];
    setActivities(updated);
    localStorage.setItem('domo_activities', JSON.stringify(updated));
    setNewActivityLabel('');
    setNewActivityEmoji('⚽');
  };

  const handleDeleteActivity = (labelToDelete: string) => {
    if (confirm(`Tem certeza que deseja remover a atividade "${labelToDelete}"?`)) {
      const updated = activities.filter(act => act.label !== labelToDelete);
      setActivities(updated);
      localStorage.setItem('domo_activities', JSON.stringify(updated));
    }
  };

  const handleResetActivities = () => {
    if (confirm('Deseja restaurar a lista padrão de atividades? Isso apagará as atividades customizadas.')) {
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
      setActivities(defaultList);
      localStorage.setItem('domo_activities', JSON.stringify(defaultList));
    }
  };
  
  // Animation/Feedback states
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Technical configuration state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localZApi, setLocalZApi] = useState(zApiConfig);
  const [showScript, setShowScript] = useState(false);
  const [syncing, setSyncing] = useState<'none' | 'push' | 'pull'>('none');

  const [communityGroupLink, setCommunityGroupLink] = useState(() => {
    return localStorage.getItem('domo_community_group_link') || '';
  });
  const [contactSubject, setContactSubject] = useState('Sugestão / Dúvida - DOMO');
  const [contactMessage, setContactMessage] = useState('');

  useEffect(() => {
    if (!tenantLoading) {
      setDomoNome(nome);
      setDomoSlogan(slogan);
      setDomoCor(cor);
      setDomoLogo(logo || '');
      setDomoEmail(email || '');
      setIsLoading(false);
    }
  }, [nome, cor, logo, slogan, email, tenantLoading]);

  useEffect(() => {
    setLocalZApi(zApiConfig);
  }, [zApiConfig]);

  useEffect(() => {
    const fetchCommunityGroupLink = async () => {
      // First try to load from localStorage cache so the UI is responsive immediately
      const cached = localStorage.getItem('domo_community_group_link');
      if (cached) {
        setCommunityGroupLink(cached);
      }
      if (isFirebaseConfigured && db && auth.currentUser) {
        try {
          const tenantRef = doc(db, 'tenants', auth.currentUser.uid);
          const docSnap = await getDoc(tenantRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.communityGroupLink) {
              setCommunityGroupLink(data.communityGroupLink);
              localStorage.setItem('domo_community_group_link', data.communityGroupLink);
            }
          }
        } catch (error: any) {
          console.warn("Aviso ao carregar link da comunidade do Firestore (pode estar offline):", error.message || error);
        }
      }
    };
    fetchCommunityGroupLink();
  }, []);

  // Handle Logo Upload and convert to Base64 (so it fits inside localStorage perfectly)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'image/png') {
        alert('Formatos inválidos! Por favor, utilize apenas arquivos de imagem no formato PNG.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setDomoLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearLogo = () => {
    setDomoLogo('');
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domoNome.trim()) {
      alert('Por favor, preencha o nome da sua creche.');
      return;
    }

    // Save brand properties using state management hook
    await salvar({
      nome: domoNome.trim(),
      cor: domoCor,
      logo: domoLogo,
      slogan: domoSlogan.trim(),
      email: domoEmail.trim()
    });

    setSalvoComSucesso(true);

    setTimeout(() => {
      setSalvoComSucesso(false);
    }, 4000);
  };

  const handleSaveCommunityGroupLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isFirebaseConfigured && db && auth.currentUser) {
      const tenantId = auth.currentUser.uid;
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(tenantRef);
        const currentData = docSnap.exists() ? docSnap.data() : {};
        const payload = {
          ...currentData,
          communityGroupLink: communityGroupLink.trim(),
          updatedAt: new Date().toISOString()
        };
        console.log("SALVANDO NO FIRESTORE", {
          collectionName: "tenants",
          documentId: tenantId,
          tenant_id: tenantId,
          payload
        });
        await setDoc(tenantRef, payload, { merge: true });
      } catch (error) {
        console.error("ERRO FIRESTORE", error);
        alert("Erro ao salvar no Firebase. Verifique conexão e regras do Firestore.");
        return;
      }
    }
    
    localStorage.setItem('domo_community_group_link', communityGroupLink.trim());
    alert('Link do grupo salvo com sucesso!');
  };

  const handleSaveZApi = () => {
    onSaveZApi(localZApi.instanceId, localZApi.token, localZApi.clientToken);
    alert('Configurações da Z-API salvas com sucesso!');
  };

  const handleReset = async () => {
    localStorage.removeItem('domo_checklists');
    localStorage.removeItem('domo_master_pets');
    localStorage.removeItem('domo_groups');
    localStorage.removeItem('domo_medications');
    localStorage.removeItem('domo_medication_logs');
    localStorage.removeItem('domo_hotel_stays');
    localStorage.removeItem('domo_deleted_pets');
    localStorage.removeItem('domo_nome');
    localStorage.removeItem('domo_slogan');
    localStorage.removeItem('domo_cor');
    localStorage.removeItem('domo_logo');
    localStorage.removeItem('domo_slug');

    await salvar({
      nome: 'DOMO',
      cor: '#085041',
      slogan: 'Gestão canina de ponta a ponta',
      logo: ''
    });
    
    alert('Sistema reiniciado com sucesso! Todos os dados e marcas personalizadas foram apagados.');
    window.location.href = '#/';
    window.location.reload();
  };

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    if (data.length === 0) {
      alert('Não há dados para exportar neste relatório.');
      return;
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const val = row[header] || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChecklists = () => {
    const data = checklists.map(c => {
      const pet = pets.find(p => p.id === c.petId);
      return {
        'Data': c.date,
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Status': c.status,
        'Alimentação': c.comeu,
        'Oferecido': c.quantoOferecido,
        'Sobrou': c.quantoSobrou,
        'Água': c.agua,
        'Escore Fecal': c.escoreFecal,
        'Observações': c.observacoes
      };
    });
    exportToCSV(data, 'Domo_Checklists', ['Data', 'Pet', 'Status', 'Alimentação', 'Oferecido', 'Sobrou', 'Água', 'Escore Fecal', 'Observações']);
  };

  const exportMedications = () => {
    const data = medicationLogs.map(l => {
      const pet = pets.find(p => p.id === l.petId);
      const med = medications.find(m => m.id === l.medicationId);
      return {
        'Data': l.date,
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Medicação': med?.name || 'Desconhecida',
        'Dosagem': med?.dosage || '-',
        'Horário': med?.time || '-',
        'Oferecido': l.offered ? 'Sim' : 'Não',
        'Por': l.offeredBy || '-',
        'Notas': l.notes || '-'
      };
    });
    exportToCSV(data, 'Domo_Medicacoes', ['Data', 'Pet', 'Medicação', 'Dosagem', 'Horário', 'Oferecido', 'Por', 'Notas']);
  };

  const exportHotel = () => {
    const data = hotelStays.map(s => {
      const pet = pets.find(p => p.id === s.petId);
      return {
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Check-In': s.checkIn,
        'Check-Out': s.checkOut,
        'Status': s.active ? 'Ativo' : 'Finalizado',
        'Instruções': s.instructions
      };
    });
    exportToCSV(data, 'Domo_Hotel', ['Pet', 'Check-In', 'Check-Out', 'Status', 'Instruções']);
  };

  const exportConsolidatedReport = () => {
    const data: any[] = [];
    checklists.forEach(c => {
      const pet = pets.find(p => p.id === c.petId);
      data.push({
        'Data/Hora': c.date,
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Tipo': 'CHECKLIST',
        'Evento': `Status: ${c.status} | Alimentação: ${c.comeu} | Água: ${c.agua}`,
        'Detalhes': c.observacoes || '-'
      });
    });
    medicationLogs.forEach(l => {
      const pet = pets.find(p => p.id === l.petId);
      const med = medications.find(m => m.id === l.medicationId);
      data.push({
        'Data/Hora': l.date,
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Tipo': 'MEDICAÇÃO',
        'Evento': `Med: ${med?.name || 'Desconhecida'} | Oferecido: ${l.offered ? 'Sim' : 'Não'}`,
        'Detalhes': l.notes || '-'
      });
    });
    hotelStays.forEach(s => {
      const pet = pets.find(p => p.id === s.petId);
      data.push({
        'Data/Hora': s.checkIn,
        'Pet': pet?.pet_nome || 'Desconhecido',
        'Tipo': 'HOTEL (Check-In)',
        'Evento': `Check-In realizado`,
        'Detalhes': s.instructions || '-'
      });
      if (!s.active) {
        data.push({
          'Data/Hora': s.checkOut,
          'Pet': pet?.pet_nome || 'Desconhecido',
          'Tipo': 'HOTEL (Check-Out)',
          'Evento': `Check-Out realizado`,
          'Detalhes': '-'
        });
      }
    });

    data.sort((a, b) => new Date(b['Data/Hora']).getTime() - new Date(a['Data/Hora']).getTime());
    exportToCSV(data, 'Domo_Relatorio_Consolidado', ['Data/Hora', 'Pet', 'Tipo', 'Evento', 'Detalhes']);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0FAF6] flex flex-col items-center justify-center p-4">
        <div className="text-7xl animate-bounce mb-6 select-none text-[#085041]">🐾</div>
        <h1 className="text-3xl font-black tracking-tighter" style={{ color: domoCor }}>
          {domoNome}
        </h1>
        <p className="font-bold animate-pulse mt-2 uppercase text-[10px] tracking-widest text-[#085041]">
          Sincronizando os Ajustes...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF6] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
        


        {/* Title Block */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl animate-bounce">⚙️</span>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">Ajustes do Sistema</h2>
          </div>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
            Personalização de Marca & Conectividade do DOMO
          </p>
        </div>

        {/* Elegant Navigation Tab Selector */}
        <div className="flex bg-emerald-950/5 p-1.5 rounded-3xl border border-emerald-900/5 max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('brand')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'brand' 
                ? 'bg-white text-emerald-800 shadow-md transform scale-100' 
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            <span>🏷️</span> Identidade Visual
          </button>
          
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'activities' 
                ? 'bg-white text-emerald-800 shadow-md transform scale-100' 
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            <span>⚽</span> Atividades
          </button>

          <button
            onClick={() => setActiveTab('tech')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tech' 
                ? 'bg-white text-emerald-800 shadow-md transform scale-100' 
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            <span>☁️</span> Conectividade
          </button>
        </div>

        {/* Brand Tab View */}
        {activeTab === 'brand' && (
          <form onSubmit={handleSaveBrand} className="space-y-8">
            
            {/* 1. Identidade da Creche */}
            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">🏫</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">1. Identidade da Creche</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome da Creche / Hotel</label>
                  <input
                    type="text"
                    value={domoNome}
                    onChange={(e) => setDomoNome(e.target.value)}
                    placeholder="Ex: Domo Sistema Pet"
                    className="w-full p-4 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-300 transition-all text-sm"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Slogan ou Descrição</label>
                  <input
                    type="text"
                    value={domoSlogan}
                    onChange={(e) => setDomoSlogan(e.target.value)}
                    placeholder="Ex: Gestão e amor pet de ponta a ponta"
                    className="w-full p-4 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-300 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail da Creche / Hotel</label>
                  <input
                    type="email"
                    value={domoEmail}
                    onChange={(e) => setDomoEmail(e.target.value)}
                    placeholder="Ex: contato@crechedomo.com"
                    className="w-full p-4 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-300 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 2. Cor Principal */}
            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">🎨</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">2. Cor Principal da Marca</h3>
              </div>

              <div className="space-y-4">
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">Escolha uma das opções sugeridas:</p>
                <div className="flex flex-wrap gap-4">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDomoCor(opt.value)}
                      title={opt.name}
                      style={{ backgroundColor: opt.value }}
                      className={`w-12 h-12 rounded-full border-4 transition-all relative ${
                        domoCor === opt.value ? 'border-amber-400 scale-110 shadow-lg' : 'border-slate-100 hover:scale-105'
                      }`}
                    >
                      {domoCor === opt.value && (
                        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-w-xs pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Ou digite código HEX personalizado</label>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 text-lg">#</span>
                  <input
                    type="text"
                    value={domoCor.replace('#', '')}
                    onChange={(e) => {
                      const typed = e.target.value.trim().substring(0, 6);
                      setDomoCor('#' + typed);
                    }}
                    placeholder="085041"
                    className="p-3 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-xl font-mono font-bold text-slate-700 outline-none focus:border-emerald-300 transition-all text-sm"
                  />
                  <div 
                    style={{ backgroundColor: domoCor }} 
                    className="w-10 h-10 rounded-xl border border-slate-100 shadow-inner block"
                  />
                </div>
              </div>

              {/* Color preview bar */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Visualização da Tom de Base</p>
                <div 
                  className="w-full h-8 rounded-xl flex items-center justify-center text-white font-bold text-[10px] uppercase tracking-[0.25em] transition-all shadow-sm"
                  style={{ backgroundColor: domoCor }}
                >
                  Paleta de Cor Ativa: {domoCor}
                </div>
              </div>
            </div>

            {/* 3. Logo PNG */}
            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">🖼️</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">3. Logotipo da Creche (PNG)</h3>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-4">
                  <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
                    Personalize o cabeçalho do portal e do sistema enviando a sua logo em PNG com fundo transparente. Recomendado tamanho quadrado para melhor enquadramento (Ex: 200x200px).
                  </p>
                  
                  <div className="flex gap-3">
                    <label className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl cursor-pointer shadow-md transition-all active:scale-95 inline-block">
                      📤 Selecionar Imagem
                      <input 
                        type="file" 
                        accept="image/png" 
                        onChange={handleLogoUpload} 
                        className="hidden" 
                      />
                    </label>

                    {domoLogo && (
                      <button 
                        type="button"
                        onClick={handleClearLogo}
                        className="px-5 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[10px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-95 border border-rose-100"
                      >
                        ❌ Remover Logo
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center p-4 shadow-inner shrink-0 relative overflow-hidden group">
                  {domoLogo ? (
                    <img 
                      src={domoLogo} 
                      alt="Preview Logo" 
                      className="max-w-full max-h-full object-contain pointer-events-none" 
                    />
                  ) : (
                    <div className="text-center">
                      <span className="text-3xl block">🐾</span>
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1 block">Sem Logo</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Real-time Preview (Portal do Tutor / Header) */}
            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">📱</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">4. Prévia em Tempo Real (Portal do Tutor)</h3>
              </div>

              <div className="border border-[#E4F2ED] rounded-[30px] overflow-hidden shadow-md max-w-md mx-auto">
                {/* Mock Phone Status Bar */}
                <div className="bg-slate-900 px-4 py-1.5 flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>14:25 🐾</span>
                  <div className="flex gap-1.5">
                    <span>📶</span>
                    <span>🔋 99%</span>
                  </div>
                </div>

                {/* Mock Header using Custom styles! */}
                <header className="py-5 px-6 border-b transition-all flex items-center justify-between" style={{ backgroundColor: domoCor + '12', borderColor: domoCor + '20' }}>
                  <div className="flex items-center gap-3">
                    {domoLogo ? (
                      <img src={domoLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                    ) : (
                      <span className="text-3xl animate-pulse">🐾</span>
                    )}
                    <div>
                      <h4 className="text-lg font-black tracking-tight transition-all" style={{ color: domoCor }}>
                        {domoNome || 'DOMO'}
                      </h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider line-clamp-1">
                        {domoSlogan || 'Gestão canina de ponta a ponta'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold" style={{ backgroundColor: domoCor }}>
                    T
                  </div>
                </header>

                {/* Mock Body content */}
                <div className="bg-[#FAFDFB] p-6 space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-emerald-50/50 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">🐶 Diário de Hoje</span>
                      <span className="text-[8px] font-bold text-slate-400">11 JUN</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 font-extrabold text-sm flex items-center justify-center">🐾</div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-700">Café da Manhã</h5>
                        <p className="text-[10px] text-slate-400">Comeu tudo super animado!</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-[#A5C3B5] font-semibold text-center uppercase tracking-widest select-none">
                    • VISUALIZAÇÃO DO CELULAR DO CLIENTE •
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Botão Salvar com patinhas animadas */}
            <div className="bg-white rounded-[35px] p-6 border border-[#E2F0EA] shadow-xl text-center space-y-4">
              <button
                type="submit"
                className="w-full py-5 text-white font-black text-xs uppercase tracking-widest rounded-3xl transition-all shadow-xl hover:scale-[1.01] active:scale-95 border-b-4 select-none relative overflow-hidden"
                style={{ 
                  backgroundColor: domoCor, 
                  borderBottomColor: 'rgba(0, 0, 0, 0.25)', 
                  boxShadow: `0 10px 20px -5px ${domoCor}40`
                }}
              >
                💾 Salvar e Aplicar Identidade
              </button>

              {salvoComSucesso && (
                <div className="bg-[#EAFDF5] border border-emerald-100 p-3 rounded-2xl text-[10px] font-black text-emerald-800 uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
                  <span>🐕</span> Alterações aplicadas com sucesso por toda a matilha!
                </div>
              )}
            </div>

          </form>
        )}

        {/* Atividades Tab View */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">⚽</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Adicionar Nova Atividade</h3>
              </div>

              <form onSubmit={handleAddActivity} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-2 col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Emoji</label>
                    <input
                      type="text"
                      value={newActivityEmoji}
                      onChange={(e) => setNewActivityEmoji(e.target.value)}
                      placeholder="Ex: ⚽"
                      maxLength={4}
                      className="w-full p-4 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-2xl font-bold text-slate-700 text-center outline-none focus:border-emerald-300 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2 col-span-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome da Atividade</label>
                    <input
                      type="text"
                      value={newActivityLabel}
                      onChange={(e) => setNewActivityLabel(e.target.value)}
                      placeholder="Ex: Treino de Agility, Piscina Aquecida..."
                      className="w-full p-4 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-300 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Sugestões de Emojis</span>
                  <div className="flex flex-wrap gap-2 p-4 bg-[#F9FBFA] border border-[#E7EFEA] rounded-2xl max-h-[140px] overflow-y-auto">
                    {['⚽', '🏊‍♂️', '🌳', '🐕‍🦺', '🧸', '🤝', '💤', '⏸️', '🦮', '🎾', '🦴', '❤️', '🪮', '🧼', '🎓', '✨', '🥩', '🥣', '💊', '🏨', '🏃‍♂️', '✂️', '🥇', '🎉', '📝', '📸', '🌡️', '💩', '💧', '🧴', '🐾', '🧺', '🍖', '🐶'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewActivityEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-emerald-50 active:scale-90 transition-all ${newActivityEmoji === emoji ? 'bg-emerald-100 border-2 border-emerald-400' : 'bg-white border border-slate-200'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md hover:scale-[1.01] active:scale-95 border-b-2"
                  style={{ 
                    backgroundColor: domoCor, 
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)' 
                  }}
                >
                  ➕ Cadastrar Nova Atividade
                </button>
              </form>
            </div>

            <div className="bg-white rounded-[35px] p-8 border border-[#E2F0EA] shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Atividades Cadastradas</h3>
                </div>
                <button
                  onClick={handleResetActivities}
                  className="text-[9px] font-black uppercase text-rose-500 hover:underline tracking-widest"
                >
                  🔄 Restaurar Padrões
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {activities.map((act) => (
                  <div 
                    key={act.label} 
                    className="flex items-center justify-between p-4 bg-[#F9FBFA] border border-[#E7EFEA] rounded-2xl hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{act.emoji}</span>
                      <span className="font-extrabold text-sm text-slate-700 truncate">{act.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteActivity(act.label)}
                      className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0"
                      title="Excluir Atividade"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tech Configuration Tab (Comunidade & Contato) */}
        {activeTab === 'tech' && (
          <div className="space-y-8">
            {/* Seção 1: Comunidade de Creches */}
            <div className="bg-white rounded-[45px] p-8 border border-slate-100 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">🤝</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Comunidade DOMO</h3>
              </div>

              <div 
                className="p-8 rounded-[35px] text-white space-y-6 relative overflow-hidden shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${domoCor} 0%, #1c3620 100%)`
                }}
              >
                {/* Background decorative paw */}
                <div className="absolute right-[-20px] bottom-[-20px] text-9xl text-white/5 pointer-events-none font-black select-none">
                  🐾
                </div>

                <div className="space-y-2 relative z-10">
                  <span className="text-xs bg-white/20 text-white font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    Em breve
                  </span>
                  <h4 className="text-2xl font-black tracking-tight">Comunidade de Creches e Hotéis Parceiros</h4>
                  <p className="text-xs text-white/85 leading-relaxed font-bold">
                    Estamos criando um espaço exclusivo no WhatsApp para gestores de creches e hotéis parceiros trocarem ideias, compartilharem melhores práticas, tirarem dúvidas e crescerem juntos.
                  </p>
                </div>

                <div className="bg-white/10 p-5 rounded-2xl border border-white/15 space-y-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💬</span>
                    <div>
                      <h5 className="font-extrabold text-sm text-white">Grupo de WhatsApp</h5>
                      <p className="text-[10px] text-white/70">Crie uma nova comunidade ou entre no canal oficial</p>
                    </div>
                  </div>
                  
                  {communityGroupLink ? (
                    <a
                      href={communityGroupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      🚀 ENTRAR NO GRUPO AGORA
                    </a>
                  ) : (
                    <div className="py-3 px-4 bg-white/5 rounded-xl border border-dashed border-white/15 text-center text-white/60 text-xs font-bold uppercase tracking-wider">
                      ⏳ O link do grupo oficial será cadastrado abaixo!
                    </div>
                  )}
                </div>

                {/* Form to configure group link dynamically */}
                <form onSubmit={handleSaveCommunityGroupLink} className="space-y-3 pt-2 relative z-10 border-t border-white/10">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                    Configurar / Atualizar Link do Grupo da Comunidade
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={communityGroupLink}
                      onChange={(e) => setCommunityGroupLink(e.target.value)}
                      placeholder="Ex: https://chat.whatsapp.com/..."
                      className="flex-1 p-3 bg-white/10 border border-white/20 rounded-xl font-bold text-white outline-none focus:bg-white/20 transition-all text-xs placeholder:text-white/30"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-white text-[#085041] font-black rounded-xl text-xs uppercase tracking-wider transition-all hover:bg-slate-50 cursor-pointer shrink-0 shadow-md"
                      style={{ color: domoCor }}
                    >
                      Salvar Link
                    </button>
                  </div>
                  <p className="text-[9px] text-white/50 font-semibold italic">
                    * Você pode criar o seu grupo do WhatsApp/Telegram e salvar o link de convite aqui.
                  </p>
                </form>
              </div>
            </div>

            {/* Seção 2: Entrar em contato com Thaís */}
            <div className="bg-white rounded-[45px] p-8 border border-slate-100 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="text-2xl">👩‍💻</span>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Contato Direto</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Visual Bio / Intro */}
                <div className="md:col-span-2 space-y-4 bg-slate-50 p-6 rounded-[30px] border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-3xl flex items-center justify-center border-2 border-white shadow-md animate-bounce">
                      🙋‍♀️
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-800 leading-none">Thaís Silveira</h4>
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mt-1">Desenvolvedora do DOMO</p>
                    </div>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">
                      Olá! Este sistema foi feito com muito carinho para ajudar no dia a dia da sua creche e hotel pet. Quero ouvir suas sugestões, feedbacks ou ajudar no que for preciso!
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-200/50 text-[11px] text-slate-400 font-semibold">
                    <p className="flex items-center gap-1.5">
                      <span>✉️</span> thaissilveiravieira7@hotmail.com
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span>🇧🇷</span> Suporte Geral e Comunidades
                    </p>
                  </div>
                </div>

                {/* Email Direct Contact Form */}
                <div className="md:col-span-3 space-y-4">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Mande uma mensagem</h4>
                  <p className="text-xs text-slate-400 font-bold leading-normal">
                    Preencha os campos abaixo e clique no botão para abrir o seu e-mail com a mensagem pré-formatada ou iniciar conversa.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        placeholder="Ex: Sugestão de nova tela de faturamento"
                        className="w-full p-3 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-emerald-300 transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sua Mensagem</label>
                      <textarea
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        rows={4}
                        placeholder="Escreva aqui sugestões de melhoria, reporte bugs ou compartilhe suas ideias..."
                        className="w-full p-3 bg-[#F9FBFA] border-2 border-[#E7EFEA] rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-emerald-300 transition-all resize-none"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <a
                        href={`mailto:thaissilveiravieira7@hotmail.com?subject=${encodeURIComponent(contactSubject)}&body=${encodeURIComponent(contactMessage)}`}
                        className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest text-center transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        style={{ backgroundColor: domoCor }}
                      >
                        <span>✉️</span> Enviar por E-mail
                      </a>
                      
                      <a
                        href={`https://wa.me/5548991234567?text=${encodeURIComponent(`Olá Thaís! Assunto: ${contactSubject}. Mensagem: ${contactMessage}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase tracking-widest text-center transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <span>💬</span> Falar no WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
      `}</style>
    </div>
  );
};

export default Settings;
