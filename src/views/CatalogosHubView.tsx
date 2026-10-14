import React, { useState, useEffect } from 'react';
import { useApp, CatalogTab } from '../context/AppContext';
import { DatabaseService } from '../lib/supabase';
import { ClientesCatalogView } from './catalogos/ClientesCatalogView';
import { RutasCatalogView } from './catalogos/RutasCatalogView';
import { SupervisoresCatalogView } from './catalogos/SupervisoresCatalogView';
import { ProductosCatalogView } from './catalogos/ProductosCatalogView';
import { UsuariosCatalogView } from './catalogos/UsuariosCatalogView';

export const CatalogosHubView: React.FC = () => {
  const { currentCatalogTab, setCurrentCatalogTab, dataVersion } = useApp();

  const [counts, setCounts] = useState<{
    clientes: number;
    rutas: number;
    supervisores: number;
    productos: number;
    usuarios: number;
  }>({
    clientes: 0,
    rutas: 0,
    supervisores: 0,
    productos: 0,
    usuarios: 0,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [cli, rut, sup, prod, usu] = await Promise.all([
          DatabaseService.getClientes().then((d) => d.length).catch(() => 0),
          DatabaseService.getRutas().then((d) => d.length).catch(() => 0),
          DatabaseService.getSupervisores().then((d) => d.length).catch(() => 0),
          DatabaseService.getProductos().then((d) => d.length).catch(() => 0),
          DatabaseService.getUsuarios().then((d) => d.length).catch(() => 0),
        ]);
        setCounts({
          clientes: cli,
          rutas: rut,
          supervisores: sup,
          productos: prod,
          usuarios: usu,
        });
      } catch {
        // ignore
      }
    };

    fetchCounts();
  }, [dataVersion, currentCatalogTab]);

  const tabs: Array<{ id: CatalogTab; label: string; count: number; icon: string }> = [
    { id: 'clientes', label: 'Clientes', count: counts.clientes, icon: '🏪' },
    { id: 'rutas', label: 'Rutas', count: counts.rutas, icon: '🛣️' },
    { id: 'supervisores', label: 'Supervisores', count: counts.supervisores, icon: '👔' },
    { id: 'productos', label: 'Productos', count: counts.productos, icon: '📦' },
    { id: 'usuarios', label: 'Usuarios', count: counts.usuarios, icon: '👥' },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] pb-32 pt-2">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-3.5">
        {/* Status Strip */}
        <div className="flex items-center justify-between gap-2 bg-[#f2f3ff] p-2.5 rounded-2xl border border-[#dae2fd]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fd651e] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#fd651e]" />
            </span>
            <span className="text-xs text-[#444651] truncate font-medium">
              Conexión directa a PostgreSQL vía Supabase REST API
            </span>
          </div>
          <span className="text-emerald-600 text-sm font-bold shrink-0">☁️</span>
        </div>

        {/* Tab Strip Horizontal (Pantallas separadas por tabla) */}
        <div className="overflow-x-auto -mx-4 px-4 no-scrollbar py-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {tabs.map((tab) => {
              const isActive = currentCatalogTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentCatalogTab(tab.id)}
                  className={`px-3.5 py-2 rounded-full text-xs font-['Inter'] font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#00236f] text-white shadow-sm'
                      : 'bg-[#eaedff] text-[#444651] hover:bg-[#dae2fd]'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      isActive
                        ? 'bg-[#fd651e] text-white'
                        : 'bg-[#dce1ff] text-[#00164e]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Renderizado de la Pantalla Específica según la Tabla */}
        <div className="mt-1">
          {currentCatalogTab === 'clientes' && <ClientesCatalogView />}
          {currentCatalogTab === 'rutas' && <RutasCatalogView />}
          {currentCatalogTab === 'supervisores' && <SupervisoresCatalogView />}
          {currentCatalogTab === 'productos' && <ProductosCatalogView />}
          {currentCatalogTab === 'usuarios' && <UsuariosCatalogView />}
        </div>
      </div>
    </div>
  );
};
