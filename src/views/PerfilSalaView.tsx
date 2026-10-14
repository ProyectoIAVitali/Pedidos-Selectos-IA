import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../lib/supabase';
import { UsuarioMovil, Supervisor } from '../types/database';

export const PerfilSalaView: React.FC = () => {
  const {
    currentUser,
    activeSala,
    assignedSalas,
    selectSala,
    switchUser,
    logout,
    setShowConfigModal,
    isSupabaseConfigured,
    setCurrentTab,
    dataVersion,
  } = useApp();

  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [allUsers, setAllUsers] = useState<UsuarioMovil[]>([]);
  const [allSupervisores, setAllSupervisores] = useState<Supervisor[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [uList, sList] = await Promise.all([
          DatabaseService.getUsuarios().catch(() => []),
          DatabaseService.getSupervisores().catch(() => []),
        ]);
        setAllUsers(uList);
        setAllSupervisores(sList);
      } catch (err) {
        console.warn('Error en PerfilSalaView:', err);
      }
    };
    load();
  }, [dataVersion]);

  const supervisor = activeSala
    ? allSupervisores.find((s) => s.idSupervisor === activeSala.idSupervisor)
    : null;

  const handleSelectAccount = async (email: string) => {
    await switchUser(email);
    setShowSwitchModal(false);
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    await switchUser(customEmail);
    setShowSwitchModal(false);
    setCustomEmail('');
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] pb-32 pt-2">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-3.5">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center font-['Plus_Jakarta_Sans'] font-bold text-xl shadow-md">
              {currentUser ? `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}` : 'US'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#131b2e] truncate">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Sin Usuario'}
              </span>
              <span className="text-xs text-[#444651] font-mono truncate">
                {currentUser?.correo || 'No autenticado'}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#a73a00] text-white">
                  {currentUser?.typeUser || 'DISPLAY'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#eaedff] text-[#00236f]">
                  Preventa Móvil
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#f2f3ff] flex items-center justify-between text-xs">
            <span className="text-[#757682]">Salas asignadas en Supabase:</span>
            <span className="font-bold text-[#00236f] bg-[#eaedff] px-2 py-0.5 rounded-full">
              {assignedSalas.length} sala{assignedSalas.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Sala Activa Selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg text-[#00236f]">🏪</span>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                Sala de Trabajo Activa
              </h3>
            </div>
            <span className="text-[11px] font-bold text-[#fd651e]">
              Cambio en Caliente
            </span>
          </div>

          <p className="text-xs text-[#444651]">
            Selecciona la sala/cliente sobre la cual deseas registrar y consultar pedidos en este momento:
          </p>

          <div className="space-y-2">
            {assignedSalas.map((sala) => {
              const isSelected = activeSala?.codCliente === sala.codCliente;
              const sup = allSupervisores.find((s) => s.idSupervisor === sala.idSupervisor);

              return (
                <div
                  key={sala.codCliente}
                  onClick={() => selectSala(sala.codCliente)}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#00236f] text-white border-[#00236f] shadow-md'
                      : 'bg-[#faf8ff] text-[#131b2e] border-[#dae2fd] hover:bg-[#eaedff]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{isSelected ? '◉' : '○'}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-sm">
                        {sala.nombreCliente}
                      </span>
                      <span className={isSelected ? 'text-[#dce1ff]' : 'text-[#757682]'}>
                        Supervisor: {sup ? sup.nombreSupervisor : sala.idSupervisor}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#eaedff] text-[#00236f]'
                    }`}
                  >
                    {sala.codCliente}
                  </span>
                </div>
              );
            })}
            {assignedSalas.length === 0 && (
              <p className="text-xs text-gray-400 italic">No tienes salas asignadas en usuarioClientes.</p>
            )}
          </div>

          <button
            onClick={() => setCurrentTab('nuevo-pedido')}
            className="w-full h-11 bg-[#fd651e] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:bg-[#a73a00] active:scale-95 transition-all mt-1 cursor-pointer"
          >
            <span>🛒</span>
            <span>Ir a Toma de Pedidos con Sala Activa</span>
          </button>
        </div>

        {/* Database & Cloud Integration Card */}
        <div className="bg-[#f2f3ff] rounded-2xl p-4 border border-[#dae2fd] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base text-emerald-600">☁️</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-[#00236f]">
                Supabase & PostgreSQL Backend
              </h4>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isSupabaseConfigured
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isSupabaseConfigured ? 'Conectado a Cloud' : 'Requiere URL / Key'}
            </span>
          </div>

          <p className="text-xs text-[#444651]">
            Todas las operaciones CRUD se ejecutan directamente en las 8 tablas de Supabase.
          </p>

          <button
            onClick={() => setShowConfigModal(true)}
            className="h-10 bg-white hover:bg-[#eaedff] text-[#00236f] text-xs font-bold rounded-xl border border-[#dae2fd] shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>⚙️</span>
            <span>Configuración de Conexión & Esquema SQL</span>
          </button>
        </div>

        {/* Account Switching & Logout Buttons */}
        <div className="pt-1 flex flex-col gap-2">
          <button
            onClick={() => setShowSwitchModal(true)}
            className="w-full h-11 bg-white hover:bg-[#eaedff] text-[#444651] text-xs font-bold rounded-xl border border-[#e2e8ff] shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>👥</span>
            <span>Cambiar Usuario en Supabase</span>
          </button>

          <button
            onClick={() => {
              logout();
            }}
            className="w-full h-11 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>↩</span>
            <span>Cerrar Sesión / Ir a Pantalla de Login de Google</span>
          </button>
        </div>

        {/* Switch Account Modal */}
        {showSwitchModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-2xl border border-[#dae2fd] space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#00236f]">
                  Cambiar Cuenta en Supabase
                </h4>
                <button
                  onClick={() => setShowSwitchModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {allUsers.map((u) => (
                  <button
                    key={u.correo}
                    onClick={() => handleSelectAccount(u.correo)}
                    className="w-full text-left p-2.5 rounded-xl border border-[#e2e8ff] hover:bg-[#eaedff] flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <span className="font-bold block text-[#131b2e]">
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-[#757682] font-mono text-[11px]">
                        {u.correo}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f2f3ff] text-[#00236f]">
                      {u.typeUser}
                    </span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleCustomLogin} className="pt-2 border-t space-y-2">
                <label className="block text-xs font-bold text-[#131b2e]">
                  O ingresar correo directamente:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    placeholder="correo@empresa.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="flex-1 h-9 px-2.5 rounded-lg border text-xs"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 bg-[#00236f] text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Entrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
