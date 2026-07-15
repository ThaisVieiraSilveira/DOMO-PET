
import React, { useMemo, useState } from 'react';
import { Pet, ChecklistEntry } from '../types';
import { getStatusColor, getStatusEmoji } from '../utils/status';

interface ChecklistLookerProps {
  pets: Pet[];
  checklists: ChecklistEntry[];
}

const ChecklistLooker: React.FC<ChecklistLookerProps> = ({ pets, checklists }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const entries = useMemo(() => {
    return checklists
      .filter(c => c.date === selectedDate)
      .map(c => {
        const pet = pets.find(p => p.id === c.petId);
        return { 
          ...c, 
          pet_nome: pet?.pet_nome || '?', 
          id: pet?.id || c.petId,
          dia_semana: pet?.dia_semana || '-'
        };
      })
      .sort((a, b) => a.pet_nome.localeCompare(b.pet_nome));
  }, [checklists, selectedDate, pets]);

  const stats = useMemo(() => {
    const counts = { OK: 0, Atenção: 0, Alerta: 0 };
    entries.forEach(e => {
      if (e.status in counts) counts[e.status as keyof typeof counts]++;
    });
    return counts;
  }, [entries]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-4xl font-black tracking-tighter">Audit de Diários</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Looker Analytics • Histórico Operacional</p>
            </div>
            
            {/* ALERTAS STATUS - Legenda e Contagem */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">ANIMAL OK: {stats.OK}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">ALERTA: {stats.Atenção}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">PERIGO: {stats.Alerta}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-5 rounded-[30px] border border-white/10 backdrop-blur-md flex flex-col min-w-[200px]">
            <span className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-1">DATA DE REFERÊNCIA</span>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-black text-2xl outline-none cursor-pointer text-white focus:text-emerald-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">PET / ID</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">STATUS</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">DIA SEMANAL</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">ALIMENTAÇÃO</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">OBSERVAÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6">
                    <p className="font-black text-slate-800 leading-none mb-1 group-hover:text-emerald-600 transition-colors">{entry.pet_nome}</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{entry.id}</p>
                  </td>
                  <td className="p-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black text-white shadow-sm flex items-center gap-1.5 w-fit ${getStatusColor(entry.status)}`}>
                      <span className="text-[14px]">{getStatusEmoji(entry.status)}</span>
                      {entry.status === 'OK' ? 'ANIMAL OK' : entry.status === 'Atenção' ? 'ALERTA' : 'PERIGO'}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100/50">
                      {entry.dia_semana}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="font-black text-[11px] text-slate-700">{entry.comeu}</span>
                  </td>
                  <td className="p-6">
                    <p className="text-[11px] text-slate-500 font-medium max-w-[200px] italic leading-relaxed" title={entry.observacoes}>
                      {entry.observacoes || 'Sem notas adicionais'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="p-32 text-center flex flex-col items-center justify-center opacity-20">
              <span className="text-7xl mb-4">🔍</span>
              <p className="font-black text-slate-800 uppercase tracking-[0.3em] text-sm">Nenhum diário preenchido para esta data.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-8 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] py-4">
        <span>DOMO Intelligence System</span>
        <span>Audit Filtered by: {selectedDate}</span>
      </div>
    </div>
  );
};

export default ChecklistLooker;
