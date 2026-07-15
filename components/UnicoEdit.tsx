import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pet, PetFriendship } from '../types';
import { 
  Sparkles, Plus, Trash2, History, ChevronLeft, Calendar, Brain, AlertTriangle, Play, HelpCircle, User
} from 'lucide-react';

interface UnicoEditProps {
  pets: Pet[];
  onSave: (pet: Pet) => void;
  isEmbedded?: boolean;
}

const BEHAVIOR_TAGS = [
  'Sociável',
  'Ansioso',
  'Medroso',
  'Brincalhão',
  'Carente',
  'Reservado',
  'Reativo',
  'Precisa de adaptação',
  'Prefere humanos',
  'Precisa de manejo individual'
];

const ALERT_TAGS = [
  'Usa medicação',
  'Alergia',
  'Alimentação especial',
  'Não misturar com alguns pets',
  'Cuidado especial',
  'Precisa comer separado',
  'Precisa de supervisão extra'
];

const ACTIVITY_TAGS = [
  'Brincadeira em grupo',
  'Brincadeira individual',
  'Enriquecimento ambiental',
  'Bolinha',
  'Piscininha',
  'Passeio',
  'Socialização',
  'Soneca',
  'Momento de carinho',
  'Banho',
  'Escovação'
];

const UnicoEdit: React.FC<UnicoEditProps> = ({ pets, onSave, isEmbedded = false }) => {
  const { petId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<Pet | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Friendship form state
  const [friendMonth, setFriendMonth] = useState('');
  const [friendPetName, setFriendPetName] = useState('');
  const [friendLevel, setFriendLevel] = useState('Muito amigo');
  const [friendObs, setFriendObs] = useState('');

  // Revision form state
  const [revisionMonth, setRevisionMonth] = useState('');
  const [revisionAuthor, setRevisionAuthor] = useState('');
  const [revisionStatus, setRevisionStatus] = useState('Revisado e Atualizado');
  const [revisionObs, setRevisionObs] = useState('');

  // Set default month/year for entries
  useEffect(() => {
    const date = new Date();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const currentMonthYear = `${months[date.getMonth()]}/${date.getFullYear()}`;
    setFriendMonth(currentMonthYear);
    setRevisionMonth(currentMonthYear);
  }, []);

  useEffect(() => {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      setFormData({
        perfil_comportamental: [],
        rotina_preferencias: '',
        rotina_coisas_nao_gosta: '',
        rotina_pode_petisco: 'Sim',
        rotina_pode_grupo: 'Sim',
        rotina_descansar_separado: 'Não',
        rotina_restricao_rotina: '',
        alertas_importantes: [],
        atividades_favoritas: [],
        amizades: [],
        revisoes_mensais: [],
        ...pet
      });
    }
  }, [petId, pets]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleToggleBehaviorTag = (tag: string) => {
    if (!formData) return;
    const current = formData.perfil_comportamental || [];
    const updated = current.includes(tag) 
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setFormData({ ...formData, perfil_comportamental: updated });
  };

  const handleToggleAlertTag = (tag: string) => {
    if (!formData) return;
    const current = formData.alertas_importantes || [];
    const updated = current.includes(tag) 
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setFormData({ ...formData, alertas_importantes: updated });
  };

  const handleToggleActivityTag = (tag: string) => {
    if (!formData) return;
    const current = formData.atividades_favoritas || [];
    const updated = current.includes(tag) 
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setFormData({ ...formData, atividades_favoritas: updated });
  };

  const handleAddFriendship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    if (!friendPetName.trim()) {
      alert("Por favor, selecione ou informe o nome do pet amigo.");
      return;
    }

    const newFriendship: PetFriendship = {
      id: Math.random().toString(36).substring(2, 9),
      mesAno: friendMonth || 'Mensal',
      petAmigo: friendPetName.trim(),
      nivelAmizade: friendLevel,
      observacao: friendObs.trim() || 'Nenhuma observação informada.'
    };

    const updatedAmizades = [...(formData.amizades || []), newFriendship];
    setFormData({ ...formData, amizades: updatedAmizades });

    // Clear inputs
    setFriendPetName('');
    setFriendObs('');
    alert("Amizade registrada com sucesso!");
  };

  const handleRemoveFriendship = (id: string) => {
    if (!formData) return;
    const updated = (formData.amizades || []).filter(f => f.id !== id);
    setFormData({ ...formData, amizades: updated });
  };

  const handleAddRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    if (!revisionAuthor.trim()) {
      alert("Por favor, informe quem está realizando a revisão (Quem mexeu).");
      return;
    }

    const todayStr = new Date().toLocaleDateString('pt-BR');

    const newRevision = {
      id: Math.random().toString(36).substring(2, 9),
      mesAno: revisionMonth || 'Mensal',
      responsavel: revisionAuthor.trim(),
      dataRevisao: todayStr,
      status: revisionStatus,
      observacao: revisionObs.trim() || 'Ficha mestre revisada.'
    };

    const updatedRevisoes = [newRevision, ...(formData.revisoes_mensais || [])];
    
    setFormData({ 
      ...formData, 
      revisoes_mensais: updatedRevisoes,
      ultimo_responsavel_atualizacao: revisionAuthor.trim(),
      ultimo_mes_atualizacao: revisionMonth || 'Mensal',
      ultima_data_atualizacao: todayStr
    });

    // Clear obs input
    setRevisionObs('');
    alert(`Revisão mensal de ${revisionMonth} registrada com sucesso na Ficha Mestre! Lembre-se de salvar as alterações gerais no final da página.`);
  };

  const handleRemoveRevision = (id: string) => {
    if (!formData) return;
    const updated = (formData.revisoes_mensais || []).filter(r => r.id !== id);
    
    const nextActive = updated[0];
    setFormData({ 
      ...formData, 
      revisoes_mensais: updated,
      ultimo_responsavel_atualizacao: nextActive ? nextActive.responsavel : undefined,
      ultimo_mes_atualizacao: nextActive ? nextActive.mesAno : undefined,
      ultima_data_atualizacao: nextActive ? nextActive.dataRevisao : undefined
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("A imagem deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => prev ? { ...prev, foto: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("A imagem deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => prev ? { ...prev, foto: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        if (!isEmbedded) {
          navigate('/unico');
        }
      }, 1000);
    }
  };

  if (!formData) {
    return (
      <div className="p-32 text-center opacity-40">
        <span className="text-5xl">🐶</span>
        <p className="font-bold text-slate-500 uppercase mt-2">Carregando ficha do pet...</p>
      </div>
    );
  }

  return (
    <div className={`${isEmbedded ? 'w-full' : 'max-w-[1440px] mx-auto'} space-y-6 pb-32 animate-in fade-in duration-300`}>
      
      {/* HEADER DE IDENTIFICAÇÃO EM INDIGO */}
      {!isEmbedded && (
        <div className="bg-indigo-900 text-white rounded-[40px] p-8 shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <button type="button" onClick={() => navigate('/unico')} className="absolute top-6 left-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-20">←</button>
          
          <div className="flex flex-col items-center gap-2 shrink-0 z-10">
            <label 
              htmlFor="pet-photo-input-unico" 
              className={`w-28 h-28 rounded-[35px] flex items-center justify-center text-5xl shadow-inner cursor-pointer relative group overflow-hidden border-2 transition-all duration-300 ${
                dragActive 
                  ? 'border-indigo-300 bg-indigo-800 scale-105' 
                  : 'border-white/10 bg-white/10 hover:border-indigo-400 hover:scale-[1.02]'
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              {formData.foto ? (
                <img 
                  src={formData.foto} 
                  alt={formData.pet_nome || "Pet"} 
                  className="w-full h-full object-cover rounded-[35px]" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>🐶</span>
              )}
              
              {/* Hover Camera Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-[35px] text-white">
                <span className="text-xl">📷</span>
                <span className="text-[10px] font-black tracking-widest uppercase mt-1">Alterar</span>
              </div>
            </label>
            
            <input 
              type="file" 
              id="pet-photo-input-unico" 
              accept="image/*" 
              onChange={handleFileChange} 
              className="hidden" 
            />

            {formData.foto && (
              <button
                type="button"
                onClick={() => setFormData(prev => prev ? { ...prev, foto: undefined } : null)}
                className="text-[10px] font-black text-indigo-300 hover:text-indigo-100 uppercase tracking-widest transition-colors"
              >
                Remover Foto
              </button>
            )}
          </div>
          <div className="flex-grow text-center md:text-left z-10">
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">
              FICHA ÚNICA • COMPORTAMENTO & ROTINA
            </p>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
               <h1 className="bg-transparent text-4xl font-black tracking-tighter leading-tight border-b-2 border-white/20 outline-none w-max">
                 {formData.pet_nome}
               </h1>
               <button
                 type="button"
                 onClick={() => navigate(`/cadastro/${formData.id}`)}
                 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all flex items-center gap-1.5 w-max"
               >
                 <span>📝</span> IR PARA CADASTRO
               </button>
            </div>
            <p className="text-indigo-200/60 font-bold uppercase text-xs tracking-widest mt-2">ID: {formData.id}</p>
          </div>
          <div className="z-10 bg-white/10 p-4 rounded-3xl border border-white/10 text-center min-w-[120px]">
            <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">PESO ATUAL</p>
            <p className="text-xl font-black text-white w-full text-center">{formData.peso_pet || '0'} KG</p>
            <span className="text-[10px] font-bold opacity-60">Ficha Mestre</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-8 text-left">
          
          {/* BLOCO: PERFIL COMPORTAMENTAL */}
          <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <span className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-sm"><Brain className="w-5 h-5" /></span>
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">PERFIL COMPORTAMENTAL</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selecione as características comportamentais do pet</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {BEHAVIOR_TAGS.map(tag => {
                const isSelected = (formData.perfil_comportamental || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleBehaviorTag(tag)}
                    className={`px-4.5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/10' 
                        : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border-slate-100'
                    }`}
                  >
                    {isSelected && <span className="text-white">✓</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {/* BLOCO: ALERTAS IMPORTANTES */}
          <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[35px] p-8 shadow-md border-2 border-amber-200/60 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            
            <div className="flex items-center gap-3 border-b border-amber-100 pb-4">
              <span className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-md"><AlertTriangle className="w-5 h-5" /></span>
              <div>
                <h3 className="text-[11px] font-black text-amber-900 uppercase tracking-[0.2em] leading-none mb-1">ALERTAS IMPORTANTES (EXIBIÇÃO EM DESTAQUE)</h3>
                <p className="text-[9px] font-bold text-amber-600/80 uppercase tracking-wider">Ative para sinalizar alertas críticos no boletim e painel principal</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {ALERT_TAGS.map(tag => {
                const isSelected = (formData.alertas_importantes || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleAlertTag(tag)}
                    className={`px-4.5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-amber-600 text-white border-amber-700 shadow-lg shadow-amber-600/15' 
                        : 'bg-white text-slate-600 hover:bg-amber-100 hover:text-amber-800 border-amber-100'
                    }`}
                  >
                    {isSelected ? '🚨' : '⚪'}
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {/* BLOCO: ROTINA E PREFERÊNCIAS */}
          <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <span className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-xl shadow-sm"><Calendar className="w-5 h-5" /></span>
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">ROTINA E PREFERÊNCIAS</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Instruções de dia a dia e restrições de convívio</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">PREFERÊNCIAS DO PET</label>
                <textarea 
                  name="rotina_preferencias" 
                  value={formData.rotina_preferencias || ''} 
                  onChange={handleChange} 
                  rows={2} 
                  className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white text-sm transition-all" 
                  placeholder="Ex: Ama deitar em tapete gelado, gosta de bolinha de borracha..." 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">COISAS QUE NÃO GOSTA / MEDOS</label>
                <textarea 
                  name="rotina_coisas_nao_gosta" 
                  value={formData.rotina_coisas_nao_gosta || ''} 
                  onChange={handleChange} 
                  rows={2} 
                  className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white text-sm transition-all" 
                  placeholder="Ex: Tem medo de vento forte, não gosta que peguem no rabo..." 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select 
                label="PODE RECEBER PETISCO?" 
                name="rotina_pode_petisco" 
                value={formData.rotina_pode_petisco || 'Sim'} 
                onChange={handleChange} 
                options={['Sim', 'Não', 'Apenas light', 'Apenas trazidos de casa']} 
              />
              <Select 
                label="PODE PARTICIPAR DE GRUPOS?" 
                name="rotina_pode_grupo" 
                value={formData.rotina_pode_grupo || 'Sim'} 
                onChange={handleChange} 
                options={['Sim', 'Não', 'Restrito a cães calmos', 'Apenas com fêmeas']} 
              />
              <Select 
                label="PRECISA DESCANSAR SEPARADO?" 
                name="rotina_descansar_separado" 
                value={formData.rotina_descansar_separado || 'Não'} 
                onChange={handleChange} 
                options={['Não', 'Sim', 'Sim, em canil próprio', 'Apenas se estiver muito agitado']} 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">RESTRIÇÃO DE ROTINA / OBSERVAÇÕES EXTRAS</label>
              <textarea 
                name="rotina_restricao_rotina" 
                value={formData.rotina_restricao_rotina || ''} 
                onChange={handleChange} 
                rows={2} 
                className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white text-sm transition-all" 
                placeholder="Ex: Não pode correr em piso liso, precisa de 30 min de descanso pós refeição..." 
              />
            </div>
          </section>

          {/* BLOCO: ATIVIDADES */}
          <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <span className="w-10 h-10 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">🎾</span>
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">ATIVIDADES RECOMENDADAS / FAVORITAS</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selecione os enriquecimentos e rotinas de atividades do pet na creche</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {ACTIVITY_TAGS.map(tag => {
                const isSelected = (formData.atividades_favoritas || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleActivityTag(tag)}
                    className={`px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-sky-600 text-white border-sky-700 shadow-md shadow-sky-600/10' 
                        : 'bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 border-slate-100'
                    }`}
                  >
                    {isSelected ? '✨' : '⚪'}
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {/* DIVIDER */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-dashed border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#FDFBF7] px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] rounded-full py-1.5 border border-slate-150">🤝 Amizades do Pet</span>
            </div>
          </div>

          {/* GRUPO: AMIZADES DO PET ("Amigos do Mês") */}
          <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <span className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-xl shadow-sm font-bold">🐾</span>
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">AMIZADES DO PET</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Histórico de melhores amigos na creche (útil para alimentar o boletim)</p>
              </div>
            </div>

            {/* LIST OF FRIENDSHIPS */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">AMIGOS CADASTRADOS</h4>
              
              {(!formData.amizades || formData.amizades.length === 0) ? (
                <div className="bg-slate-50 rounded-[24px] p-8 text-center border-2 border-dashed border-slate-100">
                  <span className="text-4xl block mb-2">🤝</span>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nenhuma amizade registrada ainda.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Utilize o formulário abaixo para registrar os melhores amigos de {formData.pet_nome}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.amizades.map(friend => (
                    <div key={friend.id} className="p-5 bg-rose-50/40 rounded-[24px] border border-rose-100 flex items-start gap-4 hover:shadow-sm transition-shadow">
                      <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold text-base shrink-0">
                        ❤️
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black text-rose-500 bg-rose-100/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">{friend.mesAno}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFriendship(friend.id)}
                            className="text-rose-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remover Amizade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm font-black text-slate-800 mt-1 leading-tight">{friend.petAmigo}</p>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{friend.nivelAmizade}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-rose-100/30">{friend.observacao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM TO ADD NEW FRIENDSHIP */}
            <div className="bg-slate-50 rounded-[30px] p-6 border border-slate-150 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">REGISTRAR NOVA AMIZADE</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* MONTH SELECT */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">MÊS / ANO</label>
                  <input
                    type="text"
                    className="p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-rose-400 transition"
                    value={friendMonth}
                    onChange={(e) => setFriendMonth(e.target.value)}
                    placeholder="Ex: Julho/2026"
                  />
                </div>

                {/* SELECT OR ENTER PET FRIEND NAME */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">PET AMIGO</label>
                  <div className="relative">
                    <select
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-rose-400 transition appearance-none"
                      value={friendPetName}
                      onChange={(e) => setFriendPetName(e.target.value)}
                    >
                      <option value="">-- Selecione ou digite --</option>
                      {pets
                        .filter(p => p.id !== formData.id)
                        .map(p => (
                          <option key={p.id} value={p.pet_nome}>{p.pet_nome}</option>
                        ))
                      }
                    </select>
                    <input
                      type="text"
                      className="absolute inset-y-0 left-0 right-8 px-3 py-1 bg-transparent outline-none font-bold text-slate-700 text-xs cursor-text"
                      value={friendPetName}
                      onChange={(e) => setFriendPetName(e.target.value)}
                      placeholder="Digite o nome..."
                    />
                  </div>
                </div>

                {/* FRIENDSHIP LEVEL */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">NÍVEL DE AMIZADE</label>
                  <select
                    className="p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-rose-400 transition bg-white"
                    value={friendLevel}
                    onChange={(e) => setFriendLevel(e.target.value)}
                  >
                    <option value="Muito amigo">❤️ Muito amigo</option>
                    <option value="Amigo de brincadeiras">🎾 Amigo de brincadeiras</option>
                    <option value="Super colado">✨ Super colado</option>
                    <option value="Neutro / Tolerante">🤝 Neutro / Tolerante</option>
                    <option value="Fase de aproximação">⏳ Fase de aproximação</option>
                  </select>
                </div>

              </div>

              {/* OBSERVATION */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">OBSERVAÇÃO / COMO INTERAGEM</label>
                <input
                  type="text"
                  className="p-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-rose-400 transition w-full"
                  value={friendObs}
                  onChange={(e) => setFriendObs(e.target.value)}
                  placeholder="Ex: Brincaram juntos várias vezes na semana no parquinho."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddFriendship}
                  className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Registrar Amizade
                </button>
              </div>

            </div>
          </section>

          {/* DIVIDER */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-dashed border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#FDFBF7] px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] rounded-full py-1.5 border border-slate-150">📋 Revisão Mensal</span>
            </div>
          </div>

          {/* GRUPO: REVISÃO MENSAL ("Quem mexeu") */}
          <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-sm font-bold">📋</span>
                <div>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">REVISÃO MENSAL DA FICHA MESTRE</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Controle e rastreabilidade das atualizações feitas por mês pelas tias/tios</p>
                </div>
              </div>
              
              {/* STATUS DA ÚLTIMA ATUALIZAÇÃO */}
              {formData.ultimo_responsavel_atualizacao ? (
                <div className="text-left sm:text-right">
                  <span className="inline-block text-[9px] font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider">
                    REVISADO EM {formData.ultimo_mes_atualizacao}
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Por: {formData.ultimo_responsavel_atualizacao}</p>
                </div>
              ) : (
                <span className="inline-block text-[9px] font-black bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
                  PENDENTE DE REVISÃO MENSAL
                </span>
              )}
            </div>

            {/* FORM TO ADD NEW REVISION */}
            <div className="bg-slate-50 rounded-[30px] p-6 border border-slate-150 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">✍️</span>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">REGISTRAR QUEM MEXEU E SALVAR ESTE MÊS</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* REVISION MONTH */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">MÊS / ANO DE REFERÊNCIA</label>
                  <input
                    type="text"
                    className="p-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-emerald-400 transition"
                    value={revisionMonth}
                    onChange={(e) => setRevisionMonth(e.target.value)}
                    placeholder="Ex: Julho/2026"
                  />
                </div>

                {/* REVISION AUTHOR */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-max uppercase tracking-widest ml-2">RESPONSÁVEL (QUEM MEXEU) *</label>
                  <input
                    type="text"
                    className="p-3.5 bg-white border-2 border-emerald-100 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-emerald-400 transition"
                    value={revisionAuthor}
                    onChange={(e) => setRevisionAuthor(e.target.value)}
                    placeholder="Nome do profissional (Ex: Tia Carol)"
                  />
                </div>

                {/* REVISION STATUS */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">STATUS DA REVISÃO</label>
                  <select
                    className="p-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-emerald-400 transition bg-white"
                    value={revisionStatus}
                    onChange={(e) => setRevisionStatus(e.target.value)}
                  >
                    <option value="Revisado e Atualizado">📋 Revisado e Atualizado</option>
                    <option value="Sem alterações necessárias">✅ Sem alterações necessárias</option>
                    <option value="Ficha revisada, alterada dieta">🥩 Ficha revisada, alterada dieta</option>
                    <option value="Ficha revisada, alterada medicação">💊 Ficha revisada, alterada medicação</option>
                    <option value="Ficha revisada, alterado perfil">⚡ Ficha revisada, alterado perfil</option>
                  </select>
                </div>

              </div>

              {/* OBSERVATION */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">O QUE FOI ALTERADO OU REVISADO NESTE MÊS?</label>
                <input
                  type="text"
                  className="p-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-xs focus:border-emerald-400 transition w-full"
                  value={revisionObs}
                  onChange={(e) => setRevisionObs(e.target.value)}
                  placeholder="Ex: Atualizei as amizades de acordo com a observação da semana e mudei ração..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddRevision}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Registrar Revisão na Ficha Mestre
                </button>
              </div>

            </div>

            {/* LIST OF HISTORICAL REVISIONS */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HISTÓRICO DE REVISÕES MENSAIS</h4>
              </div>
              
              {(!formData.revisoes_mensais || formData.revisoes_mensais.length === 0) ? (
                <div className="bg-slate-50 rounded-[24px] p-8 text-center border-2 border-dashed border-slate-100">
                  <span className="text-4xl block mb-2">🗓️</span>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nenhum histórico de revisões mensais ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.revisoes_mensais.map(rev => (
                    <div key={rev.id} className="p-5 bg-white rounded-[24px] border border-slate-100 flex items-start justify-between gap-4 hover:shadow-sm transition-all hover:border-emerald-100">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                          ✓
                        </div>
                        <div className="text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">{rev.mesAno}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">por {rev.responsavel}</span>
                            <span className="text-[9px] font-bold text-slate-400">— {rev.dataRevisao}</span>
                          </div>
                          <p className="text-xs font-black text-slate-700 mt-1">{rev.status}</p>
                          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{rev.observacao}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRevision(rev.id)}
                        className="text-slate-300 hover:text-rose-500 transition p-1 shrink-0 cursor-pointer"
                        title="Remover Registro de Revisão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </section>

        </div>

        {/* BOTÃO DE SALVAR GERAL INDIGO */}
        <div className="pt-4 text-left">
          <button 
            type="submit" 
            className={`w-full py-8 rounded-[35px] font-black text-2xl shadow-xl transition-all active:scale-95 border-b-[8px] cursor-pointer ${
              isSaved 
                ? 'bg-indigo-600 border-indigo-800 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white shadow-indigo-600/10'
            }`}
          >
            {isSaved 
              ? '✨ FICHA ÚNICA SALVA COM SUCESSO!' 
              : '💾 SALVAR ALTERAÇÕES DA FICHA ÚNICA'
            }
          </button>
        </div>

      </form>
    </div>
  );
};

const Select: React.FC<{ label: string; name: string; value: string; onChange: any; options: string[] }> = ({ label, name, value, onChange, options }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">{label}</label>
    <select name={name} value={value} onChange={onChange} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none font-bold text-slate-700 focus:border-indigo-300 focus:bg-white transition-all text-sm appearance-none bg-white">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default UnicoEdit;
