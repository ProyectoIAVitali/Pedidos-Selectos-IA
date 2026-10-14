import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DatabaseService } from '../../lib/supabase';
import { Producto, ClasificacionProducto } from '../../types/database';

const CLASIFICACIONES: ClasificacionProducto[] = [
  'POLLO FRESCO',
  'EMBUTIDOS',
  'EMPANIZADOS',
  'HUGO PORK',
  'POLLO CAFETERIA',
];

export const ProductosCatalogView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast } = useApp();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCod, setEditingCod] = useState<string | null>(null);

  // Form fields
  const [codProducto, setCodProducto] = useState('');
  const [nombreProducto, setNombreProducto] = useState('');
  const [clasificacion, setClasificacion] = useState<ClasificacionProducto>('POLLO FRESCO');
  const [precioKg, setPrecioKg] = useState('48.50');
  const [unidad, setUnidad] = useState('kg');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('TODAS');

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getProductos();
      setProductos(data);
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [dataVersion]);

  const handleOpenCreate = () => {
    setEditingCod(null);
    setCodProducto(`PROD-PF-${Math.floor(100 + Math.random() * 900)}`);
    setNombreProducto('');
    setClasificacion('POLLO FRESCO');
    setPrecioKg('45.00');
    setUnidad('kg');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: Producto) => {
    setEditingCod(p.codProducto);
    setCodProducto(p.codProducto);
    setNombreProducto(p.nombreProducto);
    setClasificacion(p.Clasificacion);
    setPrecioKg((p.precioKg || 0).toString());
    setUnidad(p.unidad || 'kg');
    setIsFormOpen(true);
  };

  const handleDelete = async (cod: string) => {
    if (!confirm(`¿Eliminar producto ${cod} directamente de Supabase? Esta acción no se puede deshacer.`)) return;
    try {
      await DatabaseService.deleteProducto(cod);
      showToast('Producto Eliminado', `Registro ${cod} eliminado de public.Productos`, 'info');
      triggerRefresh();
      fetchProductos();
    } catch (err: any) {
      showToast('Error al Eliminar', err.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codProducto.trim() || !nombreProducto.trim()) {
      showToast('Campos Requeridos', 'Por favor llena código y nombre de producto', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCod) {
        await DatabaseService.updateProducto(editingCod, {
          nombreProducto: nombreProducto.trim(),
          Clasificacion: clasificacion,
          precioKg: parseFloat(precioKg) || 0,
          unidad: unidad.trim() || 'kg',
        });
        showToast('Producto Actualizado', `Registro ${editingCod} actualizado en Supabase`, 'success');
      } else {
        await DatabaseService.createProducto({
          codProducto: codProducto.trim(),
          nombreProducto: nombreProducto.trim(),
          Clasificacion: clasificacion,
          precioKg: parseFloat(precioKg) || 0,
          unidad: unidad.trim() || 'kg',
        });
        showToast('Producto Creado', `Fila insertada en public.Productos (${codProducto.trim()})`, 'success');
      }

      setIsFormOpen(false);
      setEditingCod(null);
      triggerRefresh();
      fetchProductos();
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = productos.filter((p) => {
    if (filterCat !== 'TODAS' && p.Clasificacion !== filterCat) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.codProducto.toLowerCase().includes(term) ||
      p.nombreProducto.toLowerCase().includes(term) ||
      p.Clasificacion.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#00236f]">
            Catálogo de Productos
          </h2>
          <span className="text-xs text-[#757682]">
            5 familias de proteína (tabla: <code className="font-mono text-[#fd651e] font-bold">public.Productos</code>)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchProductos}
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
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* CRUD Form Card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-[#dae2fd] flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="text-base text-[#fd651e]">📦</span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e]">
                {editingCod ? `Editar Producto ${editingCod}` : 'Registrar Nuevo Producto en Supabase'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">
              {editingCod ? 'Modo Edición' : 'Modo Alta'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
            {/* codProducto */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                codProducto (PK, Text) *
              </label>
              <input
                type="text"
                required
                disabled={!!editingCod}
                value={codProducto}
                onChange={(e) => setCodProducto(e.target.value)}
                placeholder="PROD-PF-001"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-mono font-bold text-[#00236f] focus:outline-none focus:bg-white disabled:bg-gray-100"
              />
            </div>

            {/* nombreProducto */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                nombreProducto (Text) *
              </label>
              <input
                type="text"
                required
                value={nombreProducto}
                onChange={(e) => setNombreProducto(e.target.value)}
                placeholder="Ej. Pechuga Especial con Hueso"
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
              />
            </div>

            {/* Clasificacion */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                Clasificación (Enum: 5 familias válidas) *
              </label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value as ClasificacionProducto)}
                className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-bold text-[#00236f] focus:outline-none cursor-pointer"
              >
                {CLASIFICACIONES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Precio & Unidad */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                  Precio Referencial (L.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={precioKg}
                  onChange={(e) => setPrecioKg(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-mono font-bold text-[#00236f] focus:outline-none focus:bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#131b2e] uppercase tracking-wider text-[11px]">
                  Unidad
                </label>
                <input
                  type="text"
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  placeholder="kg, caja, combo"
                  className="h-10 px-3 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] font-semibold text-[#131b2e] focus:outline-none focus:bg-white"
                />
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

      {/* Filter and Search */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o descripción..."
          className="w-full h-10 px-3 bg-white rounded-xl border border-[#e2e8ff] text-xs shadow-sm focus:outline-none focus:border-[#00236f]"
        />

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
          {['TODAS', ...CLASIFICACIONES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                filterCat === cat
                  ? 'bg-[#00236f] text-white shadow-sm'
                  : 'bg-[#eaedff] text-[#444651] hover:bg-[#dae2fd]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
          <span className="animate-spin text-base">🔄</span>
          <span>Consultando tabla public.Productos en Supabase...</span>
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

          {filtered.map((prod) => (
            <div
              key={prod.codProducto}
              className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00164e] font-mono text-[11px] font-bold">
                      {prod.codProducto}
                    </span>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                      {prod.nombreProducto}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-[#eaedff] text-[#00236f] px-2 py-0.5 rounded font-bold text-[10px] uppercase font-mono">
                      {prod.Clasificacion}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#00236f] font-mono block">
                    L. {(prod.precioKg || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#757682]">
                    por {prod.unidad || 'kg'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#f2f3ff] text-xs">
                <span className="text-[10px] text-[#757682] font-mono">
                  PK: {prod.codProducto}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(prod)}
                    className="px-2.5 py-1 bg-[#eaedff] text-[#00236f] hover:bg-[#dae2fd] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prod.codProducto)}
                    className="px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>🗑️</span>
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-gray-500 border border-[#e2e8ff] space-y-2">
              <p>No hay productos registrados en public.Productos de Supabase.</p>
              <button
                onClick={handleOpenCreate}
                className="text-[#00236f] font-bold underline"
              >
                + Crear el primer producto ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
