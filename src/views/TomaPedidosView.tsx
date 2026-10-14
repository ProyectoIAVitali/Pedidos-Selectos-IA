import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../lib/supabase';
import { ClasificacionProducto, OrderStatus, Producto } from '../types/database';

const CLASIFICACIONES: ClasificacionProducto[] = [
  'POLLO FRESCO',
  'EMBUTIDOS',
  'EMPANIZADOS',
  'HUGO PORK',
  'POLLO CAFETERIA',
];

export const TomaPedidosView: React.FC = () => {
  const {
    currentUser,
    activeSala,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    getCartTotalUnits,
    getCartDistinctCount,
    setCurrentTab,
    showToast,
    triggerRefresh,
    dataVersion,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<ClasificacionProducto>('POLLO FRESCO');
  const [products, setProducts] = useState<Producto[]>([]);
  const [loadingProds, setLoadingProds] = useState(true);

  // Campos de despacho
  const [fechaEntrega, setFechaEntrega] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1); // Salta domingo a lunes
    }
    return d.toISOString().split('T')[0];
  });

  const [allowSundayAdmin, setAllowSundayAdmin] = useState<boolean>(false);
  const [ordenVenta, setOrdenVenta] = useState<string>('202509180012');
  const [isOVAvailable, setIsOVAvailable] = useState<boolean>(true);
  const [checkingOV, setCheckingOV] = useState<boolean>(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Digitado');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Cargar productos directamente desde Supabase
  const loadProducts = async () => {
    setLoadingProds(true);
    try {
      const data = await DatabaseService.getProductos();
      setProducts(data);
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setLoadingProds(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [dataVersion]);

  // Verificar unicidad de Orden de Venta en Supabase
  useEffect(() => {
    const clean = ordenVenta.replace(/\D/g, '');
    if (clean.length < 10) {
      setIsOVAvailable(true);
      return;
    }

    let cancel = false;
    setCheckingOV(true);
    const timer = setTimeout(async () => {
      try {
        const available = await DatabaseService.isOrdenVentaAvailable(clean);
        if (!cancel) setIsOVAvailable(available);
      } catch {
        if (!cancel) setIsOVAvailable(true);
      } finally {
        if (!cancel) setCheckingOV(false);
      }
    }, 300);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [ordenVenta]);

  const filteredProducts = products.filter((p) => p.Clasificacion === selectedCategory);

  // Validación de Domingo
  const checkIsSunday = (dateStr: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.getDay() === 0;
  };

  const isSundaySelected = checkIsSunday(fechaEntrega);
  const isSundayBlocked = isSundaySelected && !allowSundayAdmin;

  // Validación de Orden de Venta
  const cleanOV = ordenVenta.replace(/\D/g, '');
  const isValidOVLength = cleanOV.length >= 10 && cleanOV.length <= 15;
  const isOVValid = isValidOVLength && isOVAvailable;

  const handleDateChange = (val: string) => {
    setFechaEntrega(val);
    if (checkIsSunday(val) && !allowSundayAdmin) {
      showToast(
        'Fecha Bloqueada',
        'Los domingos están bloqueados por defecto salvo autorización ADMIN.',
        'warning'
      );
    }
  };

  const handleSundayToggle = (checked: boolean) => {
    if (currentUser?.typeUser !== 'ADMIN') {
      showToast('Acceso Restringido', 'Solo administradores pueden habilitar entregas en domingo', 'error');
      return;
    }
    setAllowSundayAdmin(checked);
    if (checked) {
      showToast('Permiso Activo', 'Entregas en domingo habilitadas por temporada alta', 'info');
    }
  };

  const getProductQtyInCart = (cod: string) => {
    const item = cart.find((i) => i.producto.codProducto === cod);
    return item ? item.cantidad : 0;
  };

  // Guardar Pedido en Supabase
  const handleSubmitPedido = async () => {
    if (!activeSala) {
      showToast('Error', 'Debes seleccionar una sala activa para registrar el pedido', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Carrito Vacío', 'Agrega al menos 1 producto antes de grabar el pedido', 'warning');
      return;
    }

    if (isSundayBlocked) {
      showToast(
        'Regla de Despacho',
        'Día domingo bloqueado para entrega. Selecciona de lunes a sábado o activa permiso ADMIN.',
        'error'
      );
      return;
    }

    if (!isValidOVLength) {
      showToast(
        'Orden de Venta Inválida',
        `El código debe tener entre 10 y 15 dígitos numéricos (actual: ${cleanOV.length})`,
        'error'
      );
      return;
    }

    if (!isOVAvailable) {
      showToast(
        'Orden de Venta Duplicada',
        `La Orden de Venta "${cleanOV}" ya está en uso en otro pedido activo en Supabase.`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await DatabaseService.savePedidoConDetalles(
        {
          fechaEntrega,
          usuarioDigito: currentUser?.correo || 'desconocido@empresa.com',
          codCliente: activeSala.codCliente,
          ordenVenta: orderStatus === 'Anulado' ? null : cleanOV,
          orderStatus,
          cantidadProductos: getCartDistinctCount(), // Conteo exacto de productos digitados (ej. 2 productos distintos)
        },
        cart.map((i) => ({
          codProducto: i.producto.codProducto,
          cantidad: i.cantidad,
          precioUnitario: i.producto.precioKg || 0,
        }))
      );

      if (result.success) {
        showToast(
          '¡Pedido Guardado Exitosamente!',
          `Folio #${result.idPedido} registrado en Supabase (OV: ${cleanOV})`,
          'success'
        );
        clearCart();
        triggerRefresh();
        setTimeout(() => {
          setCurrentTab('mis-pedidos');
        }, 1200);
      } else {
        showToast('Error al Guardar', result.message || 'No se pudo registrar el pedido', 'error');
      }
    } catch (e: any) {
      showToast('Error Supabase', e.message || 'Fallo al impactar base de datos', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] pb-32 pt-2">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-3.5">
        {/* Context Strip / Operational Breadcrumb */}
        <section className="bg-[#e2e7ff] rounded-2xl p-3.5 shadow-sm border border-[#dae2fd]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-[#00236f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] truncate">
                {activeSala ? activeSala.nombreCliente : 'Sin Sala Seleccionada'}
              </span>
            </div>
            {activeSala && (
              <span className="bg-[#dce1ff] text-[#00164e] font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                {activeSala.codCliente}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5 text-xs text-[#444651]">
            <span className="truncate font-mono">
              {currentUser?.correo || 'Sin sesión'}
            </span>
            <span className="flex items-center gap-1 text-[#004942] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ebdb0] animate-pulse" />
              Ruta Activa
            </span>
          </div>
        </section>

        {/* Category Filter Tabs */}
        <section className="py-1 -mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {CLASIFICACIONES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-full text-xs font-['Inter'] font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#00236f] text-white shadow-sm scale-100'
                      : 'bg-[#eaedff] text-[#444651] hover:bg-[#dae2fd]'
                  }`}
                >
                  <span>
                    {cat === 'POLLO FRESCO' && '🍗'}
                    {cat === 'EMBUTIDOS' && '🌭'}
                    {cat === 'EMPANIZADOS' && '🍤'}
                    {cat === 'HUGO PORK' && '🥩'}
                    {cat === 'POLLO CAFETERIA' && '☕'}
                  </span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Product Catalog List */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#131b2e]">
              Catálogo de Productos
            </h2>
            <span className="text-[11px] font-bold bg-[#e2e7ff] text-[#00236f] px-2.5 py-0.5 rounded-full">
              {filteredProducts.length} artículos
            </span>
          </div>

          {loadingProds && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] border border-[#e2e8ff] flex items-center justify-center gap-2">
              <span className="animate-spin text-base">🔄</span>
              <span>Cargando productos desde Supabase...</span>
            </div>
          )}

          {!loadingProds && filteredProducts.map((prod) => {
            const currentQty = getProductQtyInCart(prod.codProducto);
            const isAdded = currentQty > 0;

            return (
              <div
                key={prod.codProducto}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#e2e8ff] flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] leading-snug">
                      {prod.nombreProducto}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-[#757682] font-semibold">
                        {prod.codProducto}
                      </span>
                      <span className="bg-[#eaedff] text-[#00236f] text-[10px] font-semibold px-1.5 py-0.2 rounded">
                        En Catálogo
                      </span>
                    </div>
                  </div>

                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#00236f] shrink-0 font-mono">
                    L. {(prod.precioKg || 45.0).toFixed(2)}
                    <span className="text-xs font-normal text-[#757682]">
                      {' '}/{prod.unidad || 'kg'}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {/* Stepper (+ / -) */}
                  <div className="flex items-center bg-[#eaedff] rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => updateCartQty(prod.codProducto, -1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-[#131b2e] hover:bg-white active:scale-90 transition-transform font-bold text-lg select-none"
                    >
                      −
                    </button>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#131b2e] w-10 text-center font-mono">
                      {currentQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentQty === 0) {
                          addToCart(prod, 1);
                        } else {
                          updateCartQty(prod.codProducto, 1);
                        }
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-[#131b2e] hover:bg-white active:scale-90 transition-transform font-bold text-lg select-none"
                    >
                      +
                    </button>
                  </div>

                  {/* Add / Added Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdded) {
                        addToCart(prod, 5);
                      }
                    }}
                    className={`h-11 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
                      isAdded
                        ? 'bg-[#e2e7ff] text-[#00236f]'
                        : 'bg-[#1e3a8a] text-white hover:bg-[#00236f]'
                    }`}
                  >
                    <span>{isAdded ? '✓' : '🛒'}</span>
                    <span>{isAdded ? 'Agregado' : '+ Agregar'}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {!loadingProds && filteredProducts.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-xs text-gray-500 border border-[#e2e8ff] space-y-2">
              <p>No hay productos en la categoría "{selectedCategory}" en Supabase.</p>
              <button
                onClick={() => setCurrentTab('catalogos')}
                className="text-[#00236f] font-bold underline"
              >
                Ir al Catálogo de Productos para crear ítems
              </button>
            </div>
          )}
        </section>

        {/* Live Cart Mini Badge Preview */}
        <section className="bg-[#00236f] text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl text-[#ffdbce]">
              🛒
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#dce1ff] font-bold block">
                Resumen del Carrito
              </span>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-white">
                {getCartDistinctCount()} productos distintos agregados
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#dce1ff] block font-semibold">
              Total Unidades
            </span>
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-white font-mono">
              {getCartTotalUnits()} unids
            </span>
          </div>
        </section>

        {/* Validaciones de Despacho & Formulario de Pedido */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e2e8ff] flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-[#eaedff]">
            <span className="text-lg text-[#fd651e]">📋</span>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#131b2e]">
              Validaciones de Despacho
            </h3>
          </div>

          {/* Campo 1: fechaEntrega */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fechaEntrega" className="text-xs font-bold text-[#131b2e]">
                Fecha de Entrega (fechaEntrega)
              </label>
              <span className="text-[11px] font-bold text-[#a73a00]">
                Obligatorio
              </span>
            </div>

            <div className="relative">
              <input
                id="fechaEntrega"
                type="date"
                value={fechaEntrega}
                onChange={(e) => handleDateChange(e.target.value)}
                className={`w-full h-12 px-3.5 bg-[#f2f3ff] text-[#131b2e] text-sm font-semibold rounded-xl border focus:outline-none transition-colors ${
                  isSundayBlocked
                    ? 'border-red-500 bg-red-50 text-red-900'
                    : 'border-[#dae2fd] focus:border-[#00236f]'
                }`}
              />
            </div>

            {/* Sunday Alert Banner */}
            {isSundayBlocked ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-2.5 flex items-start gap-2 text-xs">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <strong className="block font-bold">Día Domingo Bloqueado</strong>
                  <span>
                    No está permitido programar despachos en día domingo. Selecciona otra fecha o solicita permiso ADMIN.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-[#e2e7ff] rounded-xl p-2.5 flex items-start gap-2 text-xs text-[#444651]">
                <span className="text-sm leading-none">ℹ️</span>
                <p>
                  Días Domingo bloqueados por defecto (política de despacho logístico).
                </p>
              </div>
            )}

            {/* Admin Switch for Sunday Delivery */}
            {currentUser?.typeUser === 'ADMIN' && (
              <div className="bg-[#f2f3ff] rounded-xl p-3 flex items-center justify-between mt-1 border border-[#dae2fd]">
                <div className="flex flex-col min-w-0 pr-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#131b2e]">
                      Permitir entrega en Domingo
                    </span>
                    <span className="bg-[#ffdbce] text-[#a73a00] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      ADMIN
                    </span>
                  </div>
                  <span className="text-[#757682] text-[11px]">
                    Exclusivo ADMIN - Temporada Alta
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={allowSundayAdmin}
                    onChange={(e) => handleSundayToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#d2d9f4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fd651e]" />
                </label>
              </div>
            )}
          </div>

          {/* Campo 2: ordenVenta */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col">
              <label htmlFor="ordenVenta" className="text-xs font-bold text-[#131b2e]">
                Orden de Venta (ordenVenta)
              </label>
              <span className="text-[11px] text-[#444651]">
                10 a 15 dígitos requeridos, único en DB
              </span>
            </div>

            <div className="relative">
              <input
                id="ordenVenta"
                type="text"
                maxLength={15}
                value={ordenVenta}
                onChange={(e) => setOrdenVenta(e.target.value)}
                placeholder="202509180012"
                className={`w-full h-12 px-3.5 pr-10 bg-[#f2f3ff] text-[#131b2e] font-mono text-sm font-bold rounded-xl border focus:outline-none transition-colors ${
                  isOVValid
                    ? 'border-emerald-500 focus:border-emerald-600'
                    : 'border-red-400 focus:border-red-500'
                }`}
              />
              <span className="absolute right-3.5 top-3.5 text-base">
                {checkingOV ? '⏳' : isOVValid ? '✓' : '⚠️'}
              </span>
            </div>

            {/* Live Validation Badge */}
            <div
              className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold ${
                isOVValid
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOVValid ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="truncate">
                {isOVValid
                  ? `✓ Válido - ${cleanOV.length} dígitos y disponible en Supabase`
                  : !isValidOVLength
                  ? `Debe tener entre 10 y 15 dígitos numéricos (${cleanOV.length}/10)`
                  : 'Este número de orden ya está registrado en Supabase'}
              </span>
            </div>
          </div>

          {/* Campo 3: orderStatus */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="orderStatus" className="text-xs font-bold text-[#131b2e]">
              Estado del Pedido (orderStatus)
            </label>
            <div className="relative">
              <select
                id="orderStatus"
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                className="w-full h-12 px-3.5 bg-[#f2f3ff] text-[#131b2e] text-sm font-bold rounded-xl border border-[#dae2fd] focus:outline-none appearance-none cursor-pointer"
              >
                <option value="Digitado">Digitado (En Proceso)</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Recibido">Recibido</option>
                <option value="Anulado">Anulado (Libera Orden de Venta)</option>
              </select>
              <span className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none">
                ▼
              </span>
            </div>
            {orderStatus === 'Anulado' && (
              <span className="text-[11px] text-red-600 font-semibold">
                ⚠️ Al seleccionar Anulado, el campo ordenVenta se guardará como NULL para liberar el código.
              </span>
            )}
          </div>
        </section>

        {/* Action Drawer */}
        <section className="bg-white rounded-2xl p-4 shadow-md border border-[#e2e8ff] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#444651] font-semibold">
              <span className="text-base text-[#00236f]">☁️</span>
              <span>Transacción Supabase Live</span>
            </div>
            <span className="bg-[#eaedff] text-[#00236f] text-[11px] font-mono px-2 py-0.5 rounded-full font-bold">
              {activeSala?.codCliente || 'Sin Sala'} • Live
            </span>
          </div>

          {/* Conteo a grabar en encabezadoPedido */}
          <div className="bg-[#f2f3ff] rounded-xl p-2.5 border border-[#dae2fd] flex items-center justify-between text-xs">
            <span className="text-[#444651] font-medium">
              Conteo a guardar (<code className="font-mono font-bold text-[#00236f]">cantidadProductos</code>):
            </span>
            <span className="font-mono font-bold text-sm text-[#00236f] bg-white px-2.5 py-0.5 rounded-lg border border-[#dae2fd]">
              {getCartDistinctCount()} {getCartDistinctCount() === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={isSubmitting || isSundayBlocked || !isOVValid || cart.length === 0}
            onClick={handleSubmitPedido}
            className={`w-full h-14 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all ${
              isSubmitting || isSundayBlocked || !isOVValid || cart.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#fd651e] hover:bg-[#a73a00] active:scale-[0.98] text-white cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin text-xl">🔄</span>
                <span>Sincronizando con Supabase...</span>
              </>
            ) : (
              <>
                <span className="text-xl">☁️</span>
                <span>Grabar Pedido en Supabase</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-[#757682] text-center">
            <span>🔒</span>
            <span>Impacta tablas: encabezadoPedido & detallePedido</span>
          </div>
        </section>
      </div>
    </div>
  );
};
