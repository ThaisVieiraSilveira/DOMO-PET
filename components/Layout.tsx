
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../src/firebase';
import { useTenant } from '../src/hooks/useTenant';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const { nome: domoNome, cor: domoCor, logo: domoLogo } = useTenant();

  const navItems = [
    { path: '/', label: 'Painel', icon: '🐾' },
    { path: '/cadastro', label: 'Cadastro', icon: '📝' },
    { path: '/medicacao', label: 'Medicação', icon: '💊' },
    { path: '/hotel', label: 'Hotel', icon: '🏨' },
    { path: '/relatorios', label: 'Mensagens', icon: '💬' },
    { path: '/settings', label: 'Ajustes', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    if (window.confirm('Deseja realmente sair do sistema?')) {
      try {
        localStorage.removeItem('domo_master_pets');
        localStorage.removeItem('domo_checklists');
        localStorage.removeItem('domo_groups');
        localStorage.removeItem('domo_medications');
        localStorage.removeItem('domo_medication_logs');
        localStorage.removeItem('domo_hotel_stays');
        localStorage.removeItem('domo_activities');
        localStorage.removeItem('domo_cadastros_pendentes');
        await signOut(auth);
      } catch (err) {
        console.error("Erro ao fazer logout:", err);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header 
        className="py-4 px-6 sticky top-0 z-40 transition-all shadow-md"
        style={{ 
          backgroundColor: domoCor,
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <div className="max-w-[1360px] mx-auto flex justify-between items-center px-2">
          <Link to="/" className="flex items-center gap-5 group">
            {domoLogo ? (
              domoLogo === '/logo.svg' ? (
                <div className="w-24 h-24 flex items-center justify-center shrink-0">
                  <img src="/logo-white.svg" alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-white p-2 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                  <img src={domoLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )
            ) : (
              <span className="text-5xl group-hover:rotate-12 transition-transform select-none">🐶</span>
            )}
            {(!domoLogo || domoLogo !== '/logo.svg') && (
              <h1 
                className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white transition-colors"
              >
                {domoNome}
              </h1>
            )}
          </Link>
          
          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden md:flex gap-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-2 font-black text-base uppercase tracking-wider transition-colors py-3 px-2 hover:text-white"
                    style={{ 
                      color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                      borderBottom: isActive ? '3.5px solid #ffffff' : '3.5px solid transparent'
                    }}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <Link 
              to="/grupos" 
              title="Gerenciar Grupos"
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black shadow-md border-2 transition-all ${
                location.pathname === '/grupos' 
                  ? 'bg-sky-500 text-white border-sky-600 rotate-90' 
                  : 'bg-sky-50 text-sky-500 border-sky-100 hover:border-sky-300 hover:scale-110'
              }`}
            >
              +
            </Link>

            {auth.currentUser && (
              <button
                onClick={handleLogout}
                title="Sair do Sistema"
                className="w-12 h-12 bg-rose-50 text-rose-500 border-2 border-rose-100 hover:border-rose-300 hover:bg-rose-100 rounded-full flex items-center justify-center text-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                🚪
              </button>
            )}
          </div>
        </div>
      </header>


      <main className="flex-grow max-w-[1360px] w-full mx-auto p-4 md:p-8 xl:p-12 pb-12">
        {children}
      </main>

      <footer className="w-full py-6 text-center text-slate-400 text-[10px] uppercase tracking-widest font-bold border-t border-slate-100 bg-white pb-24 md:pb-6">
        <p>© {new Date().getFullYear()} DOMO. Todos os direitos reservados.</p>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 flex justify-around items-center z-50 shadow-lg px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all flex-1 min-w-0"
              style={{
                backgroundColor: isActive ? domoCor + '15' : 'transparent',
                color: isActive ? domoCor : '#64748b'
              }}
            >
              <span className="text-xl mb-0.5 select-none">{item.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-tight text-center truncate w-full px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
