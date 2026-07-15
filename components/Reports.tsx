
import React, { useState, useMemo } from 'react';
import { Pet, ChecklistEntry } from '../types';
import { getStatusEmoji, getStatusColor } from '../utils/status';

interface ReportsProps {
  pets: Pet[];
  checklists: ChecklistEntry[];
}

const Reports: React.FC<ReportsProps> = ({ pets, checklists }) => {
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<'monthly' | 'today'>('today');

  const todayDate = new Date().toISOString().split('T')[0];

  const todayChecklists = useMemo(() => {
    return checklists.filter(c => c.date === todayDate)
      .sort((a, b) => {
        const petA = pets.find(p => p.id === a.petId);
        const petB = pets.find(p => p.id === b.petId);
        return (petA?.pet_nome || '').localeCompare(petB?.pet_nome || '');
      });
  }, [checklists, pets, todayDate]);

  const filteredChecklists = useMemo(() => {
    return checklists.filter(c => {
      const isSamePet = selectedPetId ? c.petId === selectedPetId : true;
      const isSameMonth = c.date.startsWith(selectedMonth);
      return isSamePet && isSameMonth;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [checklists, selectedPetId, selectedMonth]);

  const stats = useMemo(() => {
    const counts = { 'OK': 0, 'Atenção': 0, 'Alerta': 0 };
    filteredChecklists.forEach(c => {
      if (c.status in counts) counts[c.status as keyof typeof counts]++;
    });
    return counts;
  }, [filteredChecklists]);

  const handleWhatsAppNotify = (pet: Pet | undefined, entry: ChecklistEntry) => {
    const petName = pet?.pet_nome || 'amigão';
    const tutorName = pet?.tutor_nome ? `${pet.tutor_nome}, ` : '';
    
    const foodStatus = entry.comeu;
    const nutritionNote = (foodStatus === 'Não comeu' || foodStatus === 'Comeu metade' || foodStatus === 'Comeu menos da metade') 
      ? "\n\nCaso continue apresentando falta de apetite, uma consulta com uma nutricionista veterinária pode ser uma ótima opção para ajustar a dieta de forma personalizada."
      : "";
    const obs = entry.observacoes ? `\n\nObservação: ${entry.observacoes}` : '';

    const messages = {
      'OK': `Olá ${tutorName}! Passando para dizer que o ${petName} está tendo um dia maravilhoso hoje! Comeu tudo e está muito feliz. ${obs}`,
      'Atenção': `Olá ${tutorName}! O ${petName} está conosco hoje. Ele ${foodStatus === 'Comeu tudo' ? 'comeu bem' : foodStatus.toLowerCase()}. Demonstrou um comportamento um pouco diferente do habitual, mas está bem! Fiquem de olho em casa qualquer coisa.${nutritionNote} ${obs}`,
      'Alerta': `Olá ${tutorName}! Gostaríamos de informar que o ${petName} hoje ${foodStatus === 'Não comeu' ? 'não quis comer' : 'comeu pouco'}. Recomendamos uma atenção especial à saúde dele. Qualquer dúvida estamos à disposição.${nutritionNote}${obs}`
    };

    const text = messages[entry.status as keyof typeof messages] || messages['Atenção'];
    
    // Clean phone number
    const phone = pet?.telefone?.replace(/\D/g, '') || '';
    
    if (!phone) {
      navigator.clipboard.writeText(text);
      alert('Pet sem telefone cadastrado. Mensagem copiada para o clipboard! ✅');
      return;
    }

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Relatórios</h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
          <button 
            onClick={() => setActiveTab('today')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'today' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Hoje 📅
          </button>
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monthly' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Mensal 📊
          </button>
        </div>
      </div>

      {activeTab === 'today' ? (
        <div className="space-y-6">
          <div className="bg-emerald-50 p-6 rounded-[35px] border border-emerald-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-black text-emerald-900 leading-tight">Envio em Massa</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Envie todos os relatórios de hoje rapidamente</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-emerald-700">{todayChecklists.length}</span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Pets com Diário</span>
            </div>
            {todayChecklists.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm(`Deseja abrir ${todayChecklists.length} abas do WhatsApp? O seu navegador pode bloquear popups.`)) {
                    todayChecklists.forEach((c, index) => {
                      const pet = pets.find(p => p.id === c.petId);
                      setTimeout(() => {
                        handleWhatsAppNotify(pet, c);
                      }, index * 1000); // 1 second delay between each to help with browser blocks
                    });
                  }
                }}
                className="px-6 py-3 bg-emerald-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 transition-all"
              >
                🚀 Enviar Todos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayChecklists.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200 opacity-40">
                <span className="text-6xl block mb-4">📝</span>
                <p className="font-black text-slate-800 uppercase tracking-widest text-sm">Nenhum diário preenchido hoje ainda.</p>
              </div>
            ) : (
              todayChecklists.map((c, i) => {
                const pet = pets.find(p => p.id === c.petId);
                return (
                  <div key={i} className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white ${getStatusColor(c.status)} text-white`}>
                        {getStatusEmoji(c.status)}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-none mb-1">{pet?.pet_nome || 'Pet Removido'}</p>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{c.status} • {c.comeu}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleWhatsAppNotify(pet, c)}
                      className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                      title="Enviar WhatsApp"
                    >
                      💬
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mês de Referência</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-4 bg-white border-2 border-emerald-50 rounded-[25px] font-black text-emerald-800 outline-none focus:border-emerald-300 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Filtrar por Pet</label>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                className="w-full p-4 bg-white border-2 border-emerald-50 rounded-[25px] font-black text-emerald-800 outline-none focus:border-emerald-300 shadow-sm appearance-none"
              >
                <option value="">Todos os Pets</option>
                {pets.map(p => (
                  <option key={p.id} value={p.id}>{p.pet_nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 p-5 rounded-[35px] border border-emerald-100 text-center shadow-sm">
              <span className="text-3xl block mb-1">🟢</span>
              <span className="text-2xl font-black text-emerald-700">{stats.OK}</span>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">DIAS OK</p>
            </div>
            <div className="bg-amber-50 p-5 rounded-[35px] border border-amber-100 text-center shadow-sm">
              <span className="text-3xl block mb-1">🟡</span>
              <span className="text-2xl font-black text-amber-700">{stats.Atenção}</span>
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">ATENÇÃO</p>
            </div>
            <div className="bg-rose-50 p-5 rounded-[35px] border border-rose-100 text-center shadow-sm">
              <span className="text-3xl block mb-1">🔴</span>
              <span className="text-2xl font-black text-rose-700">{stats.Alerta}</span>
              <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">ALERTA</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Histórico Detalhado</h3>
            {filteredChecklists.length === 0 ? (
              <p className="text-slate-300 text-center py-16 bg-slate-50 rounded-[40px] font-bold italic">Sem registros para este filtro.</p>
            ) : (
              <div className="space-y-3">
                {filteredChecklists.map((c, i) => {
                  const pet = pets.find(p => p.id === c.petId);
                  return (
                    <div key={i} className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner border border-white ${getStatusColor(c.status)} text-white`}>
                          {getStatusEmoji(c.status)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 leading-none mb-1">{pet?.pet_nome || 'Pet Removido'} • {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          <p className="text-[10px] font-bold text-slate-400 italic">"{c.observacoes || 'Sem observações'}"</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleWhatsAppNotify(pet, c)}
                        className="w-full md:w-auto px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                      >
                        Reenviar WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
