import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../firebase';

const COLOR_OPTIONS = [
  { name: 'Esmeralda (Padrão)', value: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-500', themeBorder: 'border-emerald-100', themeBg: 'bg-emerald-50' },
  { name: 'Céu Azul', value: '#0ea5e9', bgClass: 'bg-sky-500', textClass: 'text-sky-500', themeBorder: 'border-sky-100', themeBg: 'bg-sky-50' },
  { name: 'Rosa Vibrante', value: '#f43f5e', bgClass: 'bg-rose-500', textClass: 'text-rose-500', themeBorder: 'border-rose-100', themeBg: 'bg-rose-50' },
  { name: 'Indigo Noite', value: '#4f46e5', bgClass: 'bg-indigo-500', textClass: 'text-indigo-500', themeBorder: 'border-indigo-100', themeBg: 'bg-indigo-50' },
  { name: 'Laranja Solar', value: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-500', themeBorder: 'border-amber-100', themeBg: 'bg-amber-50' },
  { name: 'Roxo Místico', value: '#a855f7', bgClass: 'bg-purple-500', textClass: 'text-purple-500', themeBorder: 'border-purple-100', themeBg: 'bg-purple-50' },
  { name: 'Grafite Elegante', value: '#334155', bgClass: 'bg-slate-700', textClass: 'text-slate-700', themeBorder: 'border-slate-200', themeBg: 'bg-slate-50' }
];

const Ajustes: React.FC = () => {
  const [nome, setNome] = useState('');
  const [corPrimaria, setCorPrimaria] = useState('#10b981');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carregar dados de tenants
  useEffect(() => {
    const fetchTenantData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        if (isFirebaseConfigured) {
          const docRef = doc(db, 'tenants', 'default');
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setNome(data.nome || '');
            setCorPrimaria(data.cor_primaria || '#10b981');
            setLogoUrl(data.logo_url || '');
          }
        } else {
          const stored = localStorage.getItem('domo_tenant_settings');
          if (stored) {
            const data = JSON.parse(stored);
            setNome(data.nome || '');
            setCorPrimaria(data.cor_primaria || '#10b981');
            setLogoUrl(data.logo_url || '');
          }
        }
      } catch (err: any) {
        console.error("Erro ao carregar configurações de white-label:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenantData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'image/png') {
        alert('Apenas arquivos de imagem no formato PNG são permitidos.');
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg('O nome da creche é obrigatório.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalLogoUrl = logoUrl;
      const tenantId = 'default';

      // Upload do arquivo PNG para o Firebase Storage ou gravação em Base64
      if (selectedFile) {
        if (isFirebaseConfigured) {
          const storageRef = ref(storage, `logos/${tenantId}/logo.png`);
          await uploadBytes(storageRef, selectedFile);
          finalLogoUrl = await getDownloadURL(storageRef);
        } else {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
          finalLogoUrl = await base64Promise;
        }
      }

      // Criar slug a partir do nome
      const slug = nome
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '-') // substitui caracteres especiais por hifens
        .replace(/(^-|-$)+/g, ''); // limpa hifens no início e fim

      // Gravação no documento tenants/default do Firestore
      const tenantData = {
        tenant_id: tenantId,
        nome: nome.trim(),
        cor_primaria: corPrimaria,
        logo_url: finalLogoUrl,
        slug: slug,
        atualizado_em: new Date().toISOString()
      };

      if (isFirebaseConfigured) {
        await setDoc(doc(db, 'tenants', tenantId), tenantData);
      } else {
        localStorage.setItem('domo_tenant_settings', JSON.stringify(tenantData));
      }

      setLogoUrl(finalLogoUrl);
      setSelectedFile(null);
      setFilePreview(null);
      setSuccessMsg(`Configurações white-label salvas com sucesso! ${!isFirebaseConfigured ? ' (Salvo Localmente)' : ''}`);
      
      // Auto-sumir mensagem de sucesso após 4 segundos
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar white-label:", err);
      setErrorMsg(`Erro de gravação: ${err.message || 'Verifique as regras do Firestore ou preencha as variáveis de ambiente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="text-4xl animate-bounce mb-4">🐾</div>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Carregando painel de ajustes...</p>
      </div>
    );
  }

  // Obter detalhes visuais da cor ativa para o preview
  const activeColorObj = COLOR_OPTIONS.find(c => c.value === corPrimaria) || COLOR_OPTIONS[0];

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-10 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black text-slate-800">Ajustes White-Label</h2>
        <p className="text-slate-500 font-medium">Personalize a identidade da sua creche de forma única 🏷️</p>
      </div>

      <div className="bg-white rounded-[45px] p-8 border border-slate-100 shadow-xl space-y-8">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Nome da creche */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nome da Creche / Hotel</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Creche Patas & Cia"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white shadow-sm transition-all focus:ring-0"
              required
            />
          </div>

          {/* Seleção de cor principal */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Cor de Identidade Principal</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white shadow-sm transition-all"
              >
                {COLOR_OPTIONS.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.name}
                  </option>
                ))}
              </select>

              {/* Amostrador visual rápido */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                <span className={`w-8 h-8 rounded-full shadow-md shrink-0 block`} style={{ backgroundColor: corPrimaria }} />
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Código: <span className="font-mono text-slate-600">{corPrimaria.toUpperCase()}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Upload do Logo PNG */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Logo da Creche (Apenas PNG)</label>
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[30px] p-6 text-center space-y-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🖼️</span>
                <p className="text-xs font-bold text-slate-500">Selecione seu logotipo com fundo transparente</p>
                <p className="text-[9px] font-medium text-slate-400 uppercase">Resolução recomendada: 200x200px</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  Procurar logo...
                </label>
                {(logoUrl || filePreview) && (
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-xl flex items-center justify-center p-1 shadow-md">
                    <img
                      src={filePreview || logoUrl}
                      alt="Logo da creche"
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center">
              {successMsg}
            </div>
          )}

          {/* Botão salvar usando os estilos de botões das configurações padrão */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[24px] shadow-lg transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2 border-b-4"
            style={{ 
              backgroundColor: corPrimaria,
              borderBottomColor: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            {isSaving ? 'Gravando Alterações...' : 'Salvar Identidade Visual'}
          </button>
        </form>

        {/* Separador */}
        <div className="border-t border-slate-100 pt-8" />

        {/* Preview do tutor header em tempo real */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Preview em Tempo Real • Cabeçalho do Tutor</h3>
          
          <div className="bg-slate-50 p-6 rounded-[35px] border border-slate-200 space-y-4 shadow-inner">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">Como os tutores verão sua marca no cabeçalho do portal:</p>
            
            {/* Header da creche customizado */}
            <header className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg transition-colors duration-500" style={{ backgroundColor: corPrimaria }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Foto de logo ou ícon padrão */}
                  <div className="w-12 h-12 bg-white/25 rounded-2xl flex items-center justify-center p-2 backdrop-blur-sm shadow-inner transition-transform hover:scale-105 duration-200">
                    {filePreview || logoUrl ? (
                      <img 
                        src={filePreview || logoUrl} 
                        alt="Logo" 
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-2xl">🐾</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-base md:text-lg tracking-tight leading-none">
                      {nome || 'Nome da Sua Creche'}
                    </h3>
                    <p className="text-white/75 font-bold text-[9px] uppercase tracking-widest mt-1">Portal do Tutor • Status do Diário</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="bg-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full backdrop-blur-sm">
                    ● Ativo
                  </span>
                </div>
              </div>
            </header>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-slate-400 text-[10px] font-bold">
              🐾 Diário, medicamentos e hospedagem do seu pet estarão integrados com este visual!
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Ajustes;
