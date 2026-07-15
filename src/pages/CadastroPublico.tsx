import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, Apple, Check, Phone, User, Heart, ChevronRight, Copy, Share2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

export const CadastroPublico: React.FC = () => {
  // Brand States
  const [domoNome, setDomoNome] = useState('DOMO');
  const [domoSlogan, setDomoSlogan] = useState('Gestão canina de ponta a ponta');
  const [domoCor, setDomoCor] = useState('#085041');
  const [domoLogo, setDomoLogo] = useState('');
  const [tenantId, setTenantId] = useState('local-user');

  // Form Fields
  const [nomePet, setNomePet] = useState('');
  const [dataAniversario, setDataAniversario] = useState('');
  const [naoSeiAniversario, setNaoSeiAniversario] = useState(false);
  const [raca, setRaca] = useState('');
  const [quantidadeAlimentacao, setQuantidadeAlimentacao] = useState('');
  const [tutorNome, setTutorNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipoFrequencia, setTipoFrequencia] = useState('Creche Fixa'); // 'Creche Fixa' | 'Dias de Hotel'
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [detalhesHotel, setDetalhesHotel] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

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
        setPhoto(reader.result as string);
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
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const [hasAlergia, setHasAlergia] = useState<boolean | null>(null);
  const [detalhesAlergia, setDetalhesAlergia] = useState('');

  // Alimentação states
  const [tipoAlimentacao, setTipoAlimentacao] = useState<'padrao' | 'especial' | null>(null);
  const [qualRacaoPadrao, setQualRacaoPadrao] = useState('');
  const [detalhesAlimentacaoEspecial, setDetalhesAlimentacaoEspecial] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Load branding variables
    const savedNome = localStorage.getItem('domo_nome');
    if (savedNome) setDomoNome(savedNome);

    const savedSlogan = localStorage.getItem('domo_slogan');
    if (savedSlogan) setDomoSlogan(savedSlogan);

    const savedCor = localStorage.getItem('domo_cor');
    if (savedCor) setDomoCor(savedCor);

    const savedLogo = localStorage.getItem('domo_logo');
    if (savedLogo) setDomoLogo(savedLogo);

    // Extract slug from URL hash or search parameter to resolve the correct creche
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search;
    const searchParams = new URLSearchParams(queryString);
    const crecheSlug = searchParams.get('creche');

    const fetchTenantBranding = async () => {
      if (crecheSlug && isFirebaseConfigured && db) {
        try {
          const tenantsRef = collection(db, 'tenants');
          const q = query(tenantsRef, where('slug', '==', crecheSlug));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const tenantDoc = querySnapshot.docs[0];
            const tenantData = tenantDoc.data();
            setDomoNome(tenantData.nome || 'DOMO');
            setDomoSlogan(tenantData.slogan || 'Gestão canina de ponta a ponta');
            setDomoCor(tenantData.cor || '#085041');
            setDomoLogo(tenantData.logo || '');
            setTenantId(tenantDoc.id);
          }
        } catch (err) {
          console.error("Erro ao buscar branding do tenant no Firestore:", err);
        }
      }
    };

    fetchTenantBranding().then(() => {
      // Short loading simulation for doggy paws!
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    });
  }, []);

  const toggleDia = (dia: string) => {
    if (diasSelecionados.includes(dia)) {
      setDiasSelecionados(diasSelecionados.filter(d => d !== dia));
    } else {
      setDiasSelecionados([...diasSelecionados, dia]);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Basic Brazilian Phone auto-formatter
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length > 10) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
      } else if (numbers.length > 6) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
      } else if (numbers.length > 2) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      }
      return numbers;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setWhatsapp(formatted);
  };

  const diasDisponiveis = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations matching user requirements exactly
    if (!nomePet.trim()) {
      setErrorMsg('Preencha o nome do pet para continuar.');
      return;
    }
    if (!tutorNome.trim()) {
      setErrorMsg('Preencha o nome do tutor para continuar.');
      return;
    }
    if (!whatsapp.trim()) {
      setErrorMsg('Preencha o WhatsApp do tutor para continuar.');
      return;
    }
    
    // Alergias validation
    if (hasAlergia === null) {
      setErrorMsg('Indique se o pet possui alguma alergia ou restrição.');
      return;
    }
    if (hasAlergia && !detalhesAlergia.trim()) {
      setErrorMsg('Explique a alergia ou restrição do pet para continuar.');
      return;
    }

    // Alimentação validation
    if (tipoAlimentacao === null) {
      setErrorMsg('Selecione o tipo de alimentação do pet (Ração Padrão ou Alimentação Especial).');
      return;
    }
    if (tipoAlimentacao === 'padrao' && !qualRacaoPadrao.trim()) {
      setErrorMsg('Por favor, informe qual a ração padrão do pet.');
      return;
    }
    if (tipoAlimentacao === 'especial' && !detalhesAlimentacaoEspecial.trim()) {
      setErrorMsg('Explique a alimentação do pet para continuar.');
      return;
    }

    // Build standard compatible payload
    const finalDias = tipoFrequencia === 'Dias de Hotel' 
      ? (detalhesHotel.trim() ? `Hotel: ${detalhesHotel.trim()}` : 'Hotel (dias não informados)') 
      : (diasSelecionados.length > 0 ? diasSelecionados.join(', ') : 'Creche (dias não informados)');

    const cadastroId = `C_PEND_${Date.now()}`;
    const novoCadastro = {
      id: cadastroId,
      tenant_id: tenantId,
      pet_nome: nomePet.trim(),
      raca: raca.trim() || 'SRD',
      data_aniversario: naoSeiAniversario ? 'Não sei informar' : (dataAniversario || 'Não informada'),
      nao_sei_aniversario: naoSeiAniversario,
      tutor_nome: tutorNome.trim(),
      telefone: whatsapp.trim(),
      dia_semana: finalDias,
      possui_alergia: hasAlergia ? 'Sim' : 'Não',
      alimentos_proibidos: hasAlergia ? detalhesAlergia.trim() : 'Não possui',
      foto: photo,
      possui_doenca: 'Não',
      doenca_qual: '',
      comportamento_alimentar: '',
      precisa_estimulo: 'Não',
      tipo_alimentacao: tipoAlimentacao === 'especial' ? 'Alimentação Especial' : 'Ração Padrão',
      quantidade_oferecida: quantidadeAlimentacao.trim() || 'Não informada',
      quantidade_aproximada: '',
      marca_racao: tipoAlimentacao === 'padrao' ? qualRacaoPadrao.trim() : '',
      especificacao_racao: tipoAlimentacao === 'especial' ? detalhesAlimentacaoEspecial.trim() : '',
      oferece_extras: 'Sim',
      ingestao_agua: 'Ideal',
      interesse_agua: 'Médio',
      ajuda_beber_agua: 'Não',
      sede_pos_creche: 'Não',
      escore_corporal: 'Ideal',
      observacoes: 'Pré-cadastro enviado publicamente pelo tutor.',
      status: 'Cadastro pendente de aprovação',
      data_cadastro: new Date().toISOString()
    };

    try {
      const stored = localStorage.getItem('domo_cadastros_pendentes');
      const cadastrosExistentes = stored ? JSON.parse(stored) : [];
      cadastrosExistentes.push(novoCadastro);
      localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(cadastrosExistentes));
      
      // Dispatch custom event if other modules are watching
      window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));

      // Salvar no Firebase se estiver configurado e ativo
      if (isFirebaseConfigured && db) {
        try {
          const pendDocRef = doc(db, 'cadastros_pendentes', cadastroId);
          await setDoc(pendDocRef, novoCadastro);
        } catch (fbErr) {
          console.error('Erro ao salvar no Firestore cadastros_pendentes:', fbErr);
        }
      }

      // Sincronizar com Planilha se configurado
      const sheetsWebhookUrl = localStorage.getItem('kahu_sheets_url') || '';
      if (sheetsWebhookUrl) {
        fetch(sheetsWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'PENDING_REGISTRATION', data: novoCadastro, timestamp: new Date().toISOString() })
        }).catch(err => console.warn('Erro na sincronização silenciosa com sheets:', err));
      }

      setIsSuccess(true);
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocorreu um erro ao salvar o pré-cadastro. Por favor, tente novamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0FAF6] flex flex-col items-center justify-center p-4">
        {/* Jumping paw animation matching other modules */}
        <div className="text-7xl animate-bounce-paw mb-6 select-none" style={{ color: domoCor }}>🐾</div>
        <h1 className="text-3xl font-black tracking-tighter" style={{ color: domoCor }}>
          {domoNome}
        </h1>
        <p className="font-bold animate-pulse mt-3 uppercase text-[10px] tracking-widest" style={{ color: domoCor }}>
          Preparando formulário...
        </p>
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
            animation: bouncePaw 1.4s infinite ease-in-out;
            display: inline-block;
          }
        `}</style>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F0FAF6] flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-8 text-center border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
          
          {/* Loop of happy animated paws */}
          <div className="flex justify-center gap-2.5 mb-8">
            <span className="text-4xl animate-bounce-paw" style={{ animationDelay: '0s', color: domoCor }}>🐾</span>
            <span className="text-4xl animate-bounce-paw" style={{ animationDelay: '0.15s', color: domoCor }}>🐾</span>
            <span className="text-4xl animate-bounce-paw" style={{ animationDelay: '0.3s', color: domoCor }}>🐾</span>
          </div>

          <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-[#085041]" strokeWidth={3} />
          </div>

          <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
            Cadastro Recebido!
          </h2>
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-6" style={{ color: domoCor }}>
            {domoNome} • {domoSlogan}
          </p>

          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Os dados de <strong>{nomePet}</strong> foram enviados com sucesso para a nossa equipe. Em breve analisaremos e entraremos em contato com você via WhatsApp!
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left mb-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Resumo Enviado</h4>
            <div className="space-y-1.5 text-xs text-slate-600">
              <p>🦮 <strong>Pet:</strong> {nomePet} ({raca})</p>
              <p>👤 <strong>Tutor:</strong> {tutorNome}</p>
              <p>📆 <strong>Escala:</strong> {diasSelecionados.join(', ')}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsSuccess(false);
              setNomePet('');
              setDataAniversario('');
              setNaoSeiAniversario(false);
              setRaca('');
              setQuantidadeAlimentacao('');
              setTutorNome('');
              setWhatsapp('');
              setTipoFrequencia('Creche Fixa');
              setDiasSelecionados([]);
              setDetalhesHotel('');
              setHasAlergia(null);
              setDetalhesAlergia('');
              setTipoAlimentacao(null);
              setQualRacaoPadrao('');
              setDetalhesAlimentacaoEspecial('');
            }}
            className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-white hover:scale-[1.02] shadow-lg"
            style={{ 
              backgroundColor: domoCor,
              boxShadow: `0 10px 25px -5px ${domoCor}33`
            }}
          >
            Fazer Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF6] py-12 px-4 select-none">
      <div className="max-w-lg mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex flex-col items-center gap-3">
            {domoLogo ? (
              <img src={domoLogo} alt="Logo" className="w-20 h-20 object-contain rounded-3xl shadow-lg border-2 border-white/80" />
            ) : (
              <div 
                className="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl select-none"
                style={{ backgroundColor: domoCor + '12' }}
              >
                🐶
              </div>
            )}
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: domoCor }}>
              {domoNome}
            </h1>
          </div>
          <p className="text-slate-500 font-extrabold text-[11px] uppercase tracking-[0.2em] max-w-sm mx-auto">
            {domoSlogan}
          </p>
        </div>

        {/* Floating instructions card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl text-left leading-relaxed">
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span className="text-lg">👋</span> Olá, tutor! Insira abaixo as informações cadastrais essenciais do seu pet. Este formulário de pré-cadastro será encaminhado diretamente para avaliação de entrada na nossa creche.
          </p>
        </div>

        {/* Main Public Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 text-left space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: domoCor }}></div>

          <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100/30 flex items-start gap-2.5">
            <span className="text-lg">⏱️</span>
            <div>
              <p className="text-xs text-slate-800 font-black tracking-tight leading-normal">Leva menos de 2 minutos.</p>
              <p className="text-[11px] text-slate-500 font-bold tracking-tight leading-normal">Preencha apenas o essencial para cuidarmos melhor do seu pet.</p>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-black uppercase tracking-wider rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: Informações Básicas */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-700 uppercase tracking-widest">1. Dados Principais</h3>
            </div>
            
            <div className="space-y-4">
              {/* Photo Upload Area */}
              <div className="flex flex-col items-center justify-center gap-2.5 p-5 mb-5 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-3xl transition-all relative overflow-hidden bg-slate-50/50">
                <label 
                  htmlFor="public-pet-photo" 
                  className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl shadow-inner cursor-pointer relative group overflow-hidden border-2 transition-all duration-300 ${
                    dragActive ? 'border-emerald-400 bg-emerald-50 scale-105' : 'border-slate-200 bg-slate-100 hover:scale-[1.02]'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {photo ? (
                    <img src={photo} alt="Prévia" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-3xl">🐶</span>
                  )}
                  
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] uppercase tracking-wider font-black">
                    <span>Carregar Foto</span>
                  </div>
                </label>
                <input 
                  type="file" 
                  id="public-pet-photo" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Foto do Pet (Opcional)</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Arraste ou clique para selecionar (Max 2MB)</p>
                </div>
                {photo && (
                  <button 
                    type="button" 
                    onClick={() => setPhoto('')}
                    className="text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider"
                  >
                    Remover Foto
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Nome do Pet <span className="text-rose-500">*Obrigatório</span></label>
                <input
                  type="text"
                  placeholder="Ex: Kahu"
                  value={nomePet}
                  onChange={(e) => setNomePet(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Data de Aniversário <span className="text-slate-400 font-bold">(Opcional)</span></label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      disabled={naoSeiAniversario}
                      value={dataAniversario}
                      onChange={(e) => setDataAniversario(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 text-sm outline-none transition-all ${
                        naoSeiAniversario ? 'opacity-40 cursor-not-allowed bg-slate-100' : 'hover:bg-slate-100/50 focus:bg-white focus:border-slate-300'
                      }`}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none ml-1">
                      <input
                        type="checkbox"
                        checked={naoSeiAniversario}
                        onChange={(e) => {
                          setNaoSeiAniversario(e.target.checked);
                          if (e.target.checked) setDataAniversario('');
                        }}
                        className="rounded border-slate-300 text-[#085041] focus:ring-[#085041]"
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Não sei informar a data</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Raça <span className="text-slate-400 font-bold">(Opcional)</span></label>
                  <input
                    type="text"
                    placeholder="Ex: Golden Retriever"
                    value={raca}
                    onChange={(e) => setRaca(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Quantidade <span className="text-slate-400 font-bold">(Opcional, ex: de ração/refeição)</span></label>
                  <input
                    type="text"
                    placeholder="Ex: 150g, 1 xícara"
                    value={quantidadeAlimentacao}
                    onChange={(e) => setQuantidadeAlimentacao(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">WhatsApp do Tutor (ddd+número) <span className="text-rose-500">*Obrigatório</span></label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="tel"
                      placeholder="(00) 90000-0000"
                      value={whatsapp}
                      onChange={handlePhoneChange}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Nome Completo do Tutor <span className="text-rose-500">*Obrigatório</span></label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={tutorNome}
                  onChange={(e) => setTutorNome(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Frequência e Agenda */}
          <div className="pt-4 border-t border-slate-50 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-700 uppercase tracking-widest">2. Frequência e Agenda <span className="text-slate-400 font-bold">(Opcional)</span></h3>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                O pet frequentará como Creche Fixa ou por Dias de Hotel?
              </label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setTipoFrequencia('Creche Fixa');
                    setDetalhesHotel('');
                  }}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    tipoFrequencia === 'Creche Fixa' ? 'text-emerald-700 border-emerald-400 bg-emerald-50/50' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                  style={{
                    borderColor: tipoFrequencia === 'Creche Fixa' ? domoCor : undefined,
                    color: tipoFrequencia === 'Creche Fixa' ? domoCor : undefined,
                    backgroundColor: tipoFrequencia === 'Creche Fixa' ? domoCor + '0C' : undefined
                  }}
                >
                  🏫 Creche Fixa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoFrequencia('Dias de Hotel');
                    setDiasSelecionados([]);
                  }}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    tipoFrequencia === 'Dias de Hotel' ? 'text-emerald-700 border-emerald-400 bg-emerald-50/50' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                  style={{
                    borderColor: tipoFrequencia === 'Dias de Hotel' ? domoCor : undefined,
                    color: tipoFrequencia === 'Dias de Hotel' ? domoCor : undefined,
                    backgroundColor: tipoFrequencia === 'Dias de Hotel' ? domoCor + '0C' : undefined
                  }}
                >
                  🏨 Dias de Hotel
                </button>
              </div>
            </div>

            {tipoFrequencia === 'Creche Fixa' ? (
              <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Selecione os dias da semana para a creche fixa:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diasDisponiveis.map(dia => {
                    const isSelected = diasSelecionados.includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDia(dia)}
                        className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5"
                        style={{
                          borderColor: isSelected ? domoCor : '#f1f5f9',
                          backgroundColor: isSelected ? domoCor + '0C' : '#f8fafc',
                          color: isSelected ? domoCor : '#64748b'
                        }}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: domoCor }}></div>}
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Descreva os dias ou o período planejado para o hotel:
                </label>
                <input
                  type="text"
                  placeholder="EX: De 15/07 a 22/07, ou finais de semana"
                  value={detalhesHotel}
                  onChange={(e) => setDetalhesHotel(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>
            )}
          </div>

          {/* SECTION 3: Alergias e Restrições */}
          <div className="pt-4 border-t border-slate-50 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-700 uppercase tracking-widest">3. Alergias e Cuidados</h3>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                O pet possui alergia alimentar ou restrições de toque?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHasAlergia(true)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    hasAlergia === true ? 'bg-rose-50 text-rose-600 border-rose-300' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                >
                  ⚠️ Sim, Possui
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasAlergia(false);
                    setDetalhesAlergia('');
                  }}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    hasAlergia === false ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                  style={{
                    borderColor: hasAlergia === false ? domoCor : undefined,
                    color: hasAlergia === false ? domoCor : undefined,
                    backgroundColor: hasAlergia === false ? domoCor + '0D' : undefined
                  }}
                >
                  ✅ Não Possui
                </button>
              </div>
            </div>

            {hasAlergia && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Descreva detalhadamente as alergias/proibições:</label>
                <textarea
                  rows={3}
                  placeholder="EX: Alergia a frango, petiscos industriais. Não tocar na cauda."
                  value={detalhesAlergia}
                  onChange={(e) => setDetalhesAlergia(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>
            )}
          </div>

          {/* SECTION 4: Dieta e Alimentação */}
          <div className="pt-4 border-t border-slate-50 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Apple className="h-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-700 uppercase tracking-widest">4. Nutrição e Dieta</h3>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Qual é a alimentação do pet?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTipoAlimentacao('padrao');
                    setDetalhesAlimentacaoEspecial('');
                  }}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    tipoAlimentacao === 'padrao' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                  style={{
                    borderColor: tipoAlimentacao === 'padrao' ? domoCor : undefined,
                    color: tipoAlimentacao === 'padrao' ? domoCor : undefined,
                    backgroundColor: tipoAlimentacao === 'padrao' ? domoCor + '0D' : undefined
                  }}
                >
                  🟢 Ração Padrão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoAlimentacao('especial');
                    setQualRacaoPadrao('');
                  }}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    tipoAlimentacao === 'especial' ? 'bg-amber-50 text-amber-600 border-amber-300' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100/50'
                  }`}
                >
                  🥩 Alimentação Especial
                </button>
              </div>
            </div>

            {tipoAlimentacao === 'padrao' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual ração o pet consome? <span className="text-rose-500">*Obrigatório</span></label>
                <input
                  type="text"
                  placeholder="EX: Royal Canin Golden Retriever, Premier Seleção Natural, etc."
                  value={qualRacaoPadrao}
                  onChange={(e) => setQualRacaoPadrao(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>
            )}

            {tipoAlimentacao === 'especial' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Explique a alimentação do pet <span className="text-rose-500">*Obrigatório</span></label>
                <textarea
                  rows={3}
                  placeholder="EX: Alimentação Natural (AN) 200g servidos morno, ou Ração especial hipoalergênica às 12h."
                  value={detalhesAlimentacaoEspecial}
                  onChange={(e) => setDetalhesAlimentacaoEspecial(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-slate-100 focus:border-slate-300 outline-none rounded-xl font-bold text-slate-700 transition-all text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:scale-[1.01] active:translate-y-px rounded-[18px] flex items-center justify-center gap-2"
            style={{ 
              backgroundColor: domoCor,
              boxShadow: `0 10px 25px -4px ${domoCor}4D`
            }}
          >
             Enviar Cadastro de {nomePet || 'Pet'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
          Powered by DOMO Sistema Pet
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
            animation: bouncePaw 1.4s infinite ease-in-out;
            display: inline-block;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CadastroPublico;
