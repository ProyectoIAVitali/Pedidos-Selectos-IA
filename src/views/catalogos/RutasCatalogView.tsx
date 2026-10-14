import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DatabaseService } from '../../lib/supabase';
import { Ruta, PlantelEnum } from '../../types/database';

export const RutasCatalogView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast } = useApp();

  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCod, setEditingCod] = useState<string | null>(null);

  // Form fields
  const [codRuta, setCodRuta] = useState('');
  const [nombreRuta, setNombreRuta] = useState('');
  const [plantel, setPlantel] = useState<PlantelEnum>('AT');

  // Search & filter
  const [search, setSearch] = useState('');
  const [plantelFilter, setPlantelFilter] = useState<string>('TODOS');

  const fetchRutas = async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getRutas();
      setRutas(data);
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRutas();
  }, [dataVersion]);

  const handleOpenCreate = () => {
    setEditingCod(null);
    setCodRuta(`RUTA-0${Math.floor(6 + Math.random() * 4)}`);
    setNombreRuta('');
    setPlantel('AT');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ruta: Ruta) => {
    setEditingCod(ruta.codRuta);
    setCodRuta(ruta.codRuta);
    setNombreRuta(ruta.nombreRuta);
    setPlantel(ruta.Plantel);
    setIsFormOpen(true);
  };

  const handleDelete = async (cod: string) => {
    if (!confirm(`¿Eliminar ruta ${cod} directamente de Supabase? Esta acción es permanente.`)) return;
    try {
      await DatabaseService.deleteRuta(cod);
      showToast('Ruta Eliminada', `Ruta ${cod} eliminada en public.Ruta`, 'info');
      triggerRefresh();
      fetchRutas();
    } catch (err: any) {
      showToast('Error al Eliminar', err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codRuta.trim() || !nombreRuta.trim()) {
      showToast('Campos Requeridos', 'Completa código y nombre de ruta', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCod) {
        await DatabaseService.updateRuta(editingCod, {
          nombreRuta: nombreRuta.trim(),
          Plantel: plantel,
        });
        showToast('Ruta Actualizada', `Ruta ${editingCod} modificada en Supabase`, 'success');
      } else {
        await DatabaseService.createRuta({
          codRuta: codRuta.trim(),
          nombreRuta: nombreRuta.trim(),
          Plantel: plantel,
        });
        showToast('Ruta Creada', `Fila insertada en public.Ruta (${codRuta.trim()})`, 'success');
      }

      setIsFormOpen(false);
      setEditingCod(null);
      triggerRefresh();
      fetchRutas();
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRutas = rutas.filter((r) => {
    if (plantelFilter !== 'TODOS' && r.Plantel !== plantelFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return r.codRuta.toLowerCase().includes(term) || r.nombreRuta.toLowerCase().includes(term);
  });

  const getPlantelLabel = (p: PlantelEnum) => {
    switch (p) {
      case 'AT':
        return 'AT (Atlántico)';
      case 'SM':
        return 'SM (San Martín)';
      case 'ST':
        return 'ST (Santa Teresa)';
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f]">
            Catálogo de Rutas
          </h2>
          <span className="text-xs text-[#757682]">
            Gestión de rutas de despacho (tabla: <code className="font-mono text-[#fd651e] font-bold">public.Ruta</code>)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchRutas}
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
            <span>Nueva Ruta</span>
          </button>
        </div>
      </div>

      {/* CRUD Form Card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-[#dae2fd] flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#fd651e]">🛣️</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                {editingCod ? `Editar Ruta ${editingCod}` : 'Registrar Nueva Ruta en Supabase'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">
              {editingCod ? 'Modo Edición' : 'Modo Alta'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
            {/* codRuta */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                codRuta (PK, Text) *
              </label>
              <input
                type="text"
                required
                disabled={!!editingCod}
                value={codRuta}
                onChange={(e) => setCodRuta(e.target.value)}
                placeholder="Ej. RUTA-01"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-mono font-bold text-[#00236f] focus:outline-none focus:bg-white disabled:bg-gray-100"
              />
              <span className="text-[10px] text-[#757682]">
                Identificador alfanumérico primario en Supabase.
              </span>
            </div>

            {/* nombreRuta */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                nombreRuta (Text) *
              </label>
              <input
                type="text"
                required
                value={nombreRuta}
                onChange={(e) => setNombreRuta(e.target.value)}
                placeholder="Ej. Ruta San Pedro Centro y Circunvalación"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
              />
            </div>

            {/* Plantel Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                Plantel (Enum: 'AT', 'SM', 'ST') *
              </label>
              <select
                value={plantel}
                onChange={(e) => setPlantel(e.target.value as PlantelEnum)}
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-bold text-[#00236f] focus:outline-none cursor-pointer"
              >
                <option value="AT">AT (Atlántico)</option>
                <option value="SM">SM (San Martín)</option>
                <option value="ST">ST (Santa Teresa)</option>
              </select>
            </div>

            {/* Action buttons */}
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

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por código o nombre..."
          className="flex-1 h-10 px-3 bg-white rounded-xl border border-[#e2e8ff] text-xs shadow-sm focus:outline-none focus:border-[#00236f]"
        />

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {['TODOS', 'AT', 'SM', 'ST'].map((p) => (
            <button
              key={p}
              onClick={() => setPlantelFilter(p)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                plantelFilter === p
                  ? 'bg-[#00236f] text-white'
                  : 'bg-[#eaedff] text-[#444651] hover:bg-[#dae2fd]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
          <span className="animate-spin text-base">🔄</span>
          <span>Consultando tabla public.Ruta en Supabase...</span>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs text-[#757682] px-1">
            <span className="font-bold uppercase tracking-wider">
              Registros en Base de Datos ({filteredRutas.length})
            </span>
            <span className="text-[#004942] font-semibold">PostgreSQL Live</span>
          </div>

          {filteredRutas.map((ruta) => (
            <div
              key={ruta.codRuta}
              className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00164e] font-mono text-[11px] font-bold">
                    {ruta.codRuta}
                  </span>
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                    {ruta.nombreRuta}
                  </span>
                </div>

                <span className="text-[11px] font-bold text-[#004942] bg-[#89f5e7]/30 px-2 py-0.5 rounded-full shrink-0">
                  En Supabase
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#444651]">
                <span>Plantel Asignado:</span>
                <span className="bg-[#eaedff] text-[#00236f] px-2 py-0.5 rounded font-bold text-[11px] font-mono">
                  {getPlantelLabel(ruta.Plantel)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#f2f3ff] text-xs">
                <span className="text-[10px] text-[#757682] font-mono">
                  PK: {ruta.codRuta}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ruta)}
                    className="px-2.5 py-1 bg-[#eaedff] text-[#00236f] hover:bg-[#dae2fd] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ruta.codRuta)}
                    className="px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>🗑️</span>
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredRutas.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-gray-500 border border-[#e2e8ff] space-y-2">
              <p>No hay registros de rutas en la tabla public.Ruta de Supabase.</p>
              <button
                onClick={handleOpenCreate}
                className="text-[#00236f] font-bold underline"
              >
                + Crear la primera ruta ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
