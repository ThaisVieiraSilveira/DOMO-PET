import React, { useState } from 'react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('thaisvieiravet@hotmail.com');
  const [password, setPassword] = useState('');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    setSuccessStatus(null);

    if (!email.trim() || !password) {
      setErrorStatus('Por favor, preencha todos os campos do formulário.');
      return;
    }

    setIsLoading(true);

    // Simular carregamento suave para combinar com a experiência premium
    setTimeout(() => {
      // Como o componente é um login de mock/tutor opcional baseado em prop onLogin:
      localStorage.setItem('domo_logado', 'true');
      setIsLoading(false);
      onLogin();
    }, 800);
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      setErrorStatus('Insira seu e-mail de acesso no campo acima primeiro.');
      return;
    }
    setErrorStatus(null);
    setSuccessStatus('E-mail de recuperação enviado com sucesso!');
    setTimeout(() => setSuccessStatus(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="text-6xl mb-4 animate-bounce select-none">🐾</div>
          <h1 className="text-3xl font-black text-emerald-800 tracking-tighter">DOMO</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Acesso ao Sistema • Canal Tutor</p>
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
            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse px-2">
              {errorStatus}
            </p>
          )}

          {successStatus && (
            <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center px-2">
              {successStatus}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 transition-all active:scale-95 border-b-4 border-emerald-700 flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors hover:underline focus:outline-none"
            disabled={isLoading}
          >
            Esqueci minha senha
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
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
