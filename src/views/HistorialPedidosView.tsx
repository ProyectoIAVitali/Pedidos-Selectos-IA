import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DatabaseService } from '../lib/supabase';
import { EncabezadoPedido, DetallePedido, Cliente, Producto } from '../types/database';

export const HistorialPedidosView: React.FC = () => {
  const { dataVersion, triggerRefresh, showToast, currentUser } = useApp();

  const [pedidos, setPedidos] = useState<EncabezadoPedido[]>([]);
  const [detalles, setDetalles] = useState<DetallePedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [expandedBreakdown, setExpandedBreakdown] = useState<number | null>(null);

  // Modal para anulación de pedido
  const [modalOrder, setModalOrder] = useState<EncabezadoPedido | null>(null);
  const [isAnulando, setIsAnulando] = useState(false);

  // Modal para detalle de pedido
  const [viewDetailOrder, setViewDetailOrder] = useState<EncabezadoPedido | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pedList, detList, cliList, prodList] = await Promise.all([
        DatabaseService.getPedidos(),
        DatabaseService.getDetalles(),
        DatabaseService.getClientes(),
        DatabaseService.getProductos(),
      ]);
      setPedidos(pedList);
      setDetalles(detList);
      setClientes(cliList);
      setProductos(prodList);
    } catch (err: any) {
      showToast('Error Supabase', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataVersion]);

  const filteredPedidos = pedidos.filter((p) => {
    // Filtro por estado
    if (statusFilter !== 'Todos' && p.orderStatus !== statusFilter) {
      return false;
    }
    // Filtro por texto
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const cliente = clientes.find((c) => c.codCliente === p.codCliente);
    const clientName = cliente ? cliente.nombreCliente.toLowerCase() : '';
    const ov = p.ordenVenta ? p.ordenVenta.toLowerCase() : '';
    const folio = p.idPedido.toString();

    return (
      folio.includes(term) ||
      p.codCliente.toLowerCase().includes(term) ||
      clientName.includes(term) ||
      ov.includes(term) ||
      p.usuarioDigito.toLowerCase().includes(term)
    );
  });

  const countByStatus = (st: string) => {
    if (st === 'Todos') return pedidos.length;
    return pedidos.filter((p) => p.orderStatus === st).length;
  };

  const handleOpenAnularModal = (order: EncabezadoPedido) => {
    setModalOrder(order);
  };

  const handleConfirmAnulacion = async () => {
    if (!modalOrder) return;
    setIsAnulando(true);
    try {
      const result = await DatabaseService.anularPedido(modalOrder.idPedido, currentUser?.correo);
      if (result.success) {
        showToast(
          `Pedido #${modalOrder.idPedido} Anulado en Supabase`,
          result.freedOV
            ? `Campo ordenVenta (${result.freedOV}) liberado a NULL para ser reutilizado.`
            : 'Pedido marcado como Anulado.',
          'success'
        );
        triggerRefresh();
        fetchData();
        setModalOrder(null);
      }
    } catch (e: any) {
      showToast('Error al Anular', e.message, 'error');
    } finally {
      setIsAnulando(false);
    }
  };

  const getClientName = (codCliente: string) => {
    const c = clientes.find((item) => item.codCliente === codCliente);
    return c ? `${c.codCliente} - ${c.nombreCliente}` : codCliente;
  };

  const getProductInfo = (codProducto: string) => {
    return productos.find((p) => p.codProducto === codProducto);
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] pb-32 pt-2">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-3.5">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl text-[#00236f]">📦</span>
            <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#131b2e]">
              Historial de Pedidos
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchData}
              title="Recargar desde Supabase"
              className="p-1.5 bg-white hover:bg-[#eaedff] border border-[#e2e8ff] rounded-xl text-xs font-bold text-[#00236f] shadow-sm transition-colors cursor-pointer"
            >
              🔄
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2e7ff] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#fd651e] animate-pulse" />
              <span className="text-[11px] font-bold text-[#444651]">
                Supabase Live
              </span>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, cliente u OV..."
            className="w-full h-11 pl-9 pr-8 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder-[#757682] border border-[#dae2fd] focus:bg-white focus:outline-none focus:border-[#00236f] transition-all shadow-sm"
          />
          <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Chips de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
          {['Todos', 'Digitado', 'Nuevo', 'Recibido', 'Anulado'].map((st) => {
            const count = countByStatus(st);
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-['Inter'] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#00236f] text-white shadow-sm'
                    : 'bg-[#eaedff] text-[#444651] hover:bg-[#dae2fd]'
                }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>

        {/* Regla de Negocio Banner */}
        <div className="rounded-2xl bg-[#f2f3ff] p-3 shadow-sm border border-[#dae2fd] flex items-start gap-2.5 text-xs">
          <span className="text-base text-[#fd651e] mt-0.5">⚙️</span>
          <div className="flex flex-col">
            <span className="font-bold text-[#131b2e]">
              Regla de Gestión de OV (10 a 15 dígitos)
            </span>
            <span className="text-[#444651] leading-relaxed mt-0.5">
              Al anular un pedido en <code className="font-bold text-[#00236f]">encabezadoPedido</code>, Supabase ejecuta la limpieza a <code className="font-bold text-[#fd651e]">ordenVenta = NULL</code> para reciclar el cupo fiscal de ruta.
            </span>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#00236f] font-semibold border border-[#e2e8ff] flex items-center justify-center gap-2">
            <span className="animate-spin text-base">🔄</span>
            <span>Consultando pedidos en Supabase...</span>
          </div>
        )}

        {/* Lista de Pedidos */}
        {!loading && (
          <div className="flex flex-col gap-3">
            {filteredPedidos.map((pedido) => {
              const isAnulado = pedido.orderStatus === 'Anulado';
              const orderLines = detalles.filter((d) => d.idPedido === pedido.idPedido);
              const isExpanded = expandedBreakdown === pedido.idPedido;

              return (
                <article
                  key={pedido.idPedido}
                  className={`rounded-2xl bg-white p-3.5 shadow-sm border transition-all relative overflow-hidden flex flex-col gap-2.5 ${
                    isAnulado
                      ? 'border-red-200 bg-red-50/20'
                      : 'border-[#e2e8ff] hover:shadow-md'
                  }`}
                >
                  {/* Border Indicator */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isAnulado
                        ? 'bg-red-500'
                        : pedido.orderStatus === 'Recibido'
                        ? 'bg-emerald-600'
                        : pedido.orderStatus === 'Nuevo'
                        ? 'bg-blue-500'
                        : 'bg-[#1e3a8a]'
                    }`}
                  />

                  <div className="flex items-start justify-between gap-2 pl-1.5">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-['Plus_Jakarta_Sans'] font-bold text-base ${
                            isAnulado ? 'line-through text-gray-500' : 'text-[#00236f]'
                          }`}
                        >
                          Pedido #{pedido.idPedido}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isAnulado
                              ? 'bg-red-100 text-red-700'
                              : pedido.orderStatus === 'Recibido'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pedido.orderStatus === 'Nuevo'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-[#dce1ff] text-[#00164e]'
                          }`}
                        >
                          {pedido.orderStatus}
                        </span>
                      </div>
                      <span className="text-xs text-[#444651] mt-0.5">
                        Entrega: <strong className="text-[#131b2e]">{pedido.fechaEntrega}</strong>
                      </span>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-[#eaedff] flex items-center justify-center text-lg shrink-0">
                      {isAnulado ? '🚫' : '📦'}
                    </div>
                  </div>

                  {/* Si está anulado, advertencia de OV liberada */}
                  {isAnulado && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 pl-2.5 ml-1.5">
                      <span className="text-sm">⚠️</span>
                      <p className="leading-tight">
                        <strong>Pedido Anulado:</strong> Campo <code className="font-mono font-bold">ordenVenta</code> liberado a <code className="font-mono bg-red-200 px-1 rounded font-bold">NULL</code> en Supabase. El número de orden anterior quedó disponible para reutilizarse.
                      </p>
                    </div>
                  )}

                  {/* Cliente & Correo */}
                  <div className="flex flex-col gap-1 pl-1.5 bg-[#f2f3ff] rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-gray-500">🏪</span>
                      <span className="text-xs font-bold text-[#131b2e] truncate">
                        {getClientName(pedido.codCliente)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#444651] pt-0.5">
                      <span className="truncate font-mono text-[11px]">
                        {pedido.usuarioDigito}
                      </span>
                      <span className="text-[10px] bg-[#dae2fd] text-[#00236f] font-bold px-2 py-0.5 rounded">
                        Registrado en DB
                      </span>
                    </div>
                  </div>

                  {/* Métricas de Orden de Venta y Volumen */}
                  <div className="grid grid-cols-2 gap-2 pl-1.5 text-xs">
                    <div className="bg-[#f2f3ff] p-2 rounded-xl flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#757682]">
                        Orden de Venta
                      </span>
                      <span
                        className={`font-mono font-bold mt-0.5 ${
                          pedido.ordenVenta
                            ? 'text-[#00236f]'
                            : 'italic text-red-600'
                        }`}
                      >
                        {pedido.ordenVenta ? `# ${pedido.ordenVenta}` : 'NULL / Liberada'}
                      </span>
                    </div>

                    <div className="bg-[#f2f3ff] p-2 rounded-xl flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#757682]">
                        Volumen Total
                      </span>
                      <span className="font-bold text-[#131b2e] mt-0.5">
                        {pedido.cantidadProductos} productos
                      </span>
                    </div>
                  </div>

                  {/* Acordeón de desglose de líneas */}
                  <div className="pl-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBreakdown(
                          isExpanded ? null : pedido.idPedido
                        )
                      }
                      className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-[#faf8ff] hover:bg-[#eaedff] text-left text-xs text-[#444651] font-semibold transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>🛍️</span>
                        <span>
                          Ver desglose ({orderLines.length} SKU{orderLines.length !== 1 ? 's' : ''})
                        </span>
                      </span>
                      <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-[#eaedff] flex flex-col gap-1.5 text-xs text-[#131b2e]">
                        {orderLines.map((line) => {
                          const prod = getProductInfo(line.codProducto);
                          return (
                            <div
                              key={line.codProducto}
                              className="flex justify-between items-center py-0.5 border-b border-[#dae2fd] last:border-none"
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="font-bold truncate">
                                  {prod ? prod.nombreProducto : line.codProducto}
                                </span>
                                <span className="text-[10px] text-[#757682] font-mono">
                                  {line.codProducto}
                                </span>
                              </div>
                              <span className="font-mono font-bold shrink-0 text-[#00236f]">
                                {line.cantidad} unids
                              </span>
                            </div>
                          );
                        })}
                        {orderLines.length === 0 && (
                          <span className="text-gray-500 italic text-[11px]">
                            Sin líneas registradas en detallePedido.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-2 pt-1 pl-1.5">
                    <button
                      type="button"
                      onClick={() => setViewDetailOrder(pedido)}
                      className="flex-1 h-10 px-3 rounded-xl bg-[#eaedff] hover:bg-[#dae2fd] text-[#00236f] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <span>👁️</span>
                      <span>Ver Detalle</span>
                    </button>

                    {!isAnulado && (
                      <button
                        type="button"
                        onClick={() => handleOpenAnularModal(pedido)}
                        className="flex-1 h-10 px-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                      >
                        <span>✕</span>
                        <span>Anular Pedido</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {filteredPedidos.length === 0 && (
              <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#757682] border border-[#e2e8ff] space-y-2">
                <p>No hay pedidos registrados en la tabla encabezadoPedido de Supabase.</p>
              </div>
            )}
          </div>
        )}

        {/* Modal de Anulación Crítica */}
        {modalOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-1">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                      Acción Crítica en Supabase
                    </span>
                    <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#131b2e]">
                      Anular Pedido #{modalOrder.idPedido}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setModalOrder(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl bg-[#f2f3ff] p-3 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#757682]">Cliente Destino:</span>
                  <span className="font-bold text-[#131b2e] text-right">
                    {getClientName(modalOrder.codCliente)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#757682]">OV Actual (10-15 dígitos):</span>
                  <span className="font-mono font-bold text-[#00236f]">
                    {modalOrder.ordenVenta || 'NULL'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#757682]">Ítems a desasignar:</span>
                  <span className="font-bold text-[#fd651e]">
                    {modalOrder.cantidadProductos} productos
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#eaedff] flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#00236f] font-bold">
                  <span>☁️</span>
                  <span>Mutación en Supabase DB</span>
                </div>
                <p className="text-[#444651] leading-relaxed">
                  Al cambiar el estado a <strong className="text-red-700">"Anulado"</strong>, el campo <code className="font-mono font-bold text-[#00236f]">ordenVenta ({modalOrder.ordenVenta})</code> se limpiará directamente a <code className="font-mono bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">NULL</code> en la tabla <code className="font-mono font-bold text-[#131b2e]">encabezadoPedido</code> para liberar el número y habilitar su reutilización.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={isAnulando}
                  onClick={handleConfirmAnulacion}
                  className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:bg-gray-400"
                >
                  {isAnulando ? (
                    <>
                      <span className="animate-spin text-base">🔄</span>
                      <span>Actualizando encabezadoPedido en Supabase...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>Confirmar Anulación y Liberar Orden</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalOrder(null)}
                  className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center"
                >
                  Cancelar y Regresar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalle */}
        {viewDetailOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <span className="text-[11px] font-bold text-[#757682] uppercase">
                    Comprobante de Despacho
                  </span>
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#00236f]">
                    Pedido #{viewDetailOrder.idPedido}
                  </h3>
                </div>
                <button
                  onClick={() => setViewDetailOrder(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-1.5 bg-[#f2f3ff] p-3 rounded-2xl">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-bold text-[#131b2e]">{getClientName(viewDetailOrder.codCliente)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha de Entrega:</span>
                  <span className="font-bold text-[#131b2e]">{viewDetailOrder.fechaEntrega}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Usuario Registrador:</span>
                  <span className="font-mono text-[#00236f]">{viewDetailOrder.usuarioDigito}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Orden de Venta:</span>
                  <span className="font-mono font-bold text-[#00236f]">
                    {viewDetailOrder.ordenVenta || 'NULL (Liberada / Sin OV)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado:</span>
                  <span className="font-bold">{viewDetailOrder.orderStatus}</span>
                </div>
              </div>

              {/* Bitácora y Auditoría (encabezadoPedido) */}
              <div className="text-[11px] bg-[#f8f9ff] border border-[#dae2fd] p-3 rounded-2xl flex flex-col gap-1.5">
                <span className="font-bold text-[#00236f] flex items-center gap-1">
                  <span>📝</span>
                  <span>Bitácora de Auditoría (encabezadoPedido)</span>
                </span>
                <div className="grid grid-cols-1 gap-1 text-[#444651]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adicionado por (usuarioCreo):</span>
                    <span className="font-mono font-semibold text-[#00236f]">{viewDetailOrder.usuarioCreo || viewDetailOrder.usuarioDigito || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha creación (fechaCreo):</span>
                    <span className="font-mono text-[#131b2e]">{viewDetailOrder.fechaCreo || viewDetailOrder.creadoEn || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#eaedff]">
                    <span className="text-gray-500">Última modificación (usuarioModifico):</span>
                    <span className="font-mono font-semibold text-[#a73a00]">{viewDetailOrder.usuarioModifico || 'Sin modificaciones'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha modif. (fechaModifico):</span>
                    <span className="font-mono text-[#131b2e]">{viewDetailOrder.fechaModifico || 'Sin modificaciones'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-[#131b2e]">Líneas de Detalle (detallePedido):</h4>
                <div className="divide-y divide-gray-100 border rounded-2xl overflow-hidden bg-white text-xs">
                  {detalles
                    .filter((d) => d.idPedido === viewDetailOrder.idPedido)
                    .map((d) => {
                      const prod = getProductInfo(d.codProducto);
                      return (
                        <div key={d.codProducto} className="p-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-bold block text-[#131b2e]">
                              {prod?.nombreProducto || d.codProducto}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {d.codProducto} • L. {prod?.precioKg?.toFixed(2) || '0.00'}/kg
                            </span>
                          </div>
                          <span className="font-mono font-bold text-[#00236f] text-sm">
                            {d.cantidad} unids
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <button
                onClick={() => setViewDetailOrder(null)}
                className="w-full h-11 rounded-xl bg-[#00236f] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
