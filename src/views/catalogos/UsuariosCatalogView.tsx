import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DatabaseService } from '../../lib/supabase';
import { UsuarioMovil, Cliente, UserRole } from '../../types/database';

export const UsuariosCatalogView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast } = useApp();

  const [usuarios, setUsuarios] = useState<UsuarioMovil[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [userSalasMap, setUserSalasMap] = useState<Record<string, Cliente[]>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  // Form fields
  const [correo, setCorreo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [typeUser, setTypeUser] = useState<UserRole>('DISPLAY');
  const [selectedSalas, setSelectedSalas] = useState<string[]>([]);
  const [codClienteInput, setCodClienteInput] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uList, cList] = await Promise.all([
        DatabaseService.getUsuarios(),
        DatabaseService.getClientes(),
      ]);
      setUsuarios(uList);
      setClientes(cList);

      // Cargar salas asociadas para cada usuario desde Supabase
      const map: Record<string, Cliente[]> = {};
      await Promise.all(
        uList.map(async (u) => {
          map[u.correo] = await DatabaseService.getClientesForUsuario(u.correo, u);
        })
      );
      setUserSalasMap(map);
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataVersion]);

  const handleOpenCreate = () => {
    setEditingEmail(null);
    setCorreo('');
    setFirstName('');
    setLastName('');
    setTypeUser('DISPLAY');
    setSelectedSalas([]);
    setCodClienteInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (u: UsuarioMovil) => {
    setEditingEmail(u.correo);
    setCorreo(u.correo);
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setTypeUser(u.typeUser);

    try {
      const salas = await DatabaseService.getClientesForUsuario(u.correo, u);
      const codes = salas.map((c) => c.codCliente);
      setSelectedSalas(codes);
      setCodClienteInput(codes.join(', '));
    } catch {
      setSelectedSalas([]);
      setCodClienteInput('');
    }
    setIsFormOpen(true);
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`¿Eliminar usuario ${email} y sus asignaciones en usuarioClientes de Supabase?`)) return;

    try {
      await DatabaseService.deleteUsuario(email);
      showToast('Usuario Eliminado', `Registro ${email} suprimido de usuariosMoviles`, 'info');
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error al Eliminar', err.message, 'error');
    }
  };

  const toggleSalaSelection = (codCliente: string) => {
    const updated = selectedSalas.includes(codCliente)
      ? selectedSalas.filter((id) => id !== codCliente)
      : [...selectedSalas, codCliente];
    setSelectedSalas(updated);
    setCodClienteInput(updated.join(', '));
  };

  const handleCodClienteInputChange = (val: string) => {
    setCodClienteInput(val);
    const parts = val.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    setSelectedSalas(parts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correo.trim() || !firstName.trim() || !lastName.trim()) {
      showToast('Campos Requeridos', 'Completa correo, nombre y apellidos', 'warning');
      return;
    }

    const cleanEmail = correo.trim().toLowerCase();
    const finalCodes = selectedSalas.length > 0 ? selectedSalas : codClienteInput.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const codClienteString = finalCodes.join(', ');

    setIsSubmitting(true);

    try {
      if (editingEmail) {
        await DatabaseService.updateUsuario(editingEmail, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          typeUser,
          codCliente: codClienteString,
        });
      } else {
        await DatabaseService.createUsuario({
          correo: cleanEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          typeUser,
          codCliente: codClienteString,
        });
      }

      // Sincronizar asignaciones en la tabla intermedia usuarioClientes
      await DatabaseService.setClientesForUsuario(cleanEmail, finalCodes);

      showToast(
        editingEmail ? 'Usuario Actualizado' : 'Usuario Creado en Supabase',
        `Fila guardada en usuariosMoviles con codCliente [${codClienteString || 'ninguno'}] y ${finalCodes.length} sala(s) en usuarioClientes.`,
        'success'
      );

      setIsFormOpen(false);
      setEditingEmail(null);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = usuarios.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.correo.toLowerCase().includes(term) ||
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.typeUser.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f]">
            Catálogo de Usuarios & Asignación
          </h2>
          <span className="text-xs text-[#757682]">
            Gestión de usuarios y salas (tablas: <code className="font-mono text-[#fd651e] font-bold">usuariosMoviles</code> / <code className="font-mono text-[#fd651e] font-bold">usuarioClientes</code>)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchData}
            title="Recargar desde Supabase"
            className="p-2 bg-white hover:bg-[#eaedff] border border-[#e2e8ff] rounded-xl text-xs font-bold text-[#00236f] shadow-sm transition-colors cursor-pointer"
          >
            🔄
          </button>
          <button
            onClick={handleOpenCreate}
            className="bg-[#fd651e] hover:bg-[#a73a00] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>+</span>
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* CRUD Form Card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-[#dae2fd] flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#fd651e]">👤</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                {editingEmail ? `Editar Usuario ${editingEmail}` : 'Registrar Nuevo Usuario Móvil en Supabase'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">
              {editingEmail ? 'Modo Edición' : 'Modo Alta'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
            {/* Correo (PK) */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                correo (PK, Text - Google/Empresarial) *
              </label>
              <input
                type="email"
                required
                disabled={!!editingEmail}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-mono font-bold text-[#00236f] focus:outline-none focus:bg-white disabled:bg-gray-100"
              />
              <span className="text-[10px] text-[#757682]">
                Cuenta principal de autenticación móvil en Supabase.
              </span>
            </div>

            {/* Nombre y Apellidos */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                  firstName (Text) *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Víctor"
                  className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                  lastName (Text) *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="López Gómez"
                  className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* typeUser */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                typeUser (Enum: 'ADMIN', 'DISPLAY') *
              </label>
              <select
                value={typeUser}
                onChange={(e) => setTypeUser(e.target.value as UserRole)}
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-bold text-[#00236f] focus:outline-none cursor-pointer"
              >
                <option value="ADMIN">ADMIN (Acceso total & Desbloqueo de Domingos)</option>
                <option value="DISPLAY">DISPLAY (Toma de pedidos estándar)</option>
              </select>
            </div>

            {/* Asignación de Salas y campo codCliente en usuariosMoviles */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd]">
              <div className="flex justify-between items-center">
                <label className="font-bold text-[#00236f] uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <span>🏪 codCliente (En usuariosMoviles & usuarioClientes)</span>
                </label>
                <span className="text-[10px] text-[#fd651e] font-bold">
                  {selectedSalas.length} sala{selectedSalas.length !== 1 ? 's' : ''} asignada{selectedSalas.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#444651]">
                  Códigos de clientes asignados (separados por coma si son más de uno):
                </span>
                <input
                  type="text"
                  value={codClienteInput}
                  onChange={(e) => handleCodClienteInputChange(e.target.value)}
                  placeholder="Ej: CLI-001, CLI-002"
                  className="h-10 px-3 rounded-xl bg-white border border-[#dae2fd] font-mono font-bold text-xs text-[#00236f] focus:outline-none focus:border-[#00236f]"
                />
                <span className="text-[10px] text-[#757682]">
                  ℹ️ Puedes escribir los códigos o hacer clic en las salas del listado inferior para marcar/desmarcar. Si tiene más de una sala, el sistema le pedirá elegir sala al ingresar.
                </span>
              </div>

              <p className="text-[11px] font-bold text-[#131b2e] pt-1 border-t border-[#dae2fd]/60">
                Seleccionar desde catálogo de clientes disponibles:
              </p>

              <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pt-0.5">
                {clientes.map((c) => {
                  const isChecked = selectedSalas.includes(c.codCliente);
                  return (
                    <div
                      key={c.codCliente}
                      onClick={() => toggleSalaSelection(c.codCliente)}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#00236f] text-white border-[#00236f]'
                          : 'bg-white text-[#131b2e] border-[#dae2fd] hover:bg-[#eaedff]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {isChecked ? '☑' : '☐'}
                        </span>
                        <span className="font-semibold truncate">
                          {c.nombreCliente}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          isChecked ? 'bg-white/20 text-white' : 'bg-[#eaedff] text-[#00236f]'
                        }`}
                      >
                        {c.codCliente}
                      </span>
                    </div>
                  );
                })}
                {clientes.length === 0 && (
                  <p className="text-gray-400 italic text-[11px]">No hay clientes en Supabase todavía.</p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:bg-gray-400"
              >
                {isSubmitting ? (
                  <span>Guardando en Supabase...</span>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Guardar en Supabase</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-11 px-4 bg-[#eaedff] text-[#131b2e] rounded-xl font-semibold text-xs hover:bg-[#dae2fd]"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por correo, nombre o rol..."
          className="w-full h-10 px-3 pl-9 bg-white rounded-xl border border-[#e2e8ff] text-xs shadow-sm focus:outline-none focus:border-[#00236f]"
        />
        <span className="absolute left-3 top-3 text-gray-400 text-xs">🔍</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
          <span className="animate-spin text-base">🔄</span>
          <span>Consultando tablas de usuarios en Supabase...</span>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs text-[#757682] px-1">
            <span className="font-bold uppercase tracking-wider">
              Registros en Base de Datos ({filtered.length})
            </span>
            <span className="text-[#004942] font-semibold">PostgreSQL Live</span>
          </div>

          {filtered.map((u) => {
            const userSalas = userSalasMap[u.correo] || [];

            return (
              <div
                key={u.correo}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] hover:shadow-md transition-shadow flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {u.firstName.charAt(0)}
                      {u.lastName.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-xs text-[#444651] font-mono truncate">
                        {u.correo}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.typeUser === 'ADMIN'
                          ? 'bg-[#a73a00] text-white'
                          : 'bg-[#eaedff] text-[#00236f]'
                      }`}
                    >
                      {u.typeUser}
                    </span>
                    <span className="text-[10px] text-[#757682]">
                      {userSalas.length} sala{userSalas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* codCliente en usuariosMoviles */}
                <div className="flex items-center gap-1.5 text-[11px] bg-white p-1.5 rounded-lg border border-[#e2e8ff]">
                  <span className="text-[#757682] font-semibold">Campo codCliente:</span>
                  <span className="font-mono font-bold text-[#00236f] bg-[#eaedff] px-2 py-0.5 rounded">
                    {u.codCliente || 'Sin definir'}
                  </span>
                </div>

                {/* Salas Asignadas Pills */}
                <div className="bg-[#f2f3ff] p-2 rounded-xl flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-bold text-[#757682] uppercase tracking-wider">
                    Salas Comerciales Asignadas ({userSalas.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {userSalas.map((s) => (
                      <span
                        key={s.codCliente}
                        className="px-2 py-0.5 rounded-md bg-[#00236f] text-white font-mono text-[10px] font-semibold"
                      >
                        {s.codCliente} - {s.nombreCliente}
                      </span>
                    ))}
                    {userSalas.length === 0 && (
                      <span className="text-[11px] text-gray-400 italic">
                        Sin salas asignadas en usuarioClientes ni codCliente.
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#f2f3ff] text-xs">
                  <span className="text-[10px] text-[#757682] font-mono">
                    PK: {u.correo}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="px-2.5 py-1 bg-[#eaedff] text-[#00236f] hover:bg-[#dae2fd] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(u.correo)}
                      className="px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>🗑️</span>
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-gray-500 border border-[#e2e8ff] space-y-2">
              <p>No hay usuarios registrados en public.usuariosMoviles de Supabase.</p>
              <button
                onClick={handleOpenCreate}
                className="text-[#00236f] font-bold underline"
              >
                + Crear el primer usuario móvil ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
