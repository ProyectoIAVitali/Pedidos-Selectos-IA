import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DatabaseService } from '../../lib/supabase';
import { Cliente, Supervisor } from '../../types/database';

export const ClientesCatalogView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast } = useApp();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCod, setEditingCod] = useState<string | null>(null);

  // Form fields
  const [codCliente, setCodCliente] = useState('CLI-001');
  const [nombreCliente, setNombreCliente] = useState('');
  const [idSupervisor, setIdSupervisor] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cliList, supList] = await Promise.all([
        DatabaseService.getClientes(),
        DatabaseService.getSupervisores(),
      ]);
      setClientes(cliList);
      setSupervisores(supList);
      if (supList.length > 0 && !idSupervisor) {
        setIdSupervisor(supList[0].idSupervisor);
      }
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
    setEditingCod(null);
    setCodCliente(`CLI-${Math.floor(100 + Math.random() * 900)}`);
    setNombreCliente('');
    setIdSupervisor(supervisores[0]?.idSupervisor || '');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCod(cliente.codCliente);
    setCodCliente(cliente.codCliente);
    setNombreCliente(cliente.nombreCliente);
    setIdSupervisor(cliente.idSupervisor);
    setIsFormOpen(true);
  };

  const handleDelete = async (cod: string) => {
    if (!confirm(`¿Confirma eliminar cliente ${cod} directamente en Supabase? Esta acción no se puede deshacer.`)) return;

    try {
      await DatabaseService.deleteCliente(cod);
      showToast('Fila Eliminada', `El registro ${cod} fue suprimido de Supabase (public.Clientes).`, 'info');
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error al Eliminar', err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codCliente.trim() || !nombreCliente.trim() || !idSupervisor) {
      showToast('Campos Requeridos', 'Por favor llena todos los campos obligatorios incluyendo supervisor', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCod) {
        await DatabaseService.updateCliente(editingCod, {
          nombreCliente: nombreCliente.trim(),
          idSupervisor,
        });
        showToast('Cliente Actualizado', `Registro ${editingCod} actualizado en Supabase`, 'success');
      } else {
        await DatabaseService.createCliente({
          codCliente: codCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          idSupervisor,
        });
        showToast('Insert Supabase Exitoso', `Cliente ${codCliente.trim()} creado en public.Clientes`, 'success');
      }

      setIsFormOpen(false);
      setEditingCod(null);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const sup = supervisores.find((s) => s.idSupervisor === c.idSupervisor);
    const supName = sup ? sup.nombreSupervisor.toLowerCase() : '';
    return (
      c.codCliente.toLowerCase().includes(term) ||
      c.nombreCliente.toLowerCase().includes(term) ||
      supName.includes(term)
    );
  });

  const getSupervisorName = (id: string) => {
    const s = supervisores.find((item) => item.idSupervisor === id);
    return s ? s.nombreSupervisor : id;
  };

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f] tracking-tight">
            Catálogo de Clientes / Salas
          </h2>
          <span className="text-xs text-[#757682]">
            Gestión directa de entidades maestras (tabla: <code className="font-mono text-[#fd651e] font-bold">public.Clientes</code>)
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
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* CRUD Form Card (Matches Image 5) */}
      {isFormOpen && (
        <div className="bg-[#f2f3ff] rounded-2xl p-4 shadow-sm border border-[#dae2fd] flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-[#dae2fd]">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#a73a00]">📝</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                {editingCod ? 'Editar Cliente Existente' : 'Registrar Cliente / Sala en Supabase'}
              </span>
            </div>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                editingCod
                  ? 'bg-[#ffdbce] text-[#a73a00]'
                  : 'bg-[#e2e7ff] text-[#00236f]'
              }`}
            >
              {editingCod ? 'Modo Edición' : 'Modo Alta'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
            {/* codCliente (PK, TEXT) */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#444651] uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span>codCliente (PK, Text)</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-sm">🔑</span>
                <input
                  type="text"
                  required
                  disabled={!!editingCod}
                  value={codCliente}
                  onChange={(e) => setCodCliente(e.target.value)}
                  placeholder="CLI-001"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white text-[#131b2e] font-mono font-bold text-sm border border-[#dae2fd] focus:outline-none focus:border-[#00236f] shadow-sm disabled:bg-gray-100"
                />
              </div>
              <span className="text-[10px] text-[#757682]">
                Identificador alfanumérico primario e inmutable en Supabase.
              </span>
            </div>

            {/* nombreCliente (TEXT) */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#444651] uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span>nombreCliente (Text)</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-sm">🏪</span>
                <input
                  type="text"
                  required
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Ej. Supermercado La Colonia #4"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white text-[#131b2e] font-semibold text-sm border border-[#dae2fd] focus:outline-none focus:border-[#00236f] shadow-sm"
                />
              </div>
            </div>

            {/* idSupervisor (FK RELACIÓN 1:N) */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#444651] uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>idSupervisor (FK Relación 1:N)</span>
                  <span className="text-red-500">*</span>
                </span>
                <span className="text-[10px] text-[#00236f] font-mono lowercase">
                  fk_supervisor_id
                </span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-sm">👔</span>
                <select
                  value={idSupervisor}
                  onChange={(e) => setIdSupervisor(e.target.value)}
                  required
                  className="w-full h-11 pl-9 pr-8 rounded-xl bg-white text-[#131b2e] font-semibold text-sm border border-[#dae2fd] focus:outline-none focus:border-[#00236f] shadow-sm appearance-none cursor-pointer"
                >
                  {supervisores.length === 0 && (
                    <option value="">No hay supervisores en Supabase (Crea uno primero)</option>
                  )}
                  {supervisores.map((s) => (
                    <option key={s.idSupervisor} value={s.idSupervisor}>
                      {s.idSupervisor} - {s.nombreSupervisor}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 text-gray-400 pointer-events-none text-xs">
                  ▼
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:bg-gray-400"
              >
                {isSubmitting ? (
                  <span>Guardando en Supabase...</span>
                ) : (
                  <>
                    <span>☁️</span>
                    <span>Guardar en Supabase</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-11 px-4 bg-[#e2e7ff] text-[#131b2e] rounded-xl font-semibold text-xs hover:bg-[#dae2fd]"
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
          placeholder="Buscar por código, nombre o supervisor..."
          className="w-full h-10 px-3 pl-9 bg-white rounded-xl border border-[#e2e8ff] text-xs shadow-sm focus:outline-none focus:border-[#00236f]"
        />
        <span className="absolute left-3 top-3 text-gray-400 text-xs">🔍</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
          <span className="animate-spin text-base">🔄</span>
          <span>Consultando tabla public.Clientes en Supabase...</span>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold uppercase tracking-wider text-[#444651] flex items-center gap-1.5">
              <span>💾</span>
              <span>Registros en Base de Datos ({filteredClientes.length})</span>
            </span>
            <span className="font-bold text-[#fd651e]">Supabase Live</span>
          </div>

          {filteredClientes.map((cliente) => {
            const supName = getSupervisorName(cliente.idSupervisor);

            return (
              <div
                key={cliente.codCliente}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] hover:shadow-md transition-shadow flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00164e] font-mono text-[11px] font-bold">
                        {cliente.codCliente}
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                        {cliente.nombreCliente}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-xs text-[#444651]">
                      <span>👤</span>
                      <span>Supervisor: <strong className="text-[#131b2e]">{supName}</strong></span>
                      <span className="text-[10px] text-[#757682] font-mono">
                        ({cliente.idSupervisor})
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004942] bg-[#89f5e7]/30 px-2 py-0.5 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ebdb0]" />
                    En Supabase
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#f2f3ff] text-xs">
                  <span className="text-[10px] text-[#757682] font-mono">
                    FK: {cliente.idSupervisor}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cliente)}
                      className="px-3 py-1 bg-[#eaedff] text-[#00236f] hover:bg-[#dae2fd] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cliente.codCliente)}
                      className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>🗑️</span>
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredClientes.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-gray-500 border border-[#e2e8ff] space-y-2">
              <p>No hay clientes registrados en public.Clientes de Supabase.</p>
              <button
                onClick={handleOpenCreate}
                className="text-[#00236f] font-bold underline"
              >
                + Crear el primer cliente ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
