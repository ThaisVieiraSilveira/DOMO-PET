
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pet } from '../types';

interface RegistrationProps {
  pets: Pet[];
}

const Registration: React.FC<RegistrationProps> = ({ pets }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPets = useMemo(() => {
    return pets.filter(pet => 
      (pet.pet_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pet.tutor_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pet.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pets, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-emerald-900 mb-1">Cadastro Geral</h2>
          <p className="text-emerald-700/70 font-medium">Gestão das Fichas Mestres dos {pets.length} pets 📂</p>
        </div>
        <div className="relative group w-full md:w-80">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 shadow-sm border border-sky-200">
            🔍
          </div>
          <input
            type="text"
            placeholder="Buscar por ID, Pet ou Tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-3.5 bg-slate-100/50 rounded-full border border-slate-100 focus:bg-white focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-emerald-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-emerald-50/50 text-emerald-900">
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60">ID</th>
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60">Pet / Tutor</th>
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60">Raça</th>
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60">Dias</th>
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60">Saúde</th>
              <th className="p-5 font-black uppercase text-[10px] tracking-widest text-emerald-700/60 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {filteredPets.map(pet => (
              <tr 
                key={pet.id} 
                className="hover:bg-emerald-50/30 transition-colors group"
              >
                <td className="p-5 font-bold text-slate-400 text-xs tracking-tighter">{pet.id}</td>
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🐶</span>
                    <div>
                      <p className="font-black text-slate-800 text-base leading-none mb-1">{pet.pet_nome}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{pet.tutor_nome}</p>
                    </div>
                  </div>
                </td>
                <td className="p-5 text-sm font-bold text-slate-500">{pet.raca}</td>
                <td className="p-5 text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                  {pet.dia_semana || '-'}
                </td>
                <td className="p-5">
                  <div className="flex gap-1">
                    {pet.alimentos_proibidos !== '-' && <span title="Restrição Alimentar" className="text-rose-500">🚫</span>}
                    {/* // Fix: Property 'doenca_quais' does not exist on type 'Pet'. Did you mean 'doenca_qual'? */}
                    {pet.doenca_qual !== '-' && <span title="Condição Crônica" className="text-amber-500">🏥</span>}
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => navigate(`/cadastro/${pet.id}`)}
                      className="px-4 py-1.5 bg-sky-100 text-sky-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-sky-500 hover:text-white transition-all shadow-sm"
                    >
                      Ficha Mestre
                    </button>
                    <button 
                      onClick={() => navigate(`/pet/${pet.id}`)}
                      className="px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                    >
                      Ver Diário
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPets.length === 0 && (
          <div className="p-20 text-center text-slate-400 font-bold">
            <p className="text-4xl mb-4">🐾</p>
            Nenhum pet encontrado para sua busca.
          </div>
        )}
      </div>
    </div>
  );
};

export default Registration;
