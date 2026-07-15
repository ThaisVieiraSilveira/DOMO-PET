import React, { useState, useEffect } from 'react';
import { Pet, ChecklistEntry, Medication, MedicationLog, HotelStay } from '../types';
import { useTenant } from '../src/hooks/useTenant';

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

  const { nome, cor, logo, slogan, salvar, loading: tenantLoading } = useTenant();

  // White-Label State variables
  const [domoNome, setDomoNome] = useState('DOMO');
  const [domoSlogan, setDomoSlogan] = useState('Gestão canina de ponta a ponta');
  const [domoCor, setDomoCor] = useState('#085041');
  const [domoLogo, setDomoLogo] = useState('');
  
  // Custom activities state & handlers
  const [activities, setActivities] = useState<{ label: string; emoji: string }[]>([]);
  const [newActivityLabel, setNewActivityLabel] = useState('');
  const [newActivityEmoji, setNewActivityEmoji] = useState('⚽');

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
  const [showPaws, setShowPaws] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Technical configuration state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localZApi, setLocalZApi] = useState(zApiConfig);
  const [showScript, setShowScript] = useState(false);
  const [syncing, setSyncing] = useState<'none' | 'push' | 'pull'>('none');

  useEffect(() => {
    if (!tenantLoading) {
      setDomoNome(nome);
      setDomoSlogan(slogan);
      setDomoCor(cor);
      setDomoLogo(logo || '');
      setIsLoading(false);
    }
  }, [nome, cor, logo, slogan, tenantLoading]);

  useEffect(() => {
    setLocalZApi(zApiConfig);
  }, [zApiConfig]);

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
      slogan: domoSlogan.trim()
    });

    // Trigger sweet bouncing paws animations
    setShowPaws(true);
    setSalvoComSucesso(true);

    setTimeout(() => {
      setSalvoComSucesso(false);
      setShowPaws(false);
    }, 4000);
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
        
        {/* Adorable custom jumping paws layer for the brand tab success */}
        {showPaws && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="flex gap-4">
              <span className="text-7xl animate-bounce-paw" style={{ animationDelay: '0s' }}>🐾</span>
              <span className="text-7xl animate-bounce-paw shadow-sm" style={{ animationDelay: '0.15s' }}>🐾</span>
              <span className="text-7xl animate-bounce-paw" style={{ animationDelay: '0.3s' }}>🐾</span>
              <span className="text-7xl animate-bounce-paw" style={{ animationDelay: '0.45s' }}>🐾</span>
            </div>
          </div>
        )}

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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Tech Configuration Tab (WhatsApp, Sheets, Database ops, Exports) */}
        {activeTab === 'tech' && (
          <div className="bg-white rounded-[45px] p-8 border border-slate-100 shadow-xl space-y-8">
            {/* Firebase Realtime Sync Info */}
            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sincronização em Tempo Real</h3>
              <div className="bg-emerald-50 p-8 rounded-[35px] border border-emerald-100 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔥</span>
                  <h4 className="text-[#085041] font-black uppercase text-sm">Firebase Sincronizado</h4>
                </div>
                <p className="text-emerald-800 text-xs font-semibold leading-relaxed">
                  Seus dados de Pets, Checklists, Atividades, Grupos, Diário e Hospedagens estão sendo sincronizados automaticamente em tempo real com o banco de dados seguro do Firebase.
                </p>
                <div className="text-[10px] text-emerald-700 font-medium space-y-1">
                  <p>✅ <strong>Nuvem Ativa:</strong> Todas as alterações feitas por você refletem instantaneamente em todos os seus dispositivos.</p>
                  <p>✅ <strong>Sem Perda de Dados:</strong> Mesmo que você limpe o navegador, seus dados estarão salvos em segurança.</p>
                  <p>✅ <strong>Multi-dispositivo:</strong> Celulares, computadores e tablets compartilham a mesma base automaticamente.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">WhatsApp Automático (Z-API)</h3>
              <div className="bg-indigo-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                    <div>
                      <h4 className="text-white font-black text-lg tracking-tight leading-none">Configurar Automação</h4>
                      <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-1">Conecte sua conta Z-API</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-indigo-300 uppercase tracking-widest ml-2 mb-1 block text-left">Instance ID</label>
                        <input 
                          type="text" 
                          value={localZApi.instanceId}
                          onChange={(e) => setLocalZApi({ ...localZApi, instanceId: e.target.value.trim() })}
                          placeholder="Ex: 3C..."
                          className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-white outline-none focus:bg-white/20 transition-all placeholder:text-white/20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-indigo-300 uppercase tracking-widest ml-2 mb-1 block text-left">Token</label>
                        <input 
                          type="text" 
                          value={localZApi.token}
                          onChange={(e) => setLocalZApi({ ...localZApi, token: e.target.value.trim() })}
                          placeholder="Identificador da Instância"
                          className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-white outline-none focus:bg-white/20 transition-all placeholder:text-white/20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-indigo-300 uppercase tracking-widest ml-2 mb-1 block text-left">Client Token (Security)</label>
                        <input 
                          type="password" 
                          value={localZApi.clientToken}
                          onChange={(e) => setLocalZApi({ ...localZApi, clientToken: e.target.value })}
                          placeholder="Seu Token de Segurança"
                          className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-white outline-none focus:bg-white/20 transition-all placeholder:text-white/20"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleSaveZApi}
                      className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95"
                    >
                      SALVAR CHAVES Z-API
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Exportar Relatórios locais (CSV)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={exportChecklists}
                  className="p-6 bg-emerald-50 border border-emerald-100 rounded-[30px] text-center hover:bg-emerald-100 transition-all group animate-in"
                >
                  <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🍱</span>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Checklists</p>
                  <p className="text-[8px] font-bold text-emerald-500 mt-1">Exportar CSV</p>
                </button>
                <button 
                  onClick={exportMedications}
                  className="p-6 bg-sky-50 border border-sky-100 rounded-[30px] text-center hover:bg-sky-100 transition-all group animate-in"
                >
                  <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">💊</span>
                  <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Medicações</p>
                  <p className="text-[8px] font-bold text-sky-500 mt-1">Exportar CSV</p>
                </button>
                <button 
                  onClick={exportHotel}
                  className="p-6 bg-amber-50 border border-amber-100 rounded-[30px] text-center hover:bg-amber-100 transition-all group animate-in"
                >
                  <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🏨</span>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Hotel</p>
                  <p className="text-[8px] font-bold text-amber-500 mt-1">Exportar CSV</p>
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Zona de Perigo</h3>
              <div className="bg-rose-50 p-6 rounded-[35px] border border-rose-100 space-y-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl bg-white w-14 h-14 flex items-center justify-center rounded-[20px] shadow-sm">⚠️</span>
                  <div>
                    <h4 className="text-lg font-black text-rose-900">Limpeza Total de Dados</h4>
                    <p className="text-xs font-bold text-rose-700/60 leading-relaxed">
                      Esta ação irá apagar permanentemente todos os seus diários salvos, grupos criados e alterações que você fez nas fichas dos pets. Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </div>

                {!confirmDelete ? (
                  <button 
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-4 bg-rose-500 text-white font-black rounded-[25px] shadow-lg hover:bg-rose-600 transition-all active:scale-95"
                  >
                    APAGAR TODO MEU CADASTRO
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-400 font-black rounded-[25px] transition-all"
                    >
                      CANCELAR
                    </button>
                    <button 
                      onClick={handleReset}
                      className="flex-2 py-4 bg-rose-600 text-white font-black rounded-[25px] shadow-xl hover:bg-rose-700 transition-all animate-pulse"
                    >
                      SIM, APAGAR TUDO AGORA!
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

      </div>

      <style>{`
        @keyframes bouncePaw {
          0%, 100% {
            transform: translateY(0) scale(1) rotate(0deg);
          }
          30% {
            transform: translateY(-25px) scale(1.15) rotate(15deg);
          }
          50% {
            transform: translateY(-30px) scale(1.15) rotate(-15deg);
          }
          70% {
            transform: translateY(-25px) scale(1.15) rotate(10deg);
          }
        }
        .animate-bounce-paw {
          animation: bouncePaw 1s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          display: inline-block;
          filter: drop-shadow(0 10px 8px rgba(0,0,0,0.12));
        }
      `}</style>
    </div>
  );
};

export default Settings;
