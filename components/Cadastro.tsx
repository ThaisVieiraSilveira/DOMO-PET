import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Pet } from '../types';

interface CadastroProps {
  pets: Pet[];
  onSave: (pet: Pet) => void;
}

const Cadastro: React.FC<CadastroProps> = ({ pets, onSave }) => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = petId === 'novo';
  
  const [formData, setFormData] = useState<Pet | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect');

  useEffect(() => {
    if (isNew) {
      if (!formData || formData.id === 'novo' || !formData.id.startsWith('PET')) {
        const maxId = pets.reduce((max, p) => {
          const num = parseInt(p.id.replace(/\D/g, '')) || 0;
          return Math.max(max, num);
        }, 0);
        const nextId = maxId + 1;
        
        setFormData({
          id: `PET${String(nextId).padStart(3, '0')}`,
          pet_nome: '',
          raca: 'SRD',
          data_aniversario: '',
          nao_sei_aniversario: false,
          tutor_nome: '',
          telefone: '',
          dia_semana: '',
          peso_pet: '0',
          comportamento_alimentar: '-',
          precisa_estimulo: '-',
          tipo_alimentacao: 'Ração',
          quantidade_oferecida: '-',
          quantidade_aproximada: '-',
          marca_racao: '-',
          especificacao_racao: '-',
          oferece_extras: '-',
          ingestao_agua: '-',
          interesse_agua: '-',
          ajuda_beber_agua: '-',
          sede_pos_creche: 'Não',
          possui_alergia: 'Não',
          alimentos_proibidos: '-',
          possui_doenca: 'Não',
          doenca_qual: '-',
          escore_corporal: 'Ideal',
          observacoes: '',
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
          revisoes_mensais: []
        });
      }
    } else {
      if (!formData || formData.id !== petId) {
        const pet = pets.find(p => p.id === petId);
        if (pet) {
          setFormData({
            data_aniversario: '',
            nao_sei_aniversario: false,
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
      }
    }
  }, [petId, pets, isNew]);

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      if (!formData.pet_nome.trim()) return alert("Por favor, informe o nome do pet.");
      if (!formData.tutor_nome?.trim()) return alert("Por favor, informe o nome do tutor.");
      if (!formData.telefone?.trim()) return alert("Por favor, informe o WhatsApp/Telefone do tutor.");
      
      if (formData.possui_alergia === 'Sim' && (!formData.alimentos_proibidos || formData.alimentos_proibidos === '-')) {
        return alert("Por favor, detalhe quais são as alergias ou restrições.");
      }
      
      onSave(formData);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        if (petId === 'novo') {
          if (redirectPath === 'hotel') {
            navigate('/hotel');
          } else {
            navigate('/cadastro');
          }
        } else {
          navigate('/cadastro');
        }
      }, 1500);
    }
  };

  if (!formData) return <div className="p-20 text-center font-black animate-pulse uppercase">Pet não encontrado...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 text-left">
      {/* HEADER DE IDENTIFICAÇÃO */}
      <div className="bg-emerald-900 text-white rounded-[40px] p-8 shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <button type="button" onClick={() => navigate(-1)} className="absolute top-6 left-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-20">←</button>
        
        <div className="flex flex-col items-center gap-2 shrink-0 z-10">
          <label 
            htmlFor="pet-photo-input" 
            className={`w-28 h-28 rounded-[35px] flex items-center justify-center text-5xl shadow-inner cursor-pointer relative group overflow-hidden border-2 transition-all duration-300 ${
              dragActive 
                ? 'border-emerald-300 bg-emerald-800 scale-105' 
                : 'border-white/10 bg-white/10 hover:border-emerald-400 hover:scale-[1.02]'
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
                className="w-full h-full object-cover rounded-[35px] transition-transform duration-300 group-hover:scale-105" 
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
            id="pet-photo-input" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="hidden" 
          />

          {formData.foto && (
            <button
              type="button"
              onClick={() => setFormData(prev => prev ? { ...prev, foto: undefined } : null)}
              className="text-[10px] font-black text-rose-300 hover:text-rose-100 uppercase tracking-widest transition-colors"
            >
              Remover Foto
            </button>
          )}
        </div>
        <div className="flex-grow text-center md:text-left z-10">
          <p className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.3em] mb-1">
            {isNew ? 'NOVO REGISTRO NO SISTEMA' : 'REGISTRO MESTRE COMPLETO'}
          </p>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
             <input 
              name="pet_nome"
              placeholder="Nome do Pet..."
              value={formData.pet_nome}
              onChange={handleChange}
              className="bg-transparent text-4xl font-black tracking-tighter leading-tight border-b-2 border-white/20 outline-none focus:border-white transition-all w-full md:w-auto"
            />
          </div>
          <p className="text-emerald-200/60 font-bold uppercase text-xs tracking-widest mt-2">ID: {formData.id}</p>
        </div>
        <div className="z-10 bg-white/10 p-4 rounded-3xl border border-white/10 text-center min-w-[120px]">
          <p className="text-[8px] font-black text-emerald-300 uppercase tracking-widest mb-1">PESO ATUAL</p>
          <input type="text" name="peso_pet" value={formData.peso_pet} onChange={handleChange} className="bg-transparent text-xl font-black text-white w-full text-center outline-none focus:text-emerald-400" />
          <span className="text-[10px] font-bold">KG</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* ABA 1: CADASTRO & SAÚDE */}
        {true && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* NICHO: DADOS BÁSICOS E CONTATO */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">👤</span>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">DADOS E CONTATO</h3>
              </div>
              <div className="space-y-4">
                <Field label="RAÇA (OPCIONAL)" name="raca" value={formData.raca || ''} onChange={handleChange} />
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">DATA DE ANIVERSÁRIO (OPCIONAL)</label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      name="data_aniversario"
                      disabled={formData.nao_sei_aniversario}
                      value={formData.nao_sei_aniversario ? '' : (formData.data_aniversario || '')}
                      onChange={handleChange}
                      className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none font-bold text-slate-700 text-sm transition-all ${
                        formData.nao_sei_aniversario ? 'opacity-40 cursor-not-allowed bg-slate-100' : 'focus:border-emerald-300 focus:bg-white'
                      }`}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none ml-1">
                      <input
                        type="checkbox"
                        checked={formData.nao_sei_aniversario || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            nao_sei_aniversario: e.target.checked,
                            data_aniversario: e.target.checked ? 'Não sei informar' : ''
                          });
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Não sei informar a data</span>
                    </label>
                  </div>
                </div>

                <Field label="NOME DO TUTOR (OBRIGATÓRIO)" name="tutor_nome" value={formData.tutor_nome || ''} onChange={handleChange} />
                <Field label="TELEFONE/WHATSAPP (OBRIGATÓRIO)" name="telefone" value={formData.telefone || ''} onChange={handleChange} />
                
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">AGENDA (DIAS NA CRECHE)</label>
                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-[20px] border-2 border-slate-100">
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => {
                      const isSelected = (formData.dia_semana || '').includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const currentDays = (formData.dia_semana || '').split(',').map(d => d.trim()).filter(Boolean);
                            let newDays;
                            if (currentDays.includes(day)) {
                              newDays = currentDays.filter(d => d !== day);
                            } else {
                              newDays = [...currentDays, day];
                            }
                            setFormData({ ...formData, dia_semana: newDays.join(', ') });
                          }}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-500 text-white shadow-md' 
                              : 'bg-white text-slate-400 hover:bg-emerald-50'
                          }`}
                        >
                          {day.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* NICHO: SAÚDE DETALHADA */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">🏥</span>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">SAÚDE DETALHADA</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Select label="POSSUI ALERGIA?" name="possui_alergia" value={formData.possui_alergia} onChange={handleChange} options={['Não', 'Sim']} />
                  <Select label="POSSUI DOENÇA?" name="possui_doenca" value={formData.possui_doenca} onChange={handleChange} options={['Não', 'Sim']} />
                </div>
                <Field label="ALIMENTOS PROIBIDOS" name="alimentos_proibidos" value={formData.alimentos_proibidos} onChange={handleChange} />
                <Field label="HISTÓRICO DE DOENÇA" name="doenca_qual" value={formData.doenca_qual} onChange={handleChange} />
                <Select label="ESCORE CORPORAL" name="escore_corporal" value={formData.escore_corporal} onChange={handleChange} options={['Magro', 'Ideal', 'Um pouco acima', 'Acima do peso', 'Obesidade']} />
              </div>
            </section>

            {/* NICHO: HIDRATAÇÃO */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">💧</span>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">HIDRATAÇÃO</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="INGESTÃO DE ÁGUA" name="ingestao_agua" value={formData.ingestao_agua} onChange={handleChange} />
                  <Field label="INTERESSE EM ÁGUA" name="interesse_agua" value={formData.interesse_agua} onChange={handleChange} />
                </div>
                <Field label="PRECISA DE AJUDA PARA BEBER?" name="ajuda_beber_agua" value={formData.ajuda_beber_agua} onChange={handleChange} />
                <Select label="SEDE PÓS CRECHE?" name="sede_pos_creche" value={formData.sede_pos_creche} onChange={handleChange} options={['Não', 'Sim', 'Moderada', 'Muita']} />
              </div>
            </section>

            {/* NICHO: DIETA DETALHADA */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">🍱</span>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ALIMENTAÇÃO</h3>
              </div>
              <div className="space-y-4">
                <Select label="TIPO DE DIETA" name="tipo_alimentacao" value={formData.tipo_alimentacao} onChange={handleChange} options={['Ração', 'Alimentação Natural', 'Mista']} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="MARCA DA RAÇÃO" name="marca_racao" value={formData.marca_racao} onChange={handleChange} />
                  <Field label="ESPECIFICAÇÃO" name="especificacao_racao" value={formData.especificacao_racao} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="QTD OFERECIDA" name="quantidade_oferecida" value={formData.quantidade_oferecida} onChange={handleChange} />
                  <Field label="QTD APROXIMADA" name="quantidade_aproximada" value={formData.quantidade_aproximada} onChange={handleChange} />
                </div>
                <Field label="OFERECE EXTRAS/PETISCOS?" name="oferece_extras" value={formData.oferece_extras} onChange={handleChange} />
              </div>
            </section>

            {/* NICHO: COMPORTAMENTO ALIMENTAR */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <span className="w-10 h-10 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center text-xl shadow-sm">🧠</span>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">COMPORTAMENTO ALIMENTAR</h3>
              </div>
              <div className="space-y-4">
                <Field label="COMPORTAMENTO AO COMER" name="comportamento_alimentar" value={formData.comportamento_alimentar} onChange={handleChange} />
                <Field label="PRECISA DE ESTÍMULO?" name="precisa_estimulo" value={formData.precisa_estimulo} onChange={handleChange} />
              </div>
            </section>

            {/* NICHO: OBSERVAÇÕES */}
            <section className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 space-y-4 md:col-span-2">
              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">OBSERVAÇÕES ADICIONAIS / ANOTAÇÕES GERAIS</label>
              <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} rows={3} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] font-bold text-slate-700 outline-none focus:border-slate-300 text-sm" placeholder="Ex: Medos, manias, amizades..." />
            </section>
          </div>
        )}

        {/* BOTÃO DE SALVAR GERAL */}
        <div className="pt-4">
          <button 
            type="submit" 
            className={`w-full py-8 rounded-[35px] font-black text-2xl shadow-xl transition-all active:scale-95 border-b-[8px] cursor-pointer ${
              isSaved 
                ? 'bg-emerald-600 border-emerald-800 text-white' 
                : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white'
            }`}
          >
            {isSaved 
              ? '✨ REGISTRO MESTRE SALVO!' 
              : isNew 
                ? '💾 CADASTRAR PET NA MATILHA' 
                : '💾 SALVAR ALTERAÇÕES GERAIS'
            }
          </button>
        </div>

      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; name: string; value: string; onChange: any }> = ({ label, name, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">{label}</label>
    <input type="text" name={name} value={value} onChange={onChange} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none font-bold text-slate-700 focus:border-emerald-300 focus:bg-white transition-all text-sm" />
  </div>
);

const Select: React.FC<{ label: string; name: string; value: string; onChange: any; options: string[] }> = ({ label, name, value, onChange, options }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">{label}</label>
    <select name={name} value={value} onChange={onChange} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none font-bold text-slate-700 focus:border-emerald-300 focus:bg-white transition-all text-sm appearance-none bg-white">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default Cadastro;
