
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import React, { useState, useMemo, useEffect } from 'react';
import { Pet, ChecklistEntry, FECAL_SCORE_LABELS } from '../types';
import { calculateStatus } from '../utils/status';
import { isPetOnDay } from '../utils/date';
import { getGeneratedMessage } from '../utils/messages';
import UnicoEdit from './UnicoEdit';
import { db, isFirebaseConfigured, auth } from '../src/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface PetChecklistProps {
  pets: Pet[];
  onSave: (entry: ChecklistEntry) => void;
  checklists: ChecklistEntry[];
  onUpdatePet: (pet: Pet) => void;
  zApiConfig?: {
    instanceId: string;
    token: string;
    clientToken: string;
  };
}

const PetChecklist: React.FC<PetChecklistProps> = ({ 
  pets, onSave, checklists, onUpdatePet, zApiConfig 
}) => {
  const { petId } = useParams();
  const [searchParams] = useSearchParams();
  
  const todayLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  const date = searchParams.get('date') || todayLocal();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'master' | 'history' | 'messages' | 'unico' | 'tutor'>('messages');
  const [subTab, setSubTab] = useState<'dados' | 'saude' | 'rotina' | 'alimentacao' | 'comportamento' | 'historico'>('dados');
  const pet = useMemo(() => pets.find(p => p.id === petId), [pets, petId]);
  
  const currentDayName = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()];
  }, [date]);

  const scheduledPetsForToday = useMemo(() => {
    return pets.filter(p => isPetOnDay(p, currentDayName)).sort((a, b) => a.pet_nome.localeCompare(b.pet_nome));
  }, [pets, currentDayName]);

  const nextPet = useMemo(() => {
    const currentIndex = scheduledPetsForToday.findIndex(p => p.id === petId);
    if (currentIndex !== -1 && currentIndex < scheduledPetsForToday.length - 1) {
      return scheduledPetsForToday[currentIndex + 1];
    }
    return null;
  }, [scheduledPetsForToday, petId]);

  const history = useMemo(() => checklists.filter(c => c.petId === petId).sort((a,b) => b.date.localeCompare(a.date)), [checklists, petId]);
  const existingEntry = checklists.find(c => c.petId === petId && c.date === date);

  const [form, setForm] = useState<Partial<ChecklistEntry>>({});
  const [tutorMessage, setTutorMessage] = useState('');
  const [tutorError, setTutorError] = useState<string | null>(null);

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const ensureTutorAccessActive = async (): Promise<string> => {
    if (!pet) throw new Error('Cachorro não selecionado.');

    // 1. Verificar usuário logado
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Usuário não autenticado. Faça login novamente.");
    }

    // 2. Gerar ou reutilizar token
    let token = pet.tutorAccessToken;
    const isTokenValid = !!token && pet.tutorAccessEnabled !== false;
    if (!isTokenValid) {
      token = generateToken();
    }

    try {
      // 3. Atualizar o documento do pet no Firestore
      const petDocRef = doc(db, 'pets', pet.id);
      const petPayload = {
        tutorAccessToken: token,
        tutorAccessEnabled: true,
        tenant_id: user.uid,
        tutorAccessUpdatedAt: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "pets",
        documentId: pet.id,
        userUid: user.uid,
        payload: petPayload
      });
      await setDoc(petDocRef, petPayload, { merge: true });

      // 4. Criar/atualizar tutorAccessLinks no Firestore
      const linkRef = doc(db, 'tutorAccessLinks', token);
      const linkPayload = {
        petId: pet.id,
        crecheId: user.uid,
        ativo: true,
        criadoEm: pet.tutorAccessCreatedAt || serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "tutorAccessLinks",
        documentId: token,
        userUid: user.uid,
        payload: linkPayload
      });
      await setDoc(linkRef, linkPayload, { merge: true });

      // Local storage fallback
      try {
        const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
        const links = JSON.parse(linksStr);
        links[token] = {
          crecheId: user.uid,
          petId: pet.id,
          petNome: pet.pet_nome,
          tutorNome: pet.tutor_nome || '',
          tutorWhatsapp: pet.telefone || '',
          ativo: true,
          criadoEm: pet.tutorAccessCreatedAt || new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };
        localStorage.setItem('domo_tutor_links', JSON.stringify(links));
      } catch (localErr) {
        console.error("Erro no local storage tutorAccessLinks:", localErr);
      }

      // Update state in React via prop onUpdatePet if available
      const updatedPet: Pet = {
        ...pet,
        tutorAccessToken: token,
        tutorAccessEnabled: true,
        tenant_id: user.uid,
        tutorAccessUpdatedAt: new Date().toISOString()
      };
      await onUpdatePet(updatedPet);

      setTutorMessage('Link criado e salvo com sucesso. 📋✨');
      setTimeout(() => setTutorMessage(''), 4000);

      return token;
    } catch (error: any) {
      console.error("ERRO COMPLETO FIRESTORE", error);
      alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
      console.error("Erro ao salvar link do tutor:", error);
      throw error;
    }
  };

  const handleCopyLink = async () => {
    if (!pet) return;
    setTutorError(null);
    try {
      const token = await ensureTutorAccessActive();
      const url = window.location.origin + "/#/perfil-pet/" + token;
      const tutorNome = pet.tutor_nome && pet.tutor_nome !== '-' ? ` ${pet.tutor_nome}` : '';
      const petNome = pet.pet_nome || 'seu pet';
      const textToCopy = `Olá${tutorNome}! Aqui está o link do perfil de ${petNome} para você acompanhar o dia a dia na creche em tempo real: ${url}`;
      await navigator.clipboard.writeText(textToCopy);
      setTutorMessage('Mensagem personalizada com o link copiada para a área de transferência! 📋✨');
      setTimeout(() => setTutorMessage(''), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar link do tutor:", err);
      setTutorError(`Erro ao gerar/copiar link: ${err.message || String(err)}`);
    }
  };

  const handleCopyOnlyLink = async () => {
    if (!pet) return;
    setTutorError(null);
    try {
      const token = await ensureTutorAccessActive();
      const url = window.location.origin + "/#/perfil-pet/" + token;
      await navigator.clipboard.writeText(url);
      setTutorMessage('Link do tutor copiado com sucesso! 📋✨');
      setTimeout(() => setTutorMessage(''), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar link do tutor:", err);
      setTutorError(`Erro ao gerar/copiar link: ${err.message || String(err)}`);
    }
  };

  const handleOpenAsTutor = async () => {
    if (!pet) return;
    setTutorError(null);
    try {
      const token = await ensureTutorAccessActive();
      const url = window.location.origin + "/#/perfil-pet/" + token;
      window.open(url, '_blank');
      setTutorMessage('Link aberto como tutor com sucesso. 💻✨');
      setTimeout(() => setTutorMessage(''), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar link do tutor:", err);
      setTutorError(`Erro ao processar link: ${err.message || String(err)}`);
    }
  };

  const handleDisableLink = async () => {
    if (!pet || !pet.tutorAccessToken) return;
    setTutorError(null);
    const user = auth.currentUser;
    if (!user) {
      setTutorError("Usuário não autenticado. Faça login novamente.");
      return;
    }
    try {
      const oldToken = pet.tutorAccessToken;
      
      // Update pet
      const petDocRef = doc(db, 'pets', pet.id);
      const petPayload = {
        tutorAccessEnabled: false,
        tutorAccessUpdatedAt: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "pets",
        documentId: pet.id,
        userUid: user.uid,
        payload: petPayload
      });
      await setDoc(petDocRef, petPayload, { merge: true });

      // Disable tutorAccessLinks
      const linkRef = doc(db, 'tutorAccessLinks', oldToken);
      const linkPayload = {
        ativo: false,
        atualizadoEm: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "tutorAccessLinks",
        documentId: oldToken,
        userUid: user.uid,
        payload: linkPayload
      });
      await setDoc(linkRef, linkPayload, { merge: true });

      // Update local storage fallback
      try {
        const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
        const links = JSON.parse(linksStr);
        if (links[oldToken]) {
          links[oldToken].ativo = false;
          links[oldToken].atualizadoEm = new Date().toISOString();
          localStorage.setItem('domo_tutor_links', JSON.stringify(links));
        }
      } catch (localErr) {
        console.error("Erro no local storage tutorAccessLinks:", localErr);
      }

      const updatedPet = {
        ...pet,
        tutorAccessEnabled: false,
        tutorAccessUpdatedAt: new Date().toISOString()
      };
      await onUpdatePet(updatedPet);

      setTutorMessage('Link do tutor desativado com sucesso.');
      setTimeout(() => setTutorMessage(''), 4000);
    } catch (err: any) {
      console.error("ERRO COMPLETO FIRESTORE", err);
      alert((err?.code || "Erro") + " - " + (err?.message || String(err)));
      setTutorError(`Erro ao desativar link: ${err.message || String(err)}`);
    }
  };

  const handleGenerateNewLink = async () => {
    if (!pet) return;
    setTutorError(null);
    const user = auth.currentUser;
    if (!user) {
      setTutorError("Usuário não autenticado. Faça login novamente.");
      return;
    }
    try {
      const oldToken = pet.tutorAccessToken;
      if (oldToken) {
        // Disable the old token
        try {
          const oldLinkRef = doc(db, 'tutorAccessLinks', oldToken);
          const oldLinkPayload = {
            ativo: false,
            atualizadoEm: serverTimestamp()
          };
          console.log("TENTANDO SALVAR", {
            collectionName: "tutorAccessLinks",
            documentId: oldToken,
            userUid: user.uid,
            payload: oldLinkPayload
          });
          await setDoc(oldLinkRef, oldLinkPayload, { merge: true });
        } catch (oldErr) {
          console.warn("Erro ao desativar token antigo no Firestore:", oldErr);
        }
      }

      const newToken = generateToken();
      
      // Update pet
      const petDocRef = doc(db, 'pets', pet.id);
      const petPayload = {
        tutorAccessToken: newToken,
        tutorAccessEnabled: true,
        tenant_id: user.uid,
        tutorAccessUpdatedAt: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "pets",
        documentId: pet.id,
        userUid: user.uid,
        payload: petPayload
      });
      await setDoc(petDocRef, petPayload, { merge: true });

      // Create tutorAccessLinks
      const linkRef = doc(db, 'tutorAccessLinks', newToken);
      const linkPayload = {
        petId: pet.id,
        crecheId: user.uid,
        ativo: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "tutorAccessLinks",
        documentId: newToken,
        userUid: user.uid,
        payload: linkPayload
      });
      await setDoc(linkRef, linkPayload, { merge: true });

      // Local storage fallback
      try {
        const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
        const links = JSON.parse(linksStr);
        links[newToken] = {
          crecheId: user.uid,
          petId: pet.id,
          petNome: pet.pet_nome,
          tutorNome: pet.tutor_nome || '',
          tutorWhatsapp: pet.telefone || '',
          ativo: true,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };
        localStorage.setItem('domo_tutor_links', JSON.stringify(links));
      } catch (localErr) {
        console.error("Erro no local storage tutorAccessLinks:", localErr);
      }

      const updatedPet = {
        ...pet,
        tutorAccessToken: newToken,
        tutorAccessEnabled: true,
        tutorAccessCreatedAt: new Date().toISOString(),
        tutorAccessUpdatedAt: new Date().toISOString()
      };
      await onUpdatePet(updatedPet);

      const url = window.location.origin + "/#/perfil-pet/" + newToken;
      const tutorNome = pet.tutor_nome && pet.tutor_nome !== '-' ? ` ${pet.tutor_nome}` : '';
      const petNome = pet.pet_nome || 'seu pet';
      const textToCopy = `Olá${tutorNome}! Aqui está o link do perfil de ${petNome} para você acompanhar o dia a dia na creche em tempo real: ${url}`;
      await navigator.clipboard.writeText(textToCopy);
      setTutorMessage('Novo link gerado e mensagem personalizada copiada! 🔄📋');
      setTimeout(() => setTutorMessage(''), 4000);
    } catch (err: any) {
      console.error("ERRO COMPLETO FIRESTORE", err);
      alert((err?.code || "Erro") + " - " + (err?.message || String(err)));
      setTutorError(`Erro ao gerar novo link: ${err.message || String(err)}`);
    }
  };

  const handleSendWhatsAppLink = async () => {
    if (!pet) return;
    setTutorError(null);
    try {
      const token = await ensureTutorAccessActive();
      const url = window.location.origin + "/#/perfil-pet/" + token;
      const tutorNome = pet.tutor_nome && pet.tutor_nome !== '-' ? ` ${pet.tutor_nome}` : '';
      const petNome = pet.pet_nome || 'seu pet';
      
      // Custom message
      const text = `Olá${tutorNome}! Acompanhe o dia a dia de ${petNome} por aqui em tempo real: ${url}`;
      
      // Clean phone number
      const phone = pet.telefone?.replace(/\D/g, '') || '';
      if (!phone) {
        await navigator.clipboard.writeText(text);
        setTutorMessage('Tutor sem telefone cadastrado. Mensagem com o link copiada para a área de transferência! 📋');
        setTimeout(() => setTutorMessage(''), 4000);
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

          if (!response.ok) throw new Error('Z-API error');
          setTutorMessage('Link enviado com sucesso para o WhatsApp do tutor! ✅');
          setTimeout(() => setTutorMessage(''), 4000);
        } catch (e) {
          console.error("Z-API error:", e);
          const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        }
      } else {
        const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setTutorError(`Erro ao enviar pelo WhatsApp: ${err.message || String(err)}`);
    }
  };

  useEffect(() => {
    if (existingEntry) {
      setForm({ ...existingEntry });
    } else {
      setForm({
        comeu: undefined,
        agua: 'Pouca água',
        quantoOferecido: '-',
        quantoSobrou: '-',
        teveEstimuloHidratacao: 'Não',
        comportamento: '-',
        alertas: '-',
        observacoes: '',
        escoreFecal: 3,
      });
    }
  }, [existingEntry, petId, date]);

  const handleSave = (mode: 'exit' | 'next' | 'stay', entryUpdate?: Partial<ChecklistEntry>) => {
    if (!pet) return;
    
    // Garantir que estamos usando os dados mais recentes para o status
    const updatedForm = { ...form, ...(entryUpdate || {}) };
    const entry = { 
      ...updatedForm,
      petId: pet.id, 
      date, 
      status: calculateStatus(updatedForm) 
    } as ChecklistEntry;
    
    onSave(entry);

    if (mode === 'next' && nextPet) {
      navigate(`/pet/${nextPet.id}?date=${date}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (mode === 'exit') {
      navigate('/');
    } else if (mode === 'stay' && !entryUpdate) {
      alert('Progresso salvo com sucesso! 💾');
    }
  };

  const getGeneratedMessageLocal = (entry: Partial<ChecklistEntry>) => {
    if (!pet) return '';
    return getGeneratedMessage(pet, entry);
  };

  const handleWhatsAppNotify = async (entry: ChecklistEntry) => {
    if (!pet) return;
    const text = getGeneratedMessageLocal(entry);
    
    // Atualizar que a mensagem foi enviada
    onSave({ ...entry, lastMessageSentAt: new Date().toISOString() });
    
    // Clean phone number
    const phone = pet.telefone?.replace(/\D/g, '') || '';
    
    if (!phone) {
      navigator.clipboard.writeText(text);
      alert('Pet sem telefone cadastrado. Mensagem copiada para o clipboard! ✅');
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

        if (!response.ok) throw new Error('Z-API error');
        alert('Mensagem enviada automaticamente via WhatsApp! ✅');
      } catch (e) {
        console.error("Z-API error:", e);
        const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }
    } else {
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  if (!pet) return <div className="p-20 text-center font-black uppercase tracking-widest">Pet não encontrado 🚫</div>;

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500 pb-32">
      <div className="bg-white rounded-[35px] p-6 shadow-xl border border-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-[22px] flex items-center justify-center text-3xl shadow-inner border border-white shrink-0 overflow-hidden">
            {pet.foto ? (
              <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              "🐶"
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-black">{pet.id}</span>
              <h2 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{pet.pet_nome}</h2>
            </div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
              📅 AGENDA: {pet.dia_semana || 'Não Definido'}
            </p>
          </div>
        </div>
        <div className="bg-emerald-50 px-6 py-3 rounded-full border border-emerald-100 text-center">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">{currentDayName.toUpperCase()}</p>
          <span className="text-emerald-700 text-sm font-black uppercase">
            {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 bg-slate-100 p-1.5 rounded-full shadow-inner gap-1">
        <button onClick={() => setActiveTab('messages')} className={`py-3 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'messages' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}>Mensagens</button>
        <button onClick={() => setActiveTab('tutor')} className={`py-3 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'tutor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Tutor</button>
        <button onClick={() => setActiveTab('master')} className={`py-3 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'master' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400'}`}>Ficha</button>
        <button onClick={() => setActiveTab('unico')} className={`py-3 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'unico' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400'}`}>ÚNICO</button>
        <button onClick={() => setActiveTab('history')} className={`py-3 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400'}`}>Histórico</button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'messages' && (
          <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-emerald-50 space-y-8 animate-in zoom-in-95 duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💬</span>
                <label className="text-sm font-black text-slate-800 uppercase tracking-widest">NOTIFICAR TUTOR</label>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-[30px] border-2 border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Prévia da Mensagem:</p>
                  <button 
                    onClick={() => {
                      if (confirm('Deseja limpar as observações de hoje?')) {
                        setForm({...form, observacoes: ''});
                        handleSave('stay', { observacoes: '' });
                      }
                    }}
                    className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors"
                  >
                    🗑️ Limpar Obs
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-sm font-bold text-slate-700 leading-relaxed italic mb-6">
                  {getGeneratedMessageLocal(form)}
                </div>

                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adicionar/Editar Observação:</label>
                  <textarea 
                    value={form.observacoes} 
                    onChange={e => {
                      const newObs = e.target.value;
                      setForm({...form, observacoes: newObs});
                      // Auto-save when editing in messages tab
                      handleSave('stay', { observacoes: newObs });
                    }}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:border-emerald-300 shadow-inner min-h-[80px]"
                    placeholder="Algo mais para contar ao tutor?"
                  />
                </div>
              </div>
              
              <button 
                onClick={() => handleWhatsAppNotify({ ...form, petId: pet.id, date, status: calculateStatus(form) } as ChecklistEntry)}
                className="w-full py-6 bg-emerald-500 text-white font-black rounded-full shadow-lg shadow-emerald-500/20 text-xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                ENVIAR PELO WHATSAPP 📱
              </button>
              
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                A mensagem será enviada para: <span className="text-slate-600">{pet.tutor_nome} ({pet.telefone})</span>
              </p>
            </div>
          </div>
        )}

        {activeTab === 'tutor' && (
          <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-indigo-50 space-y-8 animate-in zoom-in-95 duration-300 text-left">
            {/* Header / Intro */}
            <div className="flex items-center gap-4 border-b border-indigo-50 pb-6">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner text-indigo-600">
                📱
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Perfil do Tutor & Compartilhamento</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Central de Acesso Externo do Cliente</p>
              </div>
            </div>

            {/* Concept / Explanatory Board */}
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 rounded-[30px] p-6 border border-indigo-100/50 space-y-4">
              <div className="flex items-center gap-2 text-indigo-800 font-black text-xs uppercase tracking-wider">
                <span className="text-lg">💡</span> Como funciona o Link Seguro?
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Cada pet cadastrado no <strong>DOMO</strong> possui um endereço de acesso exclusivo e seguro para o tutor. Através deste link, o tutor pode visualizar:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-start gap-3 bg-white/70 p-3 rounded-2xl border border-indigo-100/30">
                  <span className="text-lg">🍽️</span>
                  <div className="text-xs">
                    <p className="font-black text-slate-700">Refeições & Alimentação</p>
                    <p className="font-semibold text-slate-400 mt-0.5">O quanto comeu e se bebeu água hoje.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/70 p-3 rounded-2xl border border-indigo-100/30">
                  <span className="text-lg">💊</span>
                  <div className="text-xs">
                    <p className="font-black text-slate-700">Controle de Medicação</p>
                    <p className="font-semibold text-slate-400 mt-0.5">Se as medicações diárias foram dadas.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/70 p-3 rounded-2xl border border-indigo-100/30">
                  <span className="text-lg">🕒</span>
                  <div className="text-xs">
                    <p className="font-black text-slate-700">Linha do Tempo (Atividades)</p>
                    <p className="font-semibold text-slate-400 mt-0.5">Acontecimentos e brincadeiras em tempo real.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/70 p-3 rounded-2xl border border-indigo-100/30">
                  <span className="text-lg">📸</span>
                  <div className="text-xs">
                    <p className="font-black text-slate-700">Momentos & Fotos</p>
                    <p className="font-semibold text-slate-400 mt-0.5">Fotos lindas capturadas na creche.</p>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-indigo-500 italic">
                ✨ Transparência, confiança e carinho direto no celular do tutor, sem necessidade de senhas ou logins complexos!
              </p>
            </div>

            {/* Action Card */}
            <div className="bg-slate-50 p-6 rounded-[35px] border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Status do Link de Acesso</p>
                  <p className="text-sm font-bold text-slate-700">
                    {pet.tutorAccessToken && pet.tutorAccessEnabled ? 'Link gerado e ativo no momento' : 'Nenhum link ativo ou configurado'}
                  </p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  pet.tutorAccessEnabled ? 'bg-emerald-500 text-white shadow-sm' : 'bg-rose-500 text-white'
                }`}>
                  {pet.tutorAccessEnabled ? 'Ativo ✅' : 'Inativo 🔒'}
                </span>
              </div>

              {tutorMessage && (
                <div className="bg-indigo-600 text-white text-xs font-black py-3 px-4 rounded-2xl text-center shadow-md animate-bounce">
                  {tutorMessage}
                </div>
              )}

              {tutorError && (
                <div className="bg-rose-600 text-white text-xs font-black py-3 px-4 rounded-2xl text-center shadow-md animate-bounce">
                  ⚠️ {tutorError}
                </div>
              )}

              {pet.tutorAccessToken && pet.tutorAccessEnabled && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Endereço de Acesso do Tutor</label>
                    <button 
                      onClick={handleCopyOnlyLink}
                      className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                    >
                      Copiar Apenas o Link
                    </button>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-between gap-4">
                    <p className="text-xs font-mono text-slate-600 select-all break-all leading-tight max-w-[85%]">
                      {`${window.location.origin}/#/perfil-pet/${pet.tutorAccessToken}`}
                    </p>
                    <span className="text-slate-300">🔗</span>
                  </div>
                </div>
              )}
              
              {/* Message Preview Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prévia da Mensagem do WhatsApp</p>
                <div className="text-xs font-bold text-slate-600 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 italic leading-relaxed whitespace-pre-wrap">
                  {`Olá${pet.tutor_nome && pet.tutor_nome !== '-' ? ` ${pet.tutor_nome}` : ''}! Acompanhe o dia a dia de ${pet.pet_nome || 'seu pet'} por aqui em tempo real: ${
                    pet.tutorAccessToken && pet.tutorAccessEnabled 
                      ? `${window.location.origin}/#/perfil-pet/${pet.tutorAccessToken}`
                      : '[Link será gerado]'
                  }`}
                </div>
              </div>

              {/* Primary Sharing Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleSendWhatsAppLink}
                  className="w-full py-5 bg-emerald-500 text-white font-black rounded-full shadow-lg shadow-emerald-500/20 text-md hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-xl">💬</span> ENVIAR LINK POR WHATSAPP
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-5 bg-slate-800 text-white font-black rounded-full shadow-lg text-md hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-lg">📋</span> COPIAR TEXTO FORMATADO
                </button>
              </div>

              {/* Secondary Utility Controls */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={handleOpenAsTutor}
                  className="py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <span>📱</span> Visualizar Como Tutor
                </button>

                <button
                  type="button"
                  onClick={handleDisableLink}
                  disabled={!pet.tutorAccessToken || !pet.tutorAccessEnabled}
                  className={`py-3.5 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                    pet.tutorAccessToken && pet.tutorAccessEnabled
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-100'
                  }`}
                >
                  <span>🛑</span> Desativar Acesso
                </button>

                <button
                  type="button"
                  onClick={handleGenerateNewLink}
                  className="py-3.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border border-sky-100 text-center flex items-center justify-center gap-1.5"
                >
                  <span>🔄</span> Gerar Novo Link
                </button>
              </div>
            </div>

            {/* Quick Contact Form display */}
            <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">👤 DADOS DE CONTATO DO TUTOR</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nome do Tutor</p>
                  <p className="text-sm font-black text-slate-700">{pet.tutor_nome || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">WhatsApp / Telefone</p>
                  <p className="text-sm font-black text-slate-700">{pet.telefone || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Agenda Semanal</p>
                  <p className="text-sm font-black text-slate-700">{pet.dia_semana || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'master' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
            {/* NAVEGAÇÃO RÁPIDA DA FICHA */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-[24px] md:col-span-2 mb-2">
              <button
                type="button"
                onClick={() => setSubTab('dados')}
                className={`flex-1 min-w-[75px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'dados' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                👤 Dados
              </button>
              <button
                type="button"
                onClick={() => setSubTab('saude')}
                className={`flex-1 min-w-[75px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'saude' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                🏥 Saúde
              </button>
              <button
                type="button"
                onClick={() => setSubTab('rotina')}
                className={`flex-1 min-w-[75px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'rotina' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ⚡ Rotina
              </button>
              <button
                type="button"
                onClick={() => setSubTab('alimentacao')}
                className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'alimentacao' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                🍱 Alimentação
              </button>
              <button
                type="button"
                onClick={() => setSubTab('comportamento')}
                className={`flex-1 min-w-[95px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'comportamento' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                🧠 Comportamento
              </button>
              <button
                type="button"
                onClick={() => setSubTab('historico')}
                className={`flex-1 min-w-[75px] py-2.5 px-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'historico' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                📅 Histórico
              </button>
            </div>

            {subTab === 'dados' && (
              <>
                {/* CARD DO LINK SEGURO DO TUTOR */}
                <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-6 rounded-[35px] border border-indigo-850 shadow-xl md:col-span-2 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                      ✨ LINK SEGURO DO PERFIL DO TUTOR
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                      pet.tutorAccessEnabled ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {pet.tutorAccessEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {tutorMessage && (
                    <div className="bg-indigo-850/50 border border-indigo-500/20 text-indigo-200 text-xs font-bold py-2 px-4 rounded-xl text-center">
                      {tutorMessage}
                    </div>
                  )}

                  {tutorError && (
                    <div className="bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-bold py-2 px-4 rounded-xl text-center">
                      ⚠️ {tutorError}
                    </div>
                  )}

                  <p className="text-indigo-200/70 text-[11px] font-medium leading-relaxed">
                    Este link permite que o tutor acompanhe de forma segura o perfil, rotina, fotos e atualizações do pet em tempo real, sem acessar a área administrativa.
                  </p>

                  {pet.tutorAccessToken && pet.tutorAccessEnabled && (
                    <div className="bg-indigo-950/60 p-3 rounded-2xl border border-indigo-800/30">
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">URL Pública Segura</p>
                      <p className="text-[10px] font-mono text-indigo-200 select-all break-all leading-tight">
                        {window.location.origin + '/#/perfil-pet/' + pet.tutorAccessToken}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest py-3 px-2 rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🔗</span> {pet.tutorAccessToken && pet.tutorAccessEnabled ? 'Copiar Link' : 'Gerar e Copiar'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleOpenAsTutor}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md font-black text-[9px] uppercase tracking-widest py-3 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>📱</span> Abrir Tutor
                    </button>

                    <button
                      type="button"
                      onClick={handleDisableLink}
                      disabled={!pet.tutorAccessToken || !pet.tutorAccessEnabled}
                      className={`font-black text-[9px] uppercase tracking-widest py-3 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                        pet.tutorAccessToken && pet.tutorAccessEnabled
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                          : 'bg-indigo-900/30 text-indigo-400/40 cursor-not-allowed'
                      }`}
                    >
                      <span>🛑</span> Desativar
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateNewLink}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-black text-[9px] uppercase tracking-widest py-3 px-2 rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🔄</span> Novo Link
                    </button>
                  </div>
                </div>

                {/* DADOS BÁSICOS DO TUTOR */}
                <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 text-left md:col-span-2">
                  <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-2">👤 DADOS DO TUTOR E PET</h4>
                  <div className="space-y-2">
                    <StaticRow label="RESPONSÁVEL" value={pet.tutor_nome} />
                    <StaticRow label="TELEFONE" value={pet.telefone} />
                    <StaticRow label="AGENDA DE CRECHE" value={pet.dia_semana} />
                    <StaticRow label="RAÇA" value={pet.raca || 'Não informada'} />
                    <StaticRow label="DATA DE ANIVERSÁRIO" value={(!pet.data_aniversario || pet.data_aniversario === 'Não sei informar') ? 'Não informada' : pet.data_aniversario} />
                  </div>
                </div>
              </>
            )}

            {subTab === 'saude' && (
              <>
                <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">🏥 SAÚDE E RESTRIÇÃO</h4>
                  <div className="space-y-2">
                    <StaticRow label="ALERGIA" value={pet.possui_alergia} color={(pet.possui_alergia || '').toLowerCase() === 'sim' ? 'text-rose-600' : ''} />
                    <StaticRow label="ALIMENTOS PROIBIDOS" value={pet.alimentos_proibidos} />
                    <StaticRow label="DIETA" value={pet.tipo_alimentacao} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">💊 SAÚDE DETALHADA</h4>
                  <div className="space-y-2">
                    <StaticRow label="POSSUI DOENÇA?" value={pet.possui_doenca} color={(pet.possui_doenca || '').toLowerCase() === 'sim' ? 'text-amber-600' : ''} />
                    <StaticRow label="QUAIS DOENÇAS?" value={pet.doenca_qual} />
                    <StaticRow label="PESO ATUAL" value={(!pet.peso_pet || Number(pet.peso_pet) === 0 || pet.peso_pet === '0') ? 'Não informado' : `${pet.peso_pet} KG`} />
                    <StaticRow label="ESCORE CORPORAL" value={pet.escore_corporal} />
                  </div>
                </div>
              </>
            )}

            {subTab === 'rotina' && (
              <>
                <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                  <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-2">💧 HIDRATAÇÃO</h4>
                  <div className="space-y-2">
                    <StaticRow label="INGESTÃO DIÁRIA" value={pet.ingestao_agua} />
                    <StaticRow label="INTERESSE POR ÁGUA" value={pet.interesse_agua} />
                    <StaticRow label="AJUDA / ESTÍMULO" value={pet.ajuda_beber_agua} />
                    <StaticRow label="SEDE PÓS-CRECHE" value={pet.sede_pos_creche} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">📝 OBSERVAÇÕES DO PRONTUÁRIO</h4>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                      {pet.observacoes || "Nenhuma observação especial registrada na ficha mestre."}
                    </p>
                  </div>
                </div>
              </>
            )}

            {subTab === 'alimentacao' && (
              <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">🍱 ALIMENTAÇÃO E DIETA</h4>
                <div className="space-y-2">
                  <StaticRow label="TIPO DE ALIMENTAÇÃO" value={pet.tipo_alimentacao} />
                  <StaticRow label="MARCA DA RAÇÃO" value={pet.marca_racao} />
                  <StaticRow label="QUANTIDADE APROXIMADA" value={pet.quantidade_aproximada} />
                  <StaticRow label="ALIMENTOS PROIBIDOS" value={pet.alimentos_proibidos} />
                  <StaticRow label="COMPORTAMENTO ALIMENTAR" value={pet.comportamento_alimentar} />
                </div>
              </div>
            )}

            {subTab === 'comportamento' && (
              <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm space-y-4 md:col-span-2 text-left">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">🧠 COMPORTAMENTO E ADAPTAÇÃO</h4>
                <div className="space-y-2">
                  <StaticRow label="COMPORTAMENTO AO COMER" value={pet.comportamento_alimentar} />
                  <StaticRow label="ESTÍMULO NECESSÁRIO" value={pet.precisa_estimulo} />
                  <StaticRow label="OBSERVAÇÕES DO PRONTUÁRIO" value={pet.observacoes || 'Nenhuma registrada'} />
                </div>
              </div>
            )}

            {subTab === 'historico' && (
              <div className="md:col-span-2 space-y-3 text-left">
                <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-2 mb-2">📅 HISTÓRICO DE ESTADIAS / CHECKLISTS</h4>
                {history.length === 0 ? (
                  <div className="p-20 text-center bg-white rounded-[40px] opacity-20 font-black uppercase">
                    SEM HISTÓRICO
                  </div>
                ) : (
                  history.map((entry, i) => (
                    <div key={i} className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-black text-slate-800 text-sm">{new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                          {entry.comeu} {entry.observacoes ? `• ${entry.observacoes.substring(0, 30)}...` : ''}
                        </p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black text-white ${entry.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{entry.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'unico' && (
          <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-indigo-50 animate-in zoom-in-95 duration-300">
            <UnicoEdit pets={pets} onSave={onUpdatePet} isEmbedded={true} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="p-20 text-center bg-white rounded-[40px] opacity-20 font-black uppercase">SEM HISTÓRICO</div>
            ) : (
              history.map((entry, i) => (
                <div key={i} className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {entry.comeu} {entry.observacoes ? `• ${entry.observacoes.substring(0, 30)}...` : ''}
                    </p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black text-white ${entry.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{entry.status}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StaticRow: React.FC<{ label: string; value?: string; color?: string }> = ({ label, value, color }) => (
  <div className="flex flex-col border-b border-slate-50 pb-1.5 last:border-0">
    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
    <p className={`text-[11px] font-bold leading-tight ${color || 'text-slate-700'}`}>{value || '-'}</p>
  </div>
);

export default PetChecklist;
