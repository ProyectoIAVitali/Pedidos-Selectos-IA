import React, { useState, useEffect } from 'react';
import { useApp, MainTab } from '../context/AppContext';
import { DatabaseService } from '../lib/supabase';

export const BottomNav: React.FC = () => {
  const { currentTab, setCurrentTab, cart, dataVersion } = useApp();
  const [totalPedidos, setTotalPedidos] = useState<number>(0);

  useEffect(() => {
    let cancel = false;
    DatabaseService.getPedidos()
      .then((p) => {
        if (!cancel) setTotalPedidos(p.length);
      })
      .catch(() => {
        if (!cancel) setTotalPedidos(0);
      });

    return () => {
      cancel = true;
    };
  }, [dataVersion, currentTab]);

  const cartUnits = cart.reduce((sum, item) => sum + item.cantidad, 0);

  const navItems: Array<{
    id: MainTab;
    label: string;
    badge?: number;
    icon: (active: boolean) => React.ReactNode;
  }> = [
    {
      id: 'nuevo-pedido',
      label: 'Nuevo Pedido',
      badge: cartUnits > 0 ? cartUnits : undefined,
      icon: (active) => (
        <svg
          className={`w-6 h-6 transition-transform ${active ? 'scale-110' : ''}`}
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 1.5 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      id: 'mis-pedidos',
      label: 'Mis Pedidos',
      badge: totalPedidos > 0 ? totalPedidos : undefined,
      icon: (active) => (
        <svg
          className={`w-6 h-6 transition-transform ${active ? 'scale-110' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 'catalogos',
      label: 'Catálogos',
      icon: (active) => (
        <svg
          className={`w-6 h-6 transition-transform ${active ? 'scale-110' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      ),
    },
    {
      id: 'perfil-sala',
      label: 'Perfil / Sala',
      icon: (active) => (
        <svg
          className={`w-6 h-6 transition-transform ${active ? 'scale-110' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 backdrop-blur-xl border-t border-[#e2e8ff] shadow-[0_-2px_12px_rgba(0,0,0,0.05)] pb-safe">
      <div className="max-w-md mx-auto h-16 px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center min-w-[70px] min-h-[48px] py-1 transition-all relative cursor-pointer ${
                isActive
                  ? 'text-[#00236f] font-bold'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              <div className="relative">
                {item.icon(isActive)}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#fd651e] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-['Inter'] mt-0.5 tracking-tight text-center">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#00236f] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
