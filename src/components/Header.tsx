import React from 'react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeSala,
    isSupabaseConfigured,
    setShowConfigModal,
    setCurrentTab,
  } = useApp();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#e2e8ff] shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="max-w-4xl mx-auto h-16 px-4 flex items-center justify-between gap-3">
        {/* Logo & Marca */}
        <div
          onClick={() => setCurrentTab('nuevo-pedido')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-sm shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#00236f] tracking-tight">
                RutaPedidos
              </span>
              <span className="w-2 h-2 rounded-full bg-[#fd651e] shrink-0" />
            </div>
            <span className="text-xs text-[#444651] truncate max-w-[200px] sm:max-w-xs font-medium">
              {activeSala ? (
                <>Sala: {activeSala.nombreCliente} ({activeSala.codCliente})</>
              ) : (
                'Sin sala seleccionada'
              )}
            </span>
          </div>
        </div>

        {/* Acciones del Encabezado */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Supabase Status Pill */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaedff] hover:bg-[#dae2fd] text-[#131b2e] text-xs font-medium transition-all shadow-sm cursor-pointer"
            title="Ver estado de conexión Supabase y tablas"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-[#fd651e]'
              }`}
            />
            <span className="hidden sm:inline font-mono">
              {isSupabaseConfigured ? 'Supabase Conectado' : 'Supabase Config'}
            </span>
            <span className="sm:hidden font-mono">DB</span>
          </button>

          {/* User Profile Badge / Switcher */}
          {currentUser && (
            <div
              onClick={() => setCurrentTab('perfil-sala')}
              className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-[#eaedff] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {currentUser.firstName.charAt(0)}
                {currentUser.lastName.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-[#131b2e] leading-tight">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="text-[10px] text-[#fd651e] font-bold">
                  {currentUser.typeUser}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
