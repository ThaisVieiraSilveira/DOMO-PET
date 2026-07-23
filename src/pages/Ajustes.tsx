import React, { useState, useEffect } from 'react';
import { useTenant } from '../hooks/useTenant';

const COLOR_OPTIONS = [
  { name: 'Esmeralda (Padrão)', value: '#10b981' },
  { name: 'Verde Domo', value: '#2d512e' },
  { name: 'Céu Azul', value: '#0ea5e9' },
  { name: 'Rosa Vibrante', value: '#f43f5e' },
  { name: 'Indigo Noite', value: '#4f46e5' },
  { name: 'Laranja Solar', value: '#f59e0b' },
  { name: 'Roxo Místico', value: '#a855f7' },
  { name: 'Grafite Elegante', value: '#334155' }
];

const Ajustes: React.FC = () => {
  const {
    nome: currentNome,
    cor: currentCor,
    corSecundaria: currentCorSec,
    logo: currentLogo,
    email: currentEmail,
    loading: tenantLoading,
    savingStatus,
    savingProgress,
    errorMessage: tenantError,
    salvar
  } = useTenant();

  const [nome, setNome] = useState('');
  const [corPrimaria, setCorPrimaria] = useState('#10b981');
  const [corSecundaria, setCorSecundaria] = useState('#0ea5e9');
  const [email, setEmail] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantLoading) {
      setNome(currentNome || '');
      setCorPrimaria(currentCor || '#10b981');
      setCorSecundaria(currentCorSec || '#0ea5e9');
      setEmail(currentEmail || '');
    }
  }, [tenantLoading, currentNome, currentCor, currentCorSec, currentEmail]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowed.includes(file.type)) {
        const msg = 'Formato inválido. Aceitos apenas arquivos PNG, JPG ou WebP.';
        setLocalError(msg);
        alert(msg);
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        const msg = 'O arquivo de logotipo excede o limite máximo de 2 MB.';
        setLocalError(msg);
        alert(msg);
        return;
      }

      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!nome.trim()) {
      setLocalError('O nome da creche é obrigatório.');
      return;
    }

    try {
      await salvar({
        nome: nome.trim(),
        cor: corPrimaria,
        corSecundaria: corSecundaria,
        logoFile: selectedFile,
        logo: filePreview || currentLogo,
        email: email.trim()
      });
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      console.error("Erro ao salvar identidade da creche:", err);
      setLocalError(err.message || 'Erro ao gravar informações.');
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="text-4xl animate-bounce mb-4">🐾</div>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Carregando configurações da creche...</p>
      </div>
    );
  }

  const isSaving = savingStatus === 'uploading' || savingStatus === 'saving';

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-10 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black text-slate-800">Identidade da Creche</h2>
        <p className="text-slate-500 font-medium">Personalize as cores, o nome e a marca visual da sua creche 🏷️</p>
      </div>

      <div className="bg-white rounded-[45px] p-8 border border-slate-100 shadow-xl space-y-8">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Nome da creche */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail de Contato da Creche</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: contato@creche.com.br"
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white shadow-sm transition-all focus:ring-0"
              />
            </div>
          </div>

          {/* Seleção de cores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Cor Principal</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-100 p-1 bg-white"
                />
                <select
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="flex-1 p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none text-xs"
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Cor Secundária</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-100 p-1 bg-white"
                />
                <select
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="flex-1 p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none text-xs"
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Upload do Logotipo */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Logotipo da Creche (PNG, JPG, WebP • Máx 2MB)</label>
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[30px] p-6 text-center space-y-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🖼️</span>
                <p className="text-xs font-bold text-slate-500">Selecione o arquivo do logotipo oficial da creche</p>
                <p className="text-[9px] font-medium text-slate-400 uppercase">Resolução recomendada: 200x200px • Máximo 2MB</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  Procurar logo...
                </label>
                {(filePreview || currentLogo) && (
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-xl flex items-center justify-center p-1 shadow-md">
                    <img
                      src={filePreview || currentLogo}
                      alt="Logo da creche"
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estado e mensagens de progresso */}
          {isSaving && (
            <div className="space-y-2 p-4 bg-sky-50 border border-sky-100 rounded-2xl">
              <div className="flex justify-between text-[10px] font-black uppercase text-sky-700">
                <span>{savingStatus === 'uploading' ? 'Enviando logotipo...' : 'Gravando identidade no Firestore...'}</span>
                <span>{savingProgress}%</span>
              </div>
              <div className="w-full bg-sky-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-600 h-full transition-all duration-300"
                  style={{ width: `${savingProgress}%` }}
                />
              </div>
            </div>
          )}

          {(localError || tenantError) && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">
              ⚠️ {localError || tenantError}
            </div>
          )}

          {savingStatus === 'success' && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center">
              ✓ Identidade visual da creche salva com sucesso!
            </div>
          )}

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[24px] shadow-lg transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2 border-b-4"
            style={{ 
              backgroundColor: corPrimaria,
              borderBottomColor: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            {isSaving ? 'Salvando...' : 'Salvar Identidade'}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-8" />

        {/* Prévia visual */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Prévia Visual em Tempo Real</h3>
          
          <div className="bg-slate-50 p-6 rounded-[35px] border border-slate-200 space-y-4 shadow-inner">
            <header className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg transition-colors duration-500" style={{ backgroundColor: corPrimaria }}>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/25 rounded-2xl flex items-center justify-center p-2 backdrop-blur-sm shadow-inner">
                    {filePreview || currentLogo ? (
                      <img 
                        src={filePreview || currentLogo} 
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
                      {nome || 'Nome da Creche'}
                    </h3>
                    <p className="text-white/75 font-bold text-[9px] uppercase tracking-widest mt-1">Portal do Tutor & Sistema DOMO</p>
                  </div>
                </div>
                
                <span className="px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full text-white" style={{ backgroundColor: corSecundaria }}>
                  Ativo
                </span>
              </div>
            </header>

            <div className="flex gap-3 justify-center">
              <button className="px-4 py-2 rounded-xl text-white font-black text-[10px] uppercase tracking-wider" style={{ backgroundColor: corPrimaria }}>
                Botão Principal
              </button>
              <button className="px-4 py-2 rounded-xl text-white font-black text-[10px] uppercase tracking-wider" style={{ backgroundColor: corSecundaria }}>
                Destaque Secundário
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Ajustes;

