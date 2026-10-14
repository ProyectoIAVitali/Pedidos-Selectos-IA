import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  DatabaseService,
  SUPABASE_SQL_SCHEMA,
} from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { checkSupabaseStatus, isSupabaseConfigured, showToast, triggerRefresh } = useApp();
  const creds = getSupabaseCredentials();

  const [url, setUrl] = useState(creds.url);
  const [key, setKey] = useState(creds.key);
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'credentials'>('status');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean;
    counts: Record<string, number>;
    resolvedTables: Record<string, string>;
    foundUserEmail?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await DatabaseService.testConnection();
      setConnectionResult(res);
      if (res.connected) {
        checkSupabaseStatus();
      }
    } catch (err: any) {
      setConnectionResult({ connected: false, counts: {}, resolvedTables: {}, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, key);
    checkSupabaseStatus();
    showToast(
      'Configuración Guardada',
      url ? 'Credenciales de Supabase actualizadas. Probando conexión...' : 'Credenciales vacías.',
      'info'
    );
    handleTestConnection();
    triggerRefresh();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    showToast('SQL Copiado', 'Esquema copiado al portapapeles para Supabase SQL Editor', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  const tableList = [
    { name: 'usuariosMoviles', label: 'usuariosMoviles', pk: 'correo' },
    { name: 'usuarioClientes', label: 'usuarioClientes', pk: 'idUsuarioCliente (N:M)' },
    { name: 'Clientes', label: 'Clientes', pk: 'codCliente' },
    { name: 'Supervisor', label: 'Supervisor', pk: 'idSupervisor' },
    { name: 'Ruta', label: 'Ruta', pk: 'codRuta' },
    { name: 'Productos', label: 'Productos', pk: 'codProducto' },
    { name: 'encabezadoPedido', label: 'encabezadoPedido', pk: 'idPedido' },
    { name: 'detallePedido', label: 'detallePedido', pk: '(idPedido, codProducto)' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-[#faf8ff] w-full max-w-xl rounded-2xl shadow-2xl border border-[#dae2fd] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1e3a8a] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.4 11.6l-8.4-8.4c-.8-.8-2-.8-2.8 0l-8.4 8.4c-.8.8-.8 2 0 2.8l8.4 8.4c.8.8 2 .8 2.8 0l8.4-8.4c.8-.8.8-2 0-2.8zm-9.8 7l-7-7 7-7 7 7-7 7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base">
                Conexión Directa a Supabase / PostgreSQL
              </h3>
              <p className="text-xs text-white/80">
                CRUD 100% en tiempo real sin datos simulados en memoria
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#dae2fd] bg-[#eaedff] px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-3 rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[#faf8ff] text-[#00236f] border-t-2 border-[#fd651e]'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Diagnóstico de Tablas ({tableList.length})
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-2 px-3 rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-[#faf8ff] text-[#00236f] border-t-2 border-[#fd651e]'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Credenciales de Conexión
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-2 px-3 rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-[#faf8ff] text-[#00236f] border-t-2 border-[#fd651e]'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Script SQL DDL
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 text-sm space-y-4">
          {activeTab === 'status' && (
            <div className="space-y-3">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  connectionResult?.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      connectionResult?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <span className="font-bold block text-xs">
                      {connectionResult?.connected
                        ? 'Conectado con éxito a Supabase'
                        : connectionResult?.error
                        ? `Error: ${connectionResult.error}`
                        : 'Configura URL y Anon Key'}
                    </span>
                    <span className="text-[11px] text-[#444651]">
                      {connectionResult?.foundUserEmail
                        ? `Usuarios detectados en DB: ${connectionResult.foundUserEmail}`
                        : 'Resolución automática de tablas (minúsculas / CamelCase).'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  {testing ? 'Verificando...' : '🔄 Probar'}
                </button>
              </div>

              {/* Table of Counts and resolved names */}
              <div className="border border-[#dae2fd] rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f2f3ff] text-[#00236f] font-bold border-b border-[#dae2fd]">
                    <tr>
                      <th className="py-2 px-3">Entidad</th>
                      <th className="py-2 px-3">Tabla en Supabase</th>
                      <th className="py-2 px-3 text-right">Filas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f3ff]">
                    {tableList.map((t) => {
                      const count = connectionResult?.counts[t.name];
                      const resolved = connectionResult?.resolvedTables[t.name] || t.name;
                      return (
                        <tr key={t.name} className="hover:bg-[#faf8ff]">
                          <td className="py-2 px-3 font-semibold text-[#131b2e]">
                            {t.label}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#00236f] font-semibold">
                            public.{resolved}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#131b2e]">
                            {count !== undefined ? count : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'credentials' && (
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-xs text-[#444651]">
                Introduce la <strong>URL</strong> de tu proyecto Supabase y la <strong>anon key</strong>:
              </p>

              <div>
                <label className="block text-xs font-bold text-[#131b2e] mb-1">
                  SUPABASE URL (ej. https://xyz.supabase.co)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://your-project.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c5c5d3] bg-white text-xs font-mono focus:border-[#00236f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#131b2e] mb-1">
                  SUPABASE ANON KEY (pública)
                </label>
                <input
                  type="text"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c5c5d3] bg-white text-xs font-mono focus:border-[#00236f] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#eaedff] text-xs font-bold text-[#131b2e] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#00236f] text-white text-xs font-bold shadow-md hover:bg-[#1e3a8a] cursor-pointer"
                >
                  Guardar y Conectar
                </button>
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              {/* Highlight Bitácora y Auditoría */}
              <div className="p-3 bg-[#e8edff] rounded-xl border border-[#dae2fd] text-xs space-y-2">
                <span className="font-bold text-[#00236f] flex items-center gap-1.5">
                  <span>📝</span>
                  <span>Campos de Bitácora para encabezadoPedido y detallePedido:</span>
                </span>
                <p className="text-[11px] text-[#444651]">
                  Ejecuta este script en el <strong>SQL Editor</strong> de Supabase para agregar los campos de auditoría (usuario creador/modificador y fecha/hora):
                </p>
                <code className="block bg-white p-2 rounded-lg font-mono text-[10px] text-[#00236f] border border-[#dae2fd] select-all whitespace-pre leading-relaxed overflow-x-auto">
{`ALTER TABLE IF EXISTS public."encabezadoPedido" 
  ADD COLUMN IF NOT EXISTS "usuarioCreo" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaCreo" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "usuarioModifico" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaModifico" TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public."detallePedido" 
  ADD COLUMN IF NOT EXISTS "usuarioCreo" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaCreo" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "usuarioModifico" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaModifico" TIMESTAMPTZ DEFAULT NOW();`}
                </code>
              </div>

              {/* Highlight codCliente column */}
              <div className="p-3 bg-[#f2f3ff] rounded-xl border border-[#dae2fd] text-xs">
                <span className="font-bold text-[#00236f] block mb-1">
                  ⭐ Para agregar el campo codCliente a tu tabla usuariosMoviles:
                </span>
                <code className="block bg-white p-2 rounded-lg font-mono text-[11px] text-[#00236f] border border-[#dae2fd] select-all">
                  ALTER TABLE IF EXISTS public.usuariosmoviles ADD COLUMN IF NOT EXISTS "codCliente" TEXT;
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#444651]">
                  Script completo DDL para el <strong>SQL Editor</strong> de Supabase:
                </span>
                <button
                  onClick={handleCopySql}
                  className="bg-[#fd651e] text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-[#a73a00] flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copied ? '✓ Copiado' : '📋 Copiar SQL'}
                </button>
              </div>

              <div className="bg-[#131b2e] text-[#dae2fd] p-3 rounded-xl font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto">
                <pre>{SUPABASE_SQL_SCHEMA}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
