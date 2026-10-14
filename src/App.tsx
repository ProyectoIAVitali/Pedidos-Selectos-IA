/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { LoginSalaSelectView } from './views/LoginSalaSelectView';
import { TomaPedidosView } from './views/TomaPedidosView';
import { HistorialPedidosView } from './views/HistorialPedidosView';
import { CatalogosHubView } from './views/CatalogosHubView';
import { PerfilSalaView } from './views/PerfilSalaView';

const MainAppContent: React.FC = () => {
  const {
    isAuthenticated,
    needsSalaSelection,
    isLoadingAuth,
    currentTab,
    toasts,
    dismissToast,
    showConfigModal,
    setShowConfigModal,
  } = useApp();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00236f] text-white flex items-center justify-center animate-bounce shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#00236f]">
            Conectando con Supabase...
          </span>
          <span className="text-xs text-[#757682]">
            Verificando tablas de preventa en PostgreSQL
          </span>
        </div>
      </div>
    );
  }

  // Si no está autenticado o necesita seleccionar sala, mostrar Login / Selector
  if (!isAuthenticated || needsSalaSelection) {
    return (
      <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col">
        <LoginSalaSelectView />

        {/* Supabase Config / SQL DDL Modal disponible desde el inicio */}
        <SupabaseConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />

        {/* Notificaciones Toast */}
        <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 max-w-sm mx-auto pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => dismissToast(toast.id)}
              className={`p-3.5 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto cursor-pointer transition-all ${
                toast.type === 'error'
                  ? 'bg-red-900 text-white'
                  : toast.type === 'warning'
                  ? 'bg-amber-900 text-white'
                  : toast.type === 'info'
                  ? 'bg-[#1e3a8a] text-white'
                  : 'bg-[#283044] text-[#eef0ff]'
              }`}
            >
              <span className="text-xl">
                {toast.type === 'error'
                  ? '⚠️'
                  : toast.type === 'warning'
                  ? '⚡'
                  : toast.type === 'info'
                  ? 'ℹ️'
                  : '✓'}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs truncate">
                  {toast.title}
                </span>
                <span className="text-[11px] text-white/80 leading-tight">
                  {toast.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 pt-16">
        {currentTab === 'nuevo-pedido' && <TomaPedidosView />}
        {currentTab === 'mis-pedidos' && <HistorialPedidosView />}
        {currentTab === 'catalogos' && <CatalogosHubView />}
        {currentTab === 'perfil-sala' && <PerfilSalaView />}
      </main>

      {/* Bottom Tab Navigation */}
      <BottomNav />

      {/* Supabase Config / SQL DDL Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />

      {/* Notificaciones Toast Flotantes */}
      <div className="fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 max-w-sm mx-auto pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto cursor-pointer border transition-all ${
              toast.type === 'error'
                ? 'bg-red-900 border-red-700 text-white'
                : toast.type === 'warning'
                ? 'bg-amber-900 border-amber-700 text-white'
                : toast.type === 'info'
                ? 'bg-[#1e3a8a] border-[#264191] text-white'
                : 'bg-[#131b2e] border-[#283044] text-[#eef0ff]'
            }`}
          >
            <span className="text-xl">
              {toast.type === 'error'
                ? '⚠️'
                : toast.type === 'warning'
                ? '⚡'
                : toast.type === 'info'
                ? 'ℹ️'
                : '✓'}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs truncate">
                {toast.title}
              </span>
              <span className="text-[11px] text-white/80 leading-tight">
                {toast.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
