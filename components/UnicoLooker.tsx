import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pet } from '../types';
import { useTenant } from '../src/hooks/useTenant';
import { Sparkles, Search, AlertTriangle, Heart, UserCheck, ShieldAlert, Smile, Zap, BookOpen } from 'lucide-react';

interface UnicoLookerProps {
  pets: Pet[];
}

const UnicoLooker: React.FC<UnicoLookerProps> = ({ pets }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'alertas' | 'pendentes'>('all');

  const { nome: domoNome, cor: domoCor } = useTenant();

  const filteredPets = useMemo(() => {
    return pets.filter(pet => {
      const matchesSearch = 
        (pet.pet_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pet.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pet.tutor_nome || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const hasAlerts = (pet.alertas_importantes || []).length > 0;
      const isPending = !pet.ultimo_responsavel_atualizacao;

      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'alertas' && hasAlerts) ||
        (filterType === 'pendentes' && isPending);

      return matchesSearch && matchesFilter;
    }).sort((a, b) => a.pet_nome.localeCompare(b.pet_nome));
  }, [pets, searchTerm, filterType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left">
      {/* HEADER ADMINISTRATIVE */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -mr-24 -mt-24 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" /> Fichas Únicas
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">Único • Gestão Comportamental</h1>
            <p className="text-slate-400 font-medium text-xs leading-relaxed max-w-xl">
              Prontuário de rotinas, amizades, enriquecimento ambiental e controle de revisões mensais da Ficha Mestre da matilha.
            </p>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-white text-slate-900 shadow-md' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('alertas')}
              className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'alertas' 
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ⚠️ Com Alertas
            </button>
            <button
              onClick={() => setFilterType('pendentes')}
              className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'pendentes' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ⏳ Revisão Pendente
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative group">
        <input 
          type="text" 
          placeholder="Buscar pet por nome, código ou tutor..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-6 py-5 bg-white border border-slate-150 rounded-[28px] font-bold text-slate-700 placeholder-slate-400 outline-none shadow-sm group-hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm"
        />
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl opacity-20">🔎</span>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">PET / ID</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">PERFIL COMPORTAMENTAL</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">ALERTAS OPERACIONAIS</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">ATIVIDADES / AMIZADES</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">REVISÃO MENSAL</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPets.map((pet) => {
                const behaviors = pet.perfil_comportamental || [];
                const alerts = pet.alertas_importantes || [];
                const activities = pet.atividades_favoritas || [];
                const friendshipsCount = (pet.amizades || []).length;

                return (
                  <tr key={pet.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* PET / ID */}
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform overflow-hidden border border-slate-200">
                          {pet.foto ? (
                            <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            "🐶"
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 leading-none mb-1 group-hover:text-indigo-600 transition-colors">{pet.pet_nome}</p>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{pet.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* PERFIL COMPORTAMENTAL */}
                    <td className="p-6">
                      {behaviors.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {behaviors.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[8px] font-black text-indigo-600 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                              {tag}
                            </span>
                          ))}
                          {behaviors.length > 3 && (
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-md">
                              +{behaviors.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[8px] font-black uppercase italic tracking-widest">Sem perfil</span>
                      )}
                    </td>

                    {/* ALERTAS OPERACIONAIS */}
                    <td className="p-6">
                      {alerts.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {alerts.map(tag => (
                            <span key={tag} className="text-[8px] font-black text-amber-700 uppercase tracking-tighter bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50 flex items-center gap-1">
                              <span>🚨</span> {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-500 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest">Nenhum</span>
                      )}
                    </td>

                    {/* ATIVIDADES & AMIZADES */}
                    <td className="p-6 space-y-1.5">
                      {activities.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {activities.slice(0, 2).map(act => (
                            <span key={act} className="text-[8px] font-bold text-sky-600 uppercase tracking-tighter bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100/50">
                              🎾 {act}
                            </span>
                          ))}
                        </div>
                      )}
                      <div>
                        {friendshipsCount > 0 ? (
                          <span className="text-rose-500 bg-rose-50 border border-rose-100/40 px-2 py-0.5 rounded-full font-black text-[8px] uppercase tracking-wider flex items-center gap-1 w-max">
                            ❤️ {friendshipsCount} {friendshipsCount === 1 ? 'Amigo' : 'Amigos'}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[8px] font-black uppercase italic tracking-widest">Sem amizades</span>
                        )}
                      </div>
                    </td>

                    {/* REVISÃO MENSAL */}
                    <td className="p-6">
                      {pet.ultimo_responsavel_atualizacao ? (
                        <div>
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg font-black text-[8px] uppercase tracking-wider block w-max">
                            📋 {pet.ultimo_mes_atualizacao}
                          </span>
                          <p className="text-[8px] font-extrabold text-slate-400 mt-0.5 uppercase tracking-wide">Por {pet.ultimo_responsavel_atualizacao}</p>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-lg font-black text-[8px] uppercase tracking-wider block w-max animate-pulse">
                          ⚠️ Pendente
                        </span>
                      )}
                    </td>

                    {/* AÇÕES */}
                    <td className="p-6">
                      <div className="flex items-center justify-center">
                        <button 
                          onClick={() => navigate(`/unico/${pet.id}`)}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3" /> ABRIR ÚNICO
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredPets.length === 0 && (
            <div className="p-32 text-center flex flex-col items-center justify-center opacity-20">
              <span className="text-7xl mb-4">🔦</span>
              <p className="font-black text-slate-800 uppercase tracking-[0.3em] text-sm">Nenhum pet encontrado na busca comportamental.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-8 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] py-4">
        <span>DOMO Behavioral Intelligence</span>
        <span>Filtered: {filteredPets.length} of {pets.length} pets</span>
      </div>
    </div>
  );
};

export default UnicoLooker;
