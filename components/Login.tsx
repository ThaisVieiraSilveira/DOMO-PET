import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../src/firebase';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorStatus('Por favor, preencha todos os campos.');
      return;
    }

    setIsLoading(true);
    setErrorStatus(null);

    try {
      if (isFirebaseConfigured) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await (auth as any).signInWithEmailAndPassword(email.trim(), password);
      }
      onLogin();
    } catch (err: any) {
      console.error("Erro ao fazer login:", err);
      setErrorStatus("E-mail ou senha incorretos");
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="text-6xl mb-4 animate-bounce select-none">🐶</div>
          <h1 className="text-3xl font-black text-emerald-800 tracking-tighter">DOMO</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Acesso Restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">E-mail de Acesso</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@hotmail.com"
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 focus:border-emerald-300 focus:bg-white rounded-3xl outline-none font-bold text-slate-700 transition-all text-center text-sm"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Senha de Acesso</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-6 py-4 bg-slate-50 border-2 rounded-3xl outline-none font-bold text-slate-700 transition-all text-center text-xl tracking-widest ${
                errorStatus ? 'border-rose-300 bg-rose-50 animate-shake' : 'border-slate-100 focus:border-emerald-300 focus:bg-white'
              }`}
              disabled={isLoading}
              required
            />
          </div>

          {errorStatus && (
            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
              {errorStatus}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 transition-all active:scale-95 border-b-4 border-emerald-700 flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? 'Conectando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-slate-100 text-center space-y-4">
          <a
            href="/domo.html"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#F0FAF6] hover:bg-[#E2F4ED] text-[#1D9E75] font-black text-xs uppercase tracking-wider rounded-2xl border border-[#1D9E75]/20 transition-all shadow-sm w-full justify-center"
          >
            <span>💻 Acessar Admin DOMO — Sistema Pet</span>
            <span className="text-xs">→</span>
          </a>
          
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest pt-2">
            © {new Date().getFullYear()} DOMO • Gestão Veterinária
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
