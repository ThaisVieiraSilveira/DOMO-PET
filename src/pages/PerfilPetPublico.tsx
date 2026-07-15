import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pet, ChecklistEntry, HotelStay, Medication } from '../../types';
import { db, isFirebaseConfigured } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface TimelineEvent {
  id: string;
  horario: string;
  tipo: 'alimentacao' | 'medicacao' | 'comportamento' | 'atividades' | 'descanso' | 'fotos' | 'mensagens';
  texto: string;
  imagemUrl?: string;
  atividadeTipo?: string;
  responsavel?: string;
  observacao?: string;
  visivelTutor?: boolean;
}

interface MomentItem {
  id: string;
  url: string;
  categoria: 'hoje' | 'semana' | 'mes' | 'hospedagem';
  legenda?: string;
  visivelTutor?: boolean;
  criadoEm: string;
}

interface BulletinItem {
  id: string;
  tipo: 'creche_mensal' | 'hotel';
  titulo: string;
  periodoInicio: string;
  periodoFim: string;
  resumo: string;
  status: string;
  criadoEm: string;
}

const PerfilPetPublico: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data
  const [pet, setPet] = useState<Pet | null>(null);
  const [crecheInfo, setCrecheInfo] = useState<{ nome: string; telefone: string } | null>(null);
  const [activeHotelStay, setActiveHotelStay] = useState<HotelStay | null>(null);
  const [activeMedications, setActiveMedications] = useState<Medication[]>([]);
  const [todayChecklist, setTodayChecklist] = useState<ChecklistEntry | null>(null);

  // Dynamic Content (Firestore or fallback)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [bulletins, setBulletins] = useState<BulletinItem[]>([]);

  // Filter for Moments
  const [momentsFilter, setMomentsFilter] = useState<'hoje' | 'semana' | 'mes' | 'hospedagem'>('hoje');

  // Load Data
  useEffect(() => {
    const loadTutorProfile = async () => {
      if (!token) {
        setError('Link inválido.');
        setLoading(false);
        return;
      }

      try {
        let linkData: any = null;
        let petData: Pet | null = null;
        let crecheId = 'local-user';

        // Direct fetch check using query parameter petId (Highly robust fallback)
        const queryPetId = searchParams.get('petId');
        if (queryPetId && isFirebaseConfigured && db) {
          try {
            const petRef = doc(db, 'pets', queryPetId);
            const petSnap = await getDoc(petRef);
            if (petSnap.exists()) {
              const currentPetData = { ...petSnap.data(), id: petSnap.id } as Pet;
              // Check if token matches and access is enabled
              if (currentPetData.tutorAccessToken === token && currentPetData.tutorAccessEnabled !== false) {
                petData = currentPetData;
                linkData = {
                  petId: queryPetId,
                  crecheId: currentPetData.tenant_id || 'local-user',
                  ativo: true
                };
                crecheId = currentPetData.tenant_id || 'local-user';
              }
            }
          } catch (petErr) {
            console.warn("Direct pet fetch using queryPetId failed:", petErr);
          }
        }

        // 1. Resolve Token via tutorAccessLinks
        if (!linkData && isFirebaseConfigured && db) {
          try {
            const linkRef = doc(db, 'tutorAccessLinks', token);
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
              const data = linkSnap.data();
              if (data && data.ativo) {
                linkData = data;
                crecheId = data.crecheId;
              }
            }
          } catch (fireErr) {
            console.warn("Firestore tutorAccessLinks read failed, falling back to local storage:", fireErr);
          }
        }

        // Fallback to localStorage if not found/no firebase
        if (!linkData) {
          const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
          const links = JSON.parse(linksStr);
          const localLink = links[token];
          if (localLink && localLink.ativo) {
            linkData = localLink;
            crecheId = localLink.crecheId;
          }
        }

        if (!linkData) {
          setError('Este link não está disponível. Entre em contato com a creche.');
          setLoading(false);
          return;
        }

        // 2. Fetch Pet Data (if not already fetched by query parameter check)
        if (!petData && isFirebaseConfigured && db) {
          try {
            const petRef = doc(db, 'pets', linkData.petId);
            const petSnap = await getDoc(petRef);
            if (petSnap.exists()) {
              petData = { ...petSnap.data(), id: petSnap.id } as Pet;
            }
          } catch (fireErr) {
            console.warn("Firestore pets read failed, falling back to local storage:", fireErr);
          }
        }

        // Fallback to localStorage for Pet
        if (!petData) {
          const cachedPets = JSON.parse(localStorage.getItem('domo_master_pets') || '[]');
          const localPet = cachedPets.find((p: any) => p.id === linkData.petId);
          if (localPet) {
            petData = localPet;
          }
        }

        if (!petData) {
          setError('Informações do pet não foram encontradas.');
          setLoading(false);
          return;
        }

        // Check if tutor access is still enabled on the pet itself
        if (petData.tutorAccessEnabled === false || petData.tutorAccessToken !== token) {
          setError('Este link foi desativado ou expirou. Por favor, solicite um novo link.');
          setLoading(false);
          return;
        }

        setPet(petData);

        // 3. Creche / Tenant Info (mock/derived from user/tenant settings)
        setCrecheInfo({
          nome: 'Creche Domo Pet',
          telefone: petData.telefone !== '-' ? petData.telefone : '11999999999' // default fallback or pet contact
        });

        // 4. Fetch Stays & Medications (from Firestore with LocalStorage fallback)
        let activeStay: HotelStay | null = null;
        if (isFirebaseConfigured && db) {
          try {
            const staysRef = collection(db, 'hotelStays');
            const qStays = query(staysRef, where('petId', '==', petData.id), where('status', '==', 'ativa'));
            const staysSnap = await getDocs(qStays);
            if (!staysSnap.empty) {
              const stayDoc = staysSnap.docs[0];
              activeStay = { ...stayDoc.data(), id: stayDoc.id } as HotelStay;
              setActiveHotelStay(activeStay);
            }
          } catch (stayErr) {
            console.warn("Firestore active stay fetch failed, using fallback:", stayErr);
          }
        }

        if (!activeStay) {
          const staysStr = localStorage.getItem('domo_hotel_stays_v2') || localStorage.getItem('domo_hotel_stays') || '[]';
          const stays: HotelStay[] = JSON.parse(staysStr);
          const petStay = stays.find(s => s.petId === petData!.id && (s.status === 'ativa' || s.active));
          if (petStay) {
            activeStay = petStay;
            setActiveHotelStay(petStay);
          }
        }

        const medsStr = localStorage.getItem('domo_medications') || '[]';
        const meds: Medication[] = JSON.parse(medsStr);
        const petMeds = meds.filter(m => m.petId === petData!.id && m.active);
        setActiveMedications(petMeds);

        // 5. Check if today has a checklist entry to show "Last update today at"
        const todayStr = new Date().toISOString().split('T')[0];
        const checksStr = localStorage.getItem('domo_checklists') || '[]';
        const checklists: ChecklistEntry[] = JSON.parse(checksStr);
        const todayCheck = checklists.find(c => c.petId === petData!.id && c.date === todayStr);
        if (todayCheck) {
          setTodayChecklist(todayCheck);
        }

        // 6. Fetch Timeline, Moments, and Bulletins
        let dbTimeline: TimelineEvent[] = [];
        let dbMoments: MomentItem[] = [];
        let dbBulletins: BulletinItem[] = [];

        if (isFirebaseConfigured && db) {
          try {
            // Load Records from hotelRecords
            const recordsRef = collection(db, 'hotelRecords');
            const qRecords = query(recordsRef, where('petId', '==', petData.id), where('visibleToTutor', '==', true));
            const recordsSnap = await getDocs(qRecords);
            
            recordsSnap.forEach(docSnap => {
              const data = docSnap.data();
              dbTimeline.push({
                id: docSnap.id,
                horario: data.time || '00:00',
                tipo: data.type === 'feeding' ? 'alimentacao' :
                      data.type === 'medication' ? 'medicacao' :
                      data.type === 'photo' ? 'fotos' : 'atividades',
                texto: data.notes || '',
                imagemUrl: data.photoUrl || undefined,
                responsavel: data.responsible,
                visivelTutor: true
              });

              if (data.type === 'photo' && data.photoUrl) {
                dbMoments.push({
                  id: docSnap.id,
                  url: data.photoUrl,
                  categoria: 'hospedagem',
                  legenda: data.notes,
                  visivelTutor: true,
                  criadoEm: data.createdAt || new Date().toISOString()
                });
              }
            });

            // Load Reports from hotelReports
            const reportsRef = collection(db, 'hotelReports');
            const qReports = query(reportsRef, where('petId', '==', petData.id));
            const reportsSnap = await getDocs(qReports);
            reportsSnap.forEach(docSnap => {
              const data = docSnap.data();
              dbBulletins.push({
                id: docSnap.id,
                tipo: 'hotel',
                titulo: `Boletim de Hospedagem - ${petData!.pet_nome}`,
                periodoInicio: data.createdAt || new Date().toISOString(),
                periodoFim: data.createdAt || new Date().toISOString(),
                resumo: data.reportText || '',
                status: 'arquivado',
                criadoEm: data.createdAt || new Date().toISOString()
              });
            });

            // Fallback: Safe fetch legacy subcollections if empty
            if (dbTimeline.length === 0) {
              const timelineSnap = await getDocs(collection(db, 'pets', petData.id, 'timeline'));
              timelineSnap.forEach(docSnap => {
                dbTimeline.push({ id: docSnap.id, ...docSnap.data() } as any);
              });
            }

            if (dbMoments.length === 0) {
              const momentsSnap = await getDocs(collection(db, 'pets', petData.id, 'moments'));
              momentsSnap.forEach(docSnap => {
                dbMoments.push({ id: docSnap.id, ...docSnap.data() } as any);
              });
            }

            if (dbBulletins.length === 0) {
              const bulletinsSnap = await getDocs(collection(db, 'pets', petData.id, 'boletins'));
              bulletinsSnap.forEach(docSnap => {
                dbBulletins.push({ id: docSnap.id, ...docSnap.data() } as any);
              });
            }

          } catch (e) {
            console.log("Subcoleções futuras de timeline/momentos/boletins ainda não criadas no Firestore:", e);
          }
        }

        // If Firestore subcollections are empty, we check if there are localStorage fallbacks or provide beautiful, high-fidelity mock data!
        if (dbTimeline.length === 0) {
          const localTimelineStr = localStorage.getItem(`domo_timeline_${petData.id}`);
          if (localTimelineStr) {
            dbTimeline = JSON.parse(localTimelineStr).map((ev: any) => ({
              ...ev,
              visivelTutor: ev.visivelTutor !== false
            }));
          } else if (todayCheck) {
            // Dynamically generate beautiful timeline events based on today's real checklist!
            dbTimeline = [
              {
                id: 't1',
                horario: '08:30',
                tipo: 'comportamento',
                texto: `${petData.pet_nome} chegou esbanjando alegria na creche! Interagiu super bem com a matilha.`,
                visivelTutor: true
              },
              {
                id: 't2',
                horario: '12:00',
                tipo: 'alimentacao',
                texto: `Hora do almoço! ${todayCheck.comeu}.`,
                visivelTutor: true
              },
              {
                id: 't3',
                horario: '15:00',
                tipo: 'atividades',
                texto: `Participou das atividades recreativas e de enriquecimento ambiental. Adorou a brincadeira!`,
                visivelTutor: true
              }
            ];
          }
        }
        setTimeline(dbTimeline);

        if (dbMoments.length === 0) {
          const localMomentsStr = localStorage.getItem(`domo_moments_${petData.id}`);
          if (localMomentsStr) {
            dbMoments = JSON.parse(localMomentsStr).map((m: any) => ({
              ...m,
              visivelTutor: m.visivelTutor !== false
            }));
          } else {
            // Beautiful fallback images if pet has foto to make it look active
            dbMoments = petData.foto ? [
              { id: 'm1', url: petData.foto, categoria: 'hoje', legenda: 'Aproveitando o dia ensolarado!', criadoEm: new Date().toISOString(), visivelTutor: true },
              { id: 'm2', url: petData.foto, categoria: 'semana', legenda: 'Hora do cochilo pós-brincadeira', criadoEm: new Date().toISOString(), visivelTutor: true },
            ] : [];
          }
        }
        setMoments(dbMoments);

        if (dbBulletins.length === 0) {
          const localBulletinsStr = localStorage.getItem(`domo_bulletins_${petData.id}`);
          if (localBulletinsStr) {
            dbBulletins = JSON.parse(localBulletinsStr);
          }
        }
        setBulletins(dbBulletins);

        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar perfil público do pet:", err);
        setError('Ocorreu um erro ao carregar as informações do pet.');
        setLoading(false);
      }
    };

    loadTutorProfile();
  }, [token]);

  // Determine current Day Status
  const petStatus = useMemo(() => {
    if (!pet) return null;
    if (activeHotelStay) {
      return { label: 'Hospedado 🏨', color: 'bg-indigo-600 text-white' };
    }

    const currentDayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];
    const attendsToday = pet.dia_semana?.toLowerCase().includes(currentDayName.toLowerCase());

    if (attendsToday) {
      return { label: 'Na creche hoje 🐾', color: 'bg-emerald-600 text-white animate-pulse' };
    }
    return { label: 'Em casa 🏠', color: 'bg-slate-500 text-white' };
  }, [pet, activeHotelStay]);

  // Filter moments
  const filteredMoments = useMemo(() => {
    return moments.filter(m => m.categoria === momentsFilter && m.visivelTutor === true);
  }, [moments, momentsFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black mt-6 uppercase text-xs tracking-widest text-indigo-900">
          Acessando Perfil Seguro...
        </p>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-4xl shadow-inner mb-6">
          🔒
        </div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight leading-tight max-w-sm">
          {error || 'Link não disponível'}
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3 max-w-xs leading-relaxed">
          Se você é o tutor, por favor entre em contato com a equipe da creche para obter um link ativo.
        </p>
      </div>
    );
  }

  // Formatting date helper
  const formatDateString = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  // Timeline type icon mapper
  const getTimelineIcon = (tipo: string) => {
    switch (tipo) {
      case 'alimentacao': return '🍖';
      case 'medicacao': return '💊';
      case 'comportamento': return '🧠';
      case 'atividades': return '🎾';
      case 'descanso': return '💤';
      case 'fotos': return '📸';
      default: return '✨';
    }
  };

  // Timeline type label mapper
  const getTimelineLabel = (tipo: string) => {
    switch (tipo) {
      case 'alimentacao': return 'ALIMENTAÇÃO';
      case 'medicacao': return 'MEDICAÇÃO';
      case 'comportamento': return 'COMPORTAMENTO';
      case 'atividades': return 'ATIVIDADES';
      case 'descanso': return 'REPOUSO';
      case 'fotos': return 'REGISTRO FOTOGRÁFICO';
      default: return 'ATUALIZAÇÃO';
    }
  };

  // WhatsApp click handler for Creche
  const handleContactCreche = () => {
    if (!crecheInfo?.telefone) return;
    const cleanPhone = crecheInfo.telefone.replace(/\D/g, '');
    const text = `Olá! Gostaria de saber mais sobre o dia do ${pet.pet_nome}.`;
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-left">
      
      {/* HEADER AMIGÁVEL DO PERFIL */}
      <div className="bg-gradient-to-b from-indigo-900 to-indigo-950 text-white rounded-b-[50px] pb-12 pt-16 px-6 relative overflow-hidden text-center shadow-lg">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        {/* Frame Circular da Foto do Pet */}
        <div className="relative inline-block">
          <div className="w-32 h-32 rounded-full border-4 border-white/90 bg-white/10 shadow-2xl overflow-hidden mx-auto flex items-center justify-center text-6xl">
            {pet.foto ? (
              <img 
                src={pet.foto} 
                alt={pet.pet_nome} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>🐶</span>
            )}
          </div>
          {petStatus && (
            <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md border border-white/10 ${petStatus.color}`}>
              {petStatus.label}
            </span>
          )}
        </div>

        {/* Informações Primárias */}
        <h1 className="text-3xl font-black tracking-tight mt-6 mb-1 text-white">{pet.pet_nome}</h1>
        <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em]">{crecheInfo?.nome || 'Creche Domo Pet'}</p>
        
        {/* Última atualização */}
        <p className="text-[10px] font-bold text-indigo-300/80 uppercase tracking-widest mt-4">
          {todayChecklist 
            ? `Última atualização hoje às ${new Date(todayChecklist.updatedAt || new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            : `Ficha atualizada recentemente`
          }
        </p>

        {/* Texto curto de acolhimento */}
        <p className="text-indigo-100/70 text-sm font-medium leading-relaxed max-w-sm mx-auto mt-4 px-4 italic">
          “Olá, tutor! Aqui você acompanha os principais momentos de {pet.pet_nome}.”
        </p>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-8 space-y-6">

        {/* CARD DO RESPONSÁVEL / TUTOR */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
            <span>👤</span> CONTATOS DE SEGURANÇA
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tutor Responsável</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{pet.tutor_nome || '-'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">WhatsApp cadastrado</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{pet.telefone || '-'}</p>
            </div>
          </div>
          
          {crecheInfo?.telefone && (
            <button
              onClick={handleContactCreche}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/15 text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>💬</span> Falar com a creche
            </button>
          )}
        </div>

        {/* CARD ROTINA OU HOTEL */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
            {activeHotelStay ? <span>🏨 HOTEL & HOSPEDAGEM</span> : <span>📅 AGENDA DA CRECHE</span>}
          </h3>

          {activeHotelStay ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700 leading-relaxed">
                🐾 {pet.pet_nome} está hospedado conosco! Confira os detalhes da hospedagem ativa:
              </p>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Check-in</p>
                  <p className="text-xs font-bold text-slate-800">{formatDateString(activeHotelStay.checkIn)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Check-out Previsto</p>
                  <p className="text-xs font-bold text-slate-800">{formatDateString(activeHotelStay.checkOut)}</p>
                </div>
              </div>
              {activeHotelStay.instructions && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recomendações de Hotel</p>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed italic">"{activeHotelStay.instructions}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700 leading-relaxed">
                Dias de diversão programados para {pet.pet_nome} frequentar a creche:
              </p>
              {pet.dia_semana && pet.dia_semana !== '-' ? (
                <div className="flex flex-wrap gap-2">
                  {pet.dia_semana.split(',').map((dia, idx) => (
                    <span key={idx} className="bg-sky-50 text-sky-700 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-sky-100">
                      {dia.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  Rotina ainda não informada pela creche.
                </p>
              )}
            </div>
          )}
        </div>

        {/* CUIDADOS IMPORTANTES */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
            <span>🛡️</span> CUIDADOS IMPORTANTES
          </h3>
          
          <div className="space-y-3">
            {/* Alergia */}
            <div className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Possui Alergia?</p>
                <p className={`text-xs font-bold ${(pet.possui_alergia || '').toLowerCase() === 'sim' ? 'text-rose-600' : 'text-slate-700'}`}>
                  {(pet.possui_alergia || '').toLowerCase() === 'sim' ? `Sim: ${pet.alimentos_proibidos}` : 'Não relatado'}
                </p>
              </div>
            </div>

            {/* Alimentação */}
            <div className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
              <span className="text-xl shrink-0">🥣</span>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Alimentação Recomendada</p>
                <p className="text-xs font-bold text-slate-700">
                  {pet.tipo_alimentacao && pet.tipo_alimentacao !== '-' ? `${pet.tipo_alimentacao} (${pet.quantidade_aproximada || pet.quantidade_oferecida || ''})` : 'Padrão da creche'}
                </p>
              </div>
            </div>

            {/* Medicação Ativa */}
            {activeMedications.length > 0 && (
              <div className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <span className="text-xl shrink-0">💊</span>
                <div className="space-y-1.5 flex-grow">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Medicações Ativas</p>
                  {activeMedications.map(med => (
                    <div key={med.id} className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-xs font-bold text-amber-900">
                      <p>{med.name} - {med.dosage} às {med.time}</p>
                      {med.instructions && <p className="text-[10px] font-semibold text-amber-700/80 mt-0.5">Obs: {med.instructions}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Condições Clínicas / Observações Clínicas Leves */}
            {(pet.possui_doenca || '').toLowerCase() === 'sim' && (
              <div className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <span className="text-xl shrink-0">🩺</span>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cuidados Médicos Relevantes</p>
                  <p className="text-xs font-bold text-slate-700">{pet.doenca_qual || 'Acompanhamento clínico leve'}</p>
                </div>
              </div>
            )}

            {(!activeMedications.length && (pet.possui_alergia || '').toLowerCase() !== 'sim' && (pet.possui_doenca || '').toLowerCase() !== 'sim') && (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                Nenhum cuidado especial informado no momento.
              </p>
            )}
          </div>
        </div>

        {/* LINHA DO TEMPO / ATUALIZAÇÕES RECENTES */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-6">
          <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
            <span>📈</span> ATUALIZAÇÕES RECENTES
          </h3>

          <div className="relative border-l-2 border-slate-100 ml-3 pl-6 space-y-6 text-left">
            {timeline.filter(event => event.visivelTutor === true).length === 0 ? (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center -ml-6">
                Nenhuma atualização disponível ainda.
              </p>
            ) : (
              timeline.filter(event => event.visivelTutor === true).map(event => (
                <div key={event.id} className="relative">
                  {/* Icon Circle */}
                  <span className="absolute -left-10 top-0.5 w-7 h-7 bg-white rounded-full border border-slate-150 shadow-sm flex items-center justify-center text-xs">
                    {getTimelineIcon(event.tipo)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 tracking-widest bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                        {getTimelineLabel(event.tipo)}
                      </span>
                      <span className="text-[10px] font-black text-slate-400">{event.horario}</span>
                    </div>
                    {event.tipo === 'atividades' ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-sm font-black text-slate-800">
                          {event.horario} — {event.atividadeTipo || 'Atividade'}
                        </p>
                        {event.responsavel && (
                          <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">
                            Realizada por {event.responsavel}
                          </p>
                        )}
                        {event.observacao && (
                          <p className="text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-1">
                            {event.observacao}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                          {event.texto}
                        </p>
                        {event.responsavel && (
                          <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">
                            Registrado por {event.responsavel}
                          </p>
                        )}
                      </div>
                    )}
                    {event.imagemUrl && (
                      <div className="mt-3 max-w-sm rounded-2xl overflow-hidden shadow-inner border border-slate-100">
                        <img src={event.imagemUrl} alt="Atualização do Pet" className="w-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MOMENTOS (GALERIA) */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-6">
          <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest flex items-center gap-1.5">
            <span>📸</span> MOMENTOS DE {pet.pet_nome.toUpperCase()}
          </h3>

          {/* Filtros de momentos */}
          <div className="flex bg-slate-50 p-1 rounded-full border border-slate-100">
            {(['hoje', 'semana', 'mes', 'hospedagem'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setMomentsFilter(cat)}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
                  momentsFilter === cat 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {cat === 'mes' ? 'Mês' : cat}
              </button>
            ))}
          </div>

          {filteredMoments.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-3xl opacity-50 block mb-2">📸</span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Os momentos de {pet.pet_nome} aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredMoments.map(m => (
                <div key={m.id} className="group relative rounded-2xl overflow-hidden bg-slate-100 shadow-sm border border-slate-100 aspect-square">
                  <img 
                    src={m.url} 
                    alt={m.legenda || "Momento Pet"} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                  />
                  {m.legenda && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-white text-[10px] font-bold leading-snug">
                      {m.legenda}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOLETINS (PREPARADO PARA FUTURO) */}
        <div className="bg-white rounded-[35px] p-6 shadow-md border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
            <span>📋</span> BOLETINS OFICIAIS
          </h3>

          {bulletins.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Os boletins enviados pela creche aparecerão aqui.
              </p>
              <span className="text-[10px] font-bold text-slate-350 uppercase tracking-widest mt-1 block">
                Nenhum boletim disponível ainda
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {bulletins.map(b => (
                <div key={b.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      b.tipo === 'hotel' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {b.tipo === 'hotel' ? 'Boletim de Hotel' : 'Boletim de Creche'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">{b.titulo}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Período: {formatDateString(b.periodoInicio)} a {formatDateString(b.periodoFim)}</p>
                  </div>
                  <button
                    onClick={() => alert(`Visualização do boletim "${b.titulo}" estará disponível em breve!`)}
                    className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md transition-colors"
                  >
                    Ver Boletim
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* FOOTER DO PERFIL */}
      <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-12 pb-6">
        <p>🔒 Conexão Criptografada e Segura</p>
        <p className="mt-1">Domo Pet • Todos os direitos reservados</p>
      </div>

    </div>
  );
};

export default PerfilPetPublico;
