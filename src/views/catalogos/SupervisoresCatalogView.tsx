import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DatabaseService } from '../../lib/supabase';
import { Supervisor, Cliente } from '../../types/database';

export const SupervisoresCatalogView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast } = useApp();

  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [idSupervisor, setIdSupervisor] = useState('');
  const [nombreSupervisor, setNombreSupervisor] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supList, cliList] = await Promise.all([
        DatabaseService.getSupervisores(),
        DatabaseService.getClientes(),
      ]);
      setSupervisores(supList);
      setClientes(cliList);
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
    setEditingId(null);
    setIdSupervisor(`SUP-0${Math.floor(5 + Math.random() * 5)}`);
    setNombreSupervisor('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sup: Supervisor) => {
    setEditingId(sup.idSupervisor);
    setIdSupervisor(sup.idSupervisor);
    setNombreSupervisor(sup.nombreSupervisor);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const clientsCount = clientes.filter((c) => c.idSupervisor === id).length;
    if (clientsCount > 0) {
      showToast(
        'Integridad Referencial',
        `No se puede eliminar ${id}: tiene ${clientsCount} cliente(s) asignado(s) en public.Clientes (FK).`,
        'error'
      );
      return;
    }

    if (!confirm(`¿Eliminar supervisor ${id} directamente de Supabase? Esta acción no se puede deshacer.`)) return;

    try {
      await DatabaseService.deleteSupervisor(id);
      showToast('Supervisor Eliminado', `Registro ${id} eliminado de public.Supervisor`, 'info');
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error al Eliminar', err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idSupervisor.trim() || !nombreSupervisor.trim()) {
      showToast('Campos Requeridos', 'Completa identificador y nombre', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await DatabaseService.updateSupervisor(editingId, {
          nombreSupervisor: nombreSupervisor.trim(),
        });
        showToast('Supervisor Actualizado', `Supervisor ${editingId} modificado en Supabase`, 'success');
      } else {
        await DatabaseService.createSupervisor({
          idSupervisor: idSupervisor.trim(),
          nombreSupervisor: nombreSupervisor.trim(),
        });
        showToast('Supervisor Creado', `Fila insertada en public.Supervisor (${idSupervisor.trim()})`, 'success');
      }

      setIsFormOpen(false);
      setEditingId(null);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = supervisores.filter((s) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return s.idSupervisor.toLowerCase().includes(term) || s.nombreSupervisor.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f]">
            Catálogo de Supervisores
          </h2>
          <span className="text-xs text-[#757682]">
            Gestión de supervisores (tabla: <code className="font-mono text-[#fd651e] font-bold">public.Supervisor</code>)
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
            <span>Nuevo Supervisor</span>
          </button>
        </div>
      </div>

      {/* CRUD Form Card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-[#dae2fd] flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#fd651e]">👔</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                {editingId ? `Editar Supervisor ${editingId}` : 'Registrar Nuevo Supervisor en Supabase'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">
              {editingId ? 'Modo Edición' : 'Modo Alta'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
            {/* idSupervisor */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                idSupervisor (PK, Text) *
              </label>
              <input
                type="text"
                required
                disabled={!!editingId}
                value={idSupervisor}
                onChange={(e) => setIdSupervisor(e.target.value)}
                placeholder="Ej. SUP-01"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-mono font-bold text-[#00236f] focus:outline-none focus:bg-white disabled:bg-gray-100"
              />
              <span className="text-[10px] text-[#757682]">
                Identificador alfanumérico primario en Supabase.
              </span>
            </div>

            {/* nombreSupervisor */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                nombreSupervisor (Text) *
              </label>
              <input
                type="text"
                required
                value={nombreSupervisor}
                onChange={(e) => setNombreSupervisor(e.target.value)}
                placeholder="Ej. Andrea Salgado"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
              />
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
          placeholder="Buscar por ID o nombre de supervisor..."
          className="w-full h-10 px-3 pl-9 bg-white rounded-xl border border-[#e2e8ff] text-xs shadow-sm focus:outline-none focus:border-[#00236f]"
        />
        <span className="absolute left-3 top-3 text-gray-400 text-xs">🔍</span>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
          <span className="animate-spin text-base">🔄</span>
          <span>Consultando tabla public.Supervisor en Supabase...</span>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs text-[#757682] px-1">
            <span className="font-bold uppercase tracking-wider">
              Registros en Base de Datos ({filtered.length})
            </span>
            <span className="text-[#004942] font-semibold">Relación 1:N con Clientes</span>
          </div>

          {filtered.map((sup) => {
            const clientCount = clientes.filter((c) => c.idSupervisor === sup.idSupervisor).length;

            return (
              <div
                key={sup.idSupervisor}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] hover:shadow-md transition-shadow flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {sup.nombreSupervisor.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00164e] font-mono text-[11px] font-bold">
                          {sup.idSupervisor}
                        </span>
                        <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                          {sup.nombreSupervisor}
                        </span>
                      </div>

                      <span className="text-xs text-[#757682] mt-0.5">
                        Salas a cargo: <strong className="text-[#00236f]">{clientCount} clientes</strong>
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-[#004942] bg-[#89f5e7]/30 px-2 py-0.5 rounded-full shrink-0">
                    En Supabase
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#f2f3ff] text-xs">
                  <span className="text-[10px] text-[#757682] font-mono">
                    PK: {sup.idSupervisor}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sup)}
                      className="px-2.5 py-1 bg-[#eaedff] text-[#00236f] hover:bg-[#dae2fd] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sup.idSupervisor)}
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
              <p>No hay supervisores registrados en public.Supervisor de Supabase.</p>
              <button
                onClick={handleOpenCreate}
                className="text-[#00236f] font-bold underline"
              >
                + Crear el primer supervisor ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
