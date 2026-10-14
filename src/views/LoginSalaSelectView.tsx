import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DatabaseService, parseClientCodes } from '../lib/supabase';
import { UsuarioMovil, Supervisor, Cliente, UserRole } from '../types/database';

export const LoginSalaSelectView: React.FC = () => {
  const {
    currentUser,
    assignedSalas,
    activeSala,
    selectSala,
    setCurrentTab,
    showToast,
    switchUser,
    logout,
    dataVersion,
    triggerRefresh,
    setShowConfigModal,
  } = useApp();

  // Cuenta de Google detectada / conectada (por defecto la del entorno Google: vportillovillela@gmail.com)
  const [googleEmail, setGoogleEmail] = useState<string>(() => {
    return localStorage.getItem('rp_google_account') || 'vportillovillela@gmail.com';
  });

  const [isEditingGoogleEmail, setIsEditingGoogleEmail] = useState(false);
  const [customGoogleInput, setCustomGoogleInput] = useState('');

  const [selectedCod, setSelectedCod] = useState<string>(
    activeSala ? activeSala.codCliente : assignedSalas[0]?.codCliente || ''
  );

  const [allUsers, setAllUsers] = useState<UsuarioMovil[]>([]);
  const [allSupervisores, setAllSupervisores] = useState<Supervisor[]>([]);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('Consultando Supabase...');

  // Modal para registrar o editar usuario en usuariosMoviles
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regTypeUser, setRegTypeUser] = useState<UserRole>('ADMIN');
  const [regSelectedSalas, setRegSelectedSalas] = useState<string[]>([]);
  const [regCustomCodes, setRegCustomCodes] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Sincronizar Google email con localStorage
  const updateGoogleAccount = (newEmail: string) => {
    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;
    setGoogleEmail(clean);
    localStorage.setItem('rp_google_account', clean);
    setIsEditingGoogleEmail(false);
  };

  useEffect(() => {
    if (activeSala) {
      setSelectedCod(activeSala.codCliente);
    } else if (assignedSalas.length > 0) {
      setSelectedCod(assignedSalas[0].codCliente);
    }
  }, [activeSala, assignedSalas]);

  // Cargar datos reales desde Supabase
  const loadSupabaseData = async () => {
    try {
      setLoading(true);
      const [users, sups, clis] = await Promise.all([
        DatabaseService.getUsuarios().catch(() => []),
        DatabaseService.getSupervisores().catch(() => []),
        DatabaseService.getClientes().catch(() => []),
      ]);
      setAllUsers(users);
      setAllSupervisores(sups);
      setAllClientes(clis);
      setDbStatus(`${users.length} usuarios en usuariosmoviles, ${clis.length} clientes en Clientes`);
    } catch (e: any) {
      setDbStatus(`Error al consultar Supabase: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupabaseData();
  }, [dataVersion]);

  // Buscar si la cuenta de Google conectada está registrada en la tabla usuariosMoviles
  const googleUserMatch = useMemo(() => {
    const cleanGoogle = googleEmail.trim().toLowerCase();
    return allUsers.find((u) => u.correo.toLowerCase() === cleanGoogle) || null;
  }, [allUsers, googleEmail]);

  const isGoogleAccountRegistered = !!googleUserMatch;

  // Clientes extraídos del campo codCliente para el usuario de Google
  const googleUserClientCodes = useMemo(() => {
    if (!googleUserMatch || !googleUserMatch.codCliente) return [];
    return parseClientCodes(googleUserMatch.codCliente);
  }, [googleUserMatch]);

  const googleUserClientsDetails = useMemo(() => {
    return googleUserClientCodes.map((code) => {
      const match = allClientes.find(
        (c) => c.codCliente.toLowerCase() === code.toLowerCase()
      );
      const sup = match
        ? allSupervisores.find((s) => s.idSupervisor === match.idSupervisor)
        : null;

      return {
        code,
        nombre: match ? match.nombreCliente : `Sala ${code}`,
        supervisor: sup ? sup.nombreSupervisor : match?.idSupervisor || 'Sin supervisor',
        existsInClientes: !!match,
      };
    });
  }, [googleUserClientCodes, allClientes, allSupervisores]);

  // Abrir modal para registrar la cuenta de Google en usuariosMoviles
  const handleOpenRegisterModal = (userToEdit?: UsuarioMovil) => {
    if (userToEdit) {
      setIsEditingExisting(true);
      setRegEmail(userToEdit.correo);
      setRegFirstName(userToEdit.firstName);
      setRegLastName(userToEdit.lastName);
      setRegTypeUser(userToEdit.typeUser);
      const codes = parseClientCodes(userToEdit.codCliente);
      setRegSelectedSalas(codes);
      setRegCustomCodes(codes.join(', '));
    } else {
      setIsEditingExisting(false);
      setRegEmail(googleEmail);
      // Sugerir nombres si el correo es conocido
      if (googleEmail.includes('vportillo')) {
        setRegFirstName('Víctor');
        setRegLastName('Portillo');
      } else if (googleEmail.includes('vitalialimentos')) {
        setRegFirstName('Preventa');
        setRegLastName('Vitalia');
      } else {
        const parts = googleEmail.split('@')[0].split(/[._-]/);
        setRegFirstName(parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Usuario');
        setRegLastName(parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Google');
      }
      setRegTypeUser('ADMIN');
      // Por defecto seleccionar las salas disponibles si hay pocas
      if (allClientes.length > 0) {
        setRegSelectedSalas([allClientes[0].codCliente]);
        setRegCustomCodes(allClientes[0].codCliente);
      } else {
        setRegSelectedSalas([]);
        setRegCustomCodes('CLI-001');
      }
    }
    setIsRegisterModalOpen(true);
  };

  const handleSaveUserInSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail) {
      showToast('Error', 'El correo electrónico es obligatorio', 'error');
      return;
    }

    // Calcular la lista final de códigos de cliente para el campo codCliente
    const customList = regCustomCodes
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const combined = Array.from(new Set([...regSelectedSalas, ...customList]));
    const codClienteString = combined.join(', ');

    setIsSavingUser(true);
    try {
      if (isEditingExisting) {
        await DatabaseService.updateUsuario(cleanEmail, {
          firstName: regFirstName.trim() || 'Usuario',
          lastName: regLastName.trim() || '',
          typeUser: regTypeUser,
          codCliente: codClienteString || undefined,
        });
      } else {
        await DatabaseService.createUsuario({
          correo: cleanEmail,
          firstName: regFirstName.trim() || 'Usuario',
          lastName: regLastName.trim() || '',
          typeUser: regTypeUser,
          codCliente: codClienteString || undefined,
        });
      }

      // Sincronizar también con la tabla intermedia usuarioClientes
      if (combined.length > 0) {
        await DatabaseService.setClientesForUsuario(cleanEmail, combined).catch(() => {});
      }

      showToast(
        isEditingExisting ? 'Usuario Actualizado' : 'Usuario Registrado en Supabase',
        `Guardado en usuariosMoviles con codCliente: "${codClienteString || 'vacío'}"`,
        'success'
      );

      setIsRegisterModalOpen(false);
      triggerRefresh();
      await loadSupabaseData();

      // Iniciar sesión automáticamente con este usuario si coincide con la cuenta de Google
      if (cleanEmail === googleEmail.trim().toLowerCase()) {
        await switchUser(cleanEmail);
      }
    } catch (err: any) {
      showToast('Error en Supabase', err.message, 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCod) {
      showToast('Atención', 'Selecciona una sala antes de continuar', 'warning');
      return;
    }
    selectSala(selectedCod);
    setCurrentTab('nuevo-pedido');
  };

  const handleQuickLogin = async (email: string) => {
    setLoading(true);
    try {
      await switchUser(email);
    } finally {
      setLoading(false);
    }
  };

  const effectiveSalas = assignedSalas.length > 0 ? assignedSalas : allClientes;

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-start pb-28">
      <div className="max-w-md mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {/* Header Branding */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00236f] flex items-center justify-center p-2 shadow-md text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f] tracking-tight leading-none">
                RutaPedidos
              </span>
              <span className="text-[11px] font-bold text-[#757682] tracking-wider uppercase mt-1">
                Preventa Móvil & Gestión
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eaedff] hover:bg-[#dae2fd] shadow-sm cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-[#00236f]">
              Supabase Live
            </span>
          </button>
        </header>

        {/* ========================================================================= */}
        {/* SECCIÓN PRINCIPAL: CUENTA DE GOOGLE CONECTADA & VERIFICACIÓN EN usuariosMoviles */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3 relative overflow-hidden">
          {/* Cabecera de Identificación de Google */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#00236f]">
                Cuenta de Google Conectada
              </span>
            </div>

            {/* Badge de estado en usuariosMoviles */}
            {isGoogleAccountRegistered ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Registrada en usuariosMoviles
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                NO Registrada en usuariosMoviles
              </span>
            )}
          </div>

          {/* Tarjeta con el Correo de Google */}
          <div className="p-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-[#757682] font-semibold uppercase tracking-wider">
                  Cuenta con la que ingresaste en Google:
                </span>
                <span className="font-mono font-bold text-sm text-[#00236f] truncate">
                  {googleEmail}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCustomGoogleInput(googleEmail);
                  setIsEditingGoogleEmail(!isEditingGoogleEmail);
                }}
                className="text-[11px] text-[#00236f] hover:underline font-bold shrink-0 cursor-pointer bg-white px-2 py-1 rounded-md border border-[#dae2fd]"
              >
                {isEditingGoogleEmail ? 'Cancelar' : 'Cambiar / Probar'}
              </button>
            </div>

            {/* Formulario rápido para cambiar la cuenta de Google a verificar */}
            {isEditingGoogleEmail && (
              <div className="pt-2 border-t border-[#dae2fd] flex flex-col gap-2">
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    value={customGoogleInput}
                    onChange={(e) => setCustomGoogleInput(e.target.value)}
                    placeholder="ej. vportillovillela@gmail.com"
                    className="flex-1 h-9 px-2.5 bg-white border border-[#00236f]/30 rounded-lg text-xs font-mono font-bold text-[#00236f] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateGoogleAccount(customGoogleInput)}
                    className="bg-[#00236f] text-white text-xs font-bold px-3 py-1 rounded-lg shrink-0 cursor-pointer hover:bg-[#1e3a8a]"
                  >
                    Verificar
                  </button>
                </div>
                {/* Accesos rápidos a cuentas conocidas */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-[#757682]">Opciones rápidas:</span>
                  <button
                    type="button"
                    onClick={() => updateGoogleAccount('vportillovillela@gmail.com')}
                    className="bg-white text-[#00236f] font-mono font-bold px-1.5 py-0.5 rounded border border-[#dae2fd] hover:bg-[#eaedff]"
                  >
                    vportillovillela@gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGoogleAccount('ia.vitalialimentos.dev@gmail.com')}
                    className="bg-white text-[#00236f] font-mono font-bold px-1.5 py-0.5 rounded border border-[#dae2fd] hover:bg-[#eaedff]"
                  >
                    ia.vitalialimentos.dev@gmail.com
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RESULTADO DE LA VERIFICACIÓN EN LA TABLA usuariosMoviles  */}
          {/* ========================================================= */}
          {isGoogleAccountRegistered && googleUserMatch ? (
            /* CASO 1: CUENTA SÍ ESTÁ REGISTRADA EN usuariosMoviles */
            <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ✓
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-950">
                      Cuenta registrada en usuariosMoviles
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      {googleUserMatch.firstName} {googleUserMatch.lastName} • Rol: <strong>{googleUserMatch.typeUser}</strong>
                    </span>
                  </div>
                </div>

                {currentUser?.correo.toLowerCase() === googleUserMatch.correo.toLowerCase() ? (
                  <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0 shadow-xs">
                    Sesión Activa
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickLogin(googleUserMatch.correo)}
                    disabled={loading}
                    className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    {loading ? 'Iniciando...' : 'Ingresar →'}
                  </button>
                )}
              </div>

              {/* DETALLE DEL CAMPO codCliente EN usuariosMoviles */}
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">
                    Campo <code>codCliente</code> en usuariosMoviles:
                  </span>
                  <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                    {googleUserMatch.codCliente || '[Vacío / Sin asignar]'}
                  </span>
                </div>

                {/* Lista de clientes contenidos en codCliente */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wide">
                    Salas / Clientes correspondientes ({googleUserClientsDetails.length}):
                  </span>

                  {googleUserClientsDetails.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {googleUserClientsDetails.map((cli) => (
                        <div
                          key={cli.code}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#faf8ff] border border-[#e2e8ff] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-xs bg-[#00236f] text-white px-2 py-0.5 rounded shrink-0">
                              {cli.code}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-[#131b2e] truncate">
                                {cli.nombre}
                              </span>
                              <span className="text-[10px] text-[#757682] truncate">
                                Sup: {cli.supervisor}
                              </span>
                            </div>
                          </div>
                          {cli.existsInClientes ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                              En Catálogo
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                              Solo en codCliente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                      <span>Este usuario no tiene clientes configurados en el campo <code>codCliente</code>.</span>
                      <button
                        type="button"
                        onClick={() => handleOpenRegisterModal(googleUserMatch)}
                        className="text-[#00236f] font-bold underline text-[11px] shrink-0 ml-2"
                      >
                        Asignar salas
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenRegisterModal(googleUserMatch)}
                    className="text-[11px] font-bold text-[#00236f] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>✏️</span>
                    <span>Modificar clientes asignados (codCliente)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* CASO 2: CUENTA NO ESTÁ REGISTRADA EN usuariosMoviles */
            <div className="rounded-xl p-3.5 bg-amber-50 border border-amber-200 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ⚠️
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-amber-950">
                    Aviso: La cuenta de Google no está en usuariosMoviles
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    El correo <strong>{googleEmail}</strong> no existe en la tabla <strong>usuariosmoviles</strong> de Supabase.
                  </p>
                </div>
              </div>

              {/* Mensaje del campo codCliente para cuenta no registrada */}
              <div className="p-2 rounded-lg bg-white/80 border border-amber-200 text-xs text-amber-900">
                <span className="font-semibold">Campo codCliente: </span>
                <span>Al no estar registrada la cuenta en la tabla <code>usuariosMoviles</code>, no cuenta con salas ni clientes asignados en <code>codCliente</code>.</span>
              </div>

              {/* Botón directo para registrarla en Supabase */}
              <button
                type="button"
                onClick={() => handleOpenRegisterModal()}
                className="w-full h-10 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>➕</span>
                <span>Registrar "{googleEmail}" en usuariosMoviles</span>
              </button>
            </div>
          )}

          {/* Nota de bitácora */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#444651] pt-1 border-t border-[#f2f3ff]">
            <span>📝</span>
            <span>
              La cuenta activa registrará la bitácora (<code>usuarioCreo</code> / <code>usuarioModifico</code>) en <strong>encabezadoPedido</strong> y <strong>detallePedido</strong>.
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* OTRAS CUENTAS EN usuariosMoviles & SUS CLIENTES EN codCliente            */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#00236f]">👥</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#00236f]">
                Cuentas en tabla usuariosMoviles ({allUsers.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleOpenRegisterModal()}
              className="text-[11px] text-[#00236f] font-bold hover:underline cursor-pointer"
            >
              + Nuevo Usuario
            </button>
          </div>

          <p className="text-xs text-[#757682]">
            Visualiza los clientes que tiene cada usuario en el campo <strong>codCliente</strong> de la tabla de Supabase:
          </p>

          <div className="flex flex-col gap-2">
            {allUsers.map((user) => {
              const isCurrent = currentUser?.correo.toLowerCase() === user.correo.toLowerCase();
              const codes = parseClientCodes(user.codCliente);

              return (
                <div
                  key={user.correo}
                  className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                    isCurrent
                      ? 'bg-[#f2f3ff] border-[#00236f] ring-1 ring-[#00236f]/30'
                      : 'bg-white border-[#e2e8ff] hover:bg-[#faf8ff]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#131b2e] truncate">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#eaedff] text-[#00236f] font-bold">
                          {user.typeUser}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#444651] truncate">
                        {user.correo}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent ? (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                          Activo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(user.correo)}
                          className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer shadow-xs"
                        >
                          Usar →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Campo codCliente y Salas asociadas */}
                  <div className="p-2 rounded-lg bg-[#faf8ff] border border-[#eaedff] text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#757682] font-semibold">Valor en campo codCliente:</span>
                      <span className="font-mono font-bold text-[#00236f] bg-white px-1.5 py-0.5 rounded border border-[#dae2fd]">
                        {user.codCliente || '[Vacío]'}
                      </span>
                    </div>

                    {codes.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10px] text-[#757682] font-semibold">Salas ({codes.length}):</span>
                        {codes.map((code) => {
                          const cliMatch = allClientes.find(
                            (c) => c.codCliente.toLowerCase() === code.toLowerCase()
                          );
                          return (
                            <span
                              key={code}
                              className="text-[10px] font-mono font-bold bg-white text-[#00236f] px-1.5 py-0.5 rounded border border-[#dae2fd]"
                              title={cliMatch?.nombreCliente || code}
                            >
                              {code} {cliMatch ? `(${cliMatch.nombreCliente})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-700 italic">
                        Sin salas vinculadas en codCliente.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {allUsers.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-900">
                <p>No se encontraron registros en la tabla <strong>usuariosmoviles</strong> de Supabase.</p>
                <button
                  type="button"
                  onClick={() => handleOpenRegisterModal()}
                  className="mt-2 text-[#00236f] font-bold underline"
                >
                  Crear primer usuario ahora
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SELECCIÓN DE SALA DE TRABAJO (SI HAY USUARIO EN SESIÓN)                   */}
        {/* ========================================================================= */}
        {currentUser && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base text-[#00236f]">🏪</span>
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#00236f]">
                  Selección de Sala de Trabajo
                </span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="text-[11px] text-red-600 hover:underline font-bold cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>

            <p className="text-xs text-[#444651]">
              {assignedSalas.length > 0
                ? `Salas asignadas a tu cuenta en codCliente (${assignedSalas.length}):`
                : `Mostrando salas disponibles desde la tabla Clientes (${allClientes.length}):`}
            </p>

            <div className="flex flex-col gap-2">
              {effectiveSalas.map((sala) => {
                const isSelected = selectedCod === sala.codCliente;
                const sup = allSupervisores.find((s) => s.idSupervisor === sala.idSupervisor);

                return (
                  <label
                    key={sala.codCliente}
                    onClick={() => setSelectedCod(sala.codCliente)}
                    className={`cursor-pointer block relative rounded-xl p-3 transition-all border ${
                      isSelected
                        ? 'bg-white shadow-sm border-[#00236f] ring-2 ring-[#00236f]/20'
                        : 'bg-white/80 border-[#e2e8ff] hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selected_client"
                      value={sala.codCliente}
                      checked={isSelected}
                      onChange={() => setSelectedCod(sala.codCliente)}
                      className="sr-only"
                    />

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-[#00236f]' : 'bg-[#e2e7ff]'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-transparent'
                            }`}
                          />
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] leading-snug truncate">
                            {sala.nombreCliente}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-[#00236f]">
                            {sala.codCliente}
                          </span>
                          <span className="text-[10px] text-[#757682] mt-0.5">
                            Supervisor: {sup ? sup.nombreSupervisor : sala.idSupervisor}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#fd651e] text-white text-[10px] font-bold shadow-xs">
                          Seleccionada
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}

              {effectiveSalas.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-xs text-amber-800">
                  No hay salas registradas en Supabase.
                </div>
              )}
            </div>

            {/* Botón Principal para Confirmar Sala y Empezar a Operar */}
            <button
              type="button"
              disabled={!selectedCod}
              onClick={handleConfirm}
              className="w-full h-12 mt-1 bg-[#00236f] hover:bg-[#1e3a8a] active:scale-[0.99] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <span>Confirmar Sala e Iniciar Pedido</span>
              <span>→</span>
            </button>
          </section>
        )}

        {/* Footer Utilities */}
        <div className="flex items-center justify-between text-xs text-[#757682] px-1">
          <span>Supabase: {dbStatus}</span>
          <button
            type="button"
            onClick={loadSupabaseData}
            className="text-[#00236f] hover:underline font-bold"
          >
            Refrescar 🔄
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL PARA REGISTRAR O EDITAR USUARIO EN usuariosMoviles (CON codCliente)  */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-[#dae2fd] flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl text-[#00236f]">👤</span>
                <div className="flex flex-col">
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#131b2e]">
                    {isEditingExisting ? 'Modificar Usuario & codCliente' : 'Registrar en usuariosMoviles'}
                  </h3>
                  <span className="text-[11px] text-[#757682]">
                    Guarda directamente en la tabla de Supabase
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserInSupabase} className="flex flex-col gap-3 text-xs">
              {/* Correo */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e]">
                  Correo de la cuenta de Google / Usuario:
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={isEditingExisting}
                  className="h-10 px-3 bg-[#f2f3ff] border border-[#dae2fd] rounded-xl font-mono text-xs font-bold text-[#00236f] focus:outline-none focus:bg-white disabled:opacity-60"
                />
              </div>

              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#131b2e]">Nombre (firstName):</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="ej. Víctor"
                    className="h-10 px-3 bg-[#f2f3ff] border border-[#dae2fd] rounded-xl font-bold text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#131b2e]">Apellido (lastName):</label>
                  <input
                    type="text"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="ej. Portillo"
                    className="h-10 px-3 bg-[#f2f3ff] border border-[#dae2fd] rounded-xl font-bold text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Rol */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e]">Rol (typeUser):</label>
                <select
                  value={regTypeUser}
                  onChange={(e) => setRegTypeUser(e.target.value as UserRole)}
                  className="h-10 px-3 bg-[#f2f3ff] border border-[#dae2fd] rounded-xl font-bold text-xs text-[#00236f] focus:outline-none focus:bg-white"
                >
                  <option value="ADMIN">ADMIN (Acceso total & Catálogos)</option>
                  <option value="DISPLAY">DISPLAY (Preventa Móvil)</option>
                </select>
              </div>

              {/* SELECCIÓN Y ASIGNACIÓN AL CAMPO codCliente */}
              <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-[#f2f3ff] border border-[#dae2fd]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#00236f]">
                    🏪 Campo codCliente (Salas asignadas):
                  </span>
                  <span className="text-[10px] text-[#757682]">
                    Selecciona o escribe códigos
                  </span>
                </div>

                <p className="text-[11px] text-[#444651]">
                  Los códigos seleccionados se guardarán en el campo <code>codCliente</code> de la tabla <strong>usuariosMoviles</strong>:
                </p>

                {/* Checkboxes de clientes existentes */}
                {allClientes.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 p-1 bg-white rounded-xl border border-[#dae2fd]">
                    {allClientes.map((c) => {
                      const isChecked = regSelectedSalas.includes(c.codCliente);
                      return (
                        <label
                          key={c.codCliente}
                          className="flex items-center gap-2 p-1.5 hover:bg-[#f2f3ff] rounded-lg cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRegSelectedSalas([...regSelectedSalas, c.codCliente]);
                              } else {
                                setRegSelectedSalas(regSelectedSalas.filter((code) => code !== c.codCliente));
                              }
                            }}
                            className="rounded text-[#00236f] focus:ring-[#00236f]"
                          />
                          <span className="font-mono font-bold text-[#00236f]">{c.codCliente}</span>
                          <span className="text-[#131b2e] truncate">{c.nombreCliente}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800 italic">
                    No hay clientes en la tabla Clientes todavía. Escribe los códigos manualmente abajo:
                  </p>
                )}

                {/* Input libre para codCliente */}
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[10px] text-[#757682] font-semibold">
                    Códigos manuales o adicionales (separados por coma):
                  </span>
                  <input
                    type="text"
                    value={regCustomCodes}
                    onChange={(e) => setRegCustomCodes(e.target.value)}
                    placeholder="CLI-001, CLI-002, CLI-014"
                    className="h-9 px-2.5 bg-white border border-[#dae2fd] rounded-lg font-mono text-xs font-bold text-[#00236f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold rounded-xl shadow-md cursor-pointer disabled:bg-gray-400"
                >
                  {isSavingUser ? 'Guardando en Supabase...' : 'Guardar en usuariosMoviles'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
