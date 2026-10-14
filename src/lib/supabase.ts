import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Ruta,
  Supervisor,
  Cliente,
  Producto,
  UsuarioMovil,
  UsuarioCliente,
  EncabezadoPedido,
  DetallePedido,
  UserRole,
  PlantelEnum,
  ClasificacionProducto,
  OrderStatus,
} from '../types/database';

// Limpieza y sanitización de URL y Key de Supabase para evitar errores de path / comillas
export function sanitizeSupabaseUrl(raw: string): string {
  let u = (raw || '').trim();
  // Quitar comillas si el usuario copió '"https://..."'
  u = u.replace(/^["']+|["']+$/g, '').trim();
  // Quitar barras finales
  u = u.replace(/\/+$/, '');
  // Quitar /rest/v1 o /rest si fue copiado accidentalmente
  u = u.replace(/\/rest\/v1\/?$/i, '').replace(/\/rest\/?$/i, '');
  return u;
}

export function sanitizeSupabaseKey(raw: string): string {
  let k = (raw || '').trim();
  return k.replace(/^["']+|["']+$/g, '').trim();
}

const DEFAULT_SUPABASE_URL = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
const DEFAULT_SUPABASE_ANON_KEY = sanitizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

const CONFIG_STORAGE_KEYS = {
  URL: 'rp_supabase_url',
  KEY: 'rp_supabase_key',
};

// Obtener credenciales desde localStorage o variables de entorno
export function getSupabaseCredentials(): { url: string; key: string } {
  const rawUrl = localStorage.getItem(CONFIG_STORAGE_KEYS.URL) || DEFAULT_SUPABASE_URL;
  const rawKey = localStorage.getItem(CONFIG_STORAGE_KEYS.KEY) || DEFAULT_SUPABASE_ANON_KEY;
  return {
    url: sanitizeSupabaseUrl(rawUrl),
    key: sanitizeSupabaseKey(rawKey),
  };
}

export function saveSupabaseCredentials(url: string, key: string): void {
  const cleanUrl = sanitizeSupabaseUrl(url);
  const cleanKey = sanitizeSupabaseKey(key);
  localStorage.setItem(CONFIG_STORAGE_KEYS.URL, cleanUrl);
  localStorage.setItem(CONFIG_STORAGE_KEYS.KEY, cleanKey);
  _supabaseClient = null;
  // Limpiar cache de resolución de tablas
  Object.keys(resolvedTableCache).forEach((k) => delete resolvedTableCache[k]);
}

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;
  if (!_supabaseClient) {
    try {
      _supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      });
    } catch (e) {
      console.error('Error al inicializar cliente Supabase:', e);
      _supabaseClient = null;
    }
  }
  return _supabaseClient;
}

function requireClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      'No se han configurado las credenciales de Supabase. Ingresa tu Supabase URL y Anon Key.'
    );
  }
  return client;
}

// ========================================================
// RESOLUTOR RESILIENTE DINÁMICO DE NOMBRES DE TABLAS
// En PostgreSQL / Supabase:
// - Si se crea la tabla sin comillas, PostgreSQL la convierte a MINÚSCULAS (ej. usuariosmoviles).
// - Si se crea con comillas ("usuariosMoviles"), PostgreSQL respeta el CamelCase.
// - En Javascript / SDK, NUNCA se deben incluir comillas dentro del string (ej. NUNCA '"usuariosmoviles"').
// Por ende probamos minúsculas primero (estándar Supabase) y luego las demás variantes.
// ========================================================
const TABLE_CANDIDATES = {
  usuariosMoviles: [
    'usuariosmoviles',
    'usuariosMoviles',
    'usuarios_moviles',
    'UsuariosMoviles',
    'usuarios',
    'usuarios_movil',
  ],
  usuarioClientes: [
    'usuarioclientes',
    'usuarioClientes',
    'usuario_clientes',
    'usuariocliente',
    'usuario_cliente',
  ],
  Clientes: [
    'clientes',
    'Clientes',
    'cliente',
    'Cliente',
  ],
  Supervisor: [
    'supervisor',
    'Supervisor',
    'supervisores',
    'Supervisores',
  ],
  Ruta: [
    'ruta',
    'Ruta',
    'rutas',
    'Rutas',
  ],
  Productos: [
    'productos',
    'Productos',
    'producto',
    'Producto',
  ],
  encabezadoPedido: [
    'encabezadopedido',
    'encabezadoPedido',
    'encabezado_pedido',
    'pedidos',
    'pedido',
  ],
  detallePedido: [
    'detallepedido',
    'detallePedido',
    'detalle_pedido',
    'detalles_pedido',
    'detalles',
  ],
};

const resolvedTableCache: Record<string, string> = {};

// Ejecutor ultra-resiliente con fallback automático
async function executeWithFallback<T = any>(
  client: SupabaseClient,
  entityKey: keyof typeof TABLE_CANDIDATES,
  operation: (tableName: string) => PromiseLike<{ data: T | null; error: any }> | Promise<{ data: T | null; error: any }> | any
): Promise<{ data: T | null; error: any; usedTable: string }> {
  const cached = resolvedTableCache[entityKey];
  const list = TABLE_CANDIDATES[entityKey] || [entityKey as string];
  const candidates = cached
    ? [cached, ...list.filter((c) => c !== cached)]
    : list;

  let lastError: any = null;

  for (const tableName of candidates) {
    try {
      // Limpiar cualquier comilla accidental
      const cleanTableName = tableName.replace(/["']/g, '');
      const result = await operation(cleanTableName);

      if (!result.error) {
        resolvedTableCache[entityKey] = cleanTableName;
        return { data: result.data, error: null, usedTable: cleanTableName };
      }

      const err = result.error;
      const errMsg = (err.message || '').toLowerCase();
      const errDetails = (err.details || '').toLowerCase();
      const errHint = (err.hint || '').toLowerCase();
      const allText = `${errMsg} ${errDetails} ${errHint}`;

      // Si es un error de COLUMNA no encontrada (PGRST204 o 42703 o mención de column):
      // Significa que la TABLA SÍ EXISTE pero las columnas tienen otro casing.
      // ¡NO debemos saltar a otra tabla (como Supervisores)!
      const isColumnError =
        err.code === 'PGRST204' ||
        err.code === '42703' ||
        (allText.includes('column') && !allText.includes('could not find the table') && !allText.includes('relation'));

      if (isColumnError) {
        resolvedTableCache[entityKey] = cleanTableName;
        return { data: null, error: err, usedTable: cleanTableName };
      }

      // Detectar errores de tabla no encontrada o ruta / path de URL rechazada
      const isNotFoundOrPathError =
        err.code === 'PGRST200' ||
        err.code === 'PGRST205' ||
        err.code === '42P01' || // undefined_table en PostgreSQL
        (err.status === 404 && !allText.includes('column')) ||
        allText.includes('could not find the table') ||
        (allText.includes('table') && allText.includes('does not exist')) ||
        (allText.includes('relation') && allText.includes('does not exist'));

      if (isNotFoundOrPathError) {
        lastError = err;
        if (cached === cleanTableName) {
          delete resolvedTableCache[entityKey];
        }
        continue;
      }

      // Si el error es de otra índole (ej: restricción de clave foránea, check constraint),
      // la tabla sí existe
      resolvedTableCache[entityKey] = cleanTableName;
      return { data: null, error: err, usedTable: cleanTableName };
    } catch (e: any) {
      lastError = e;
      if (cached === tableName) {
        delete resolvedTableCache[entityKey];
      }
    }
  }

  return { data: null, error: lastError, usedTable: candidates[0] };
}

// Analizador y separador tolerante de múltiples códigos de cliente (codCliente)
export function parseClientCodes(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Formato JSON string: '["CLI-001", "CLI-002"]'
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => String(c).trim()).filter(Boolean);
        }
      } catch {
        // continuar a split
      }
    }
    // Formato Array de PostgreSQL: '{CLI-001,CLI-002}'
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.replace(/["']/g, '').trim())
        .filter(Boolean);
    }
    // Separados por comas, puntos y comas o saltos de línea
    return trimmed
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(raw).trim()].filter(Boolean);
}

// Normalizadores tolerantes a variaciones de casing y columnas
export function normalizeUsuario(row: any): UsuarioMovil {
  if (!row) return {} as UsuarioMovil;
  const rawRole = (row.typeUser || row.typeuser || row.type_user || row.rol || row.TypeUser || 'DISPLAY')
    .toString()
    .toUpperCase();

  // El campo codCliente puede venir como string ('CLI-001'), lista 'CLI-001, CLI-014', o array
  const rawCod =
    row.codCliente ??
    row.codcliente ??
    row.cod_cliente ??
    row.cliente ??
    row.clientes ??
    row.sala ??
    row.salas ??
    row.CodCliente;

  const parsedCodes = parseClientCodes(rawCod);

  return {
    correo: (row.correo || row.email || row.Correo || '').toString().trim().toLowerCase(),
    firstName: (row.firstName || row.firstname || row.first_name || row.nombre || row.FirstName || 'Usuario').toString(),
    lastName: (row.lastName || row.lastname || row.last_name || row.apellido || row.apellidos || row.LastName || '').toString(),
    typeUser: (rawRole === 'ADMIN' ? 'ADMIN' : 'DISPLAY') as UserRole,
    codCliente: parsedCodes.length > 0 ? parsedCodes.join(', ') : undefined,
  };
}

export function normalizeCliente(row: any): Cliente {
  if (!row) return {} as Cliente;
  return {
    codCliente: (row.codCliente || row.codcliente || row.cod_cliente || row.id || '').toString(),
    nombreCliente: (row.nombreCliente || row.nombrecliente || row.nombre_cliente || row.nombre || '').toString(),
    idSupervisor: (row.idSupervisor || row.idsupervisor || row.id_supervisor || row.supervisor_id || '').toString(),
  };
}

export function normalizeSupervisor(row: any): Supervisor {
  if (!row) return {} as Supervisor;
  return {
    idSupervisor: (row.idSupervisor || row.idsupervisor || row.id_supervisor || row.id || '').toString(),
    nombreSupervisor: (row.nombreSupervisor || row.nombresupervisor || row.nombre_supervisor || row.nombre || '').toString(),
  };
}

export function normalizeRuta(row: any): Ruta {
  if (!row) return {} as Ruta;
  return {
    codRuta: (row.codRuta || row.codruta || row.cod_ruta || row.id || '').toString(),
    nombreRuta: (row.nombreRuta || row.nombreruta || row.nombre_ruta || row.nombre || '').toString(),
    Plantel: ((row.Plantel || row.plantel || 'AT').toString().toUpperCase()) as PlantelEnum,
  };
}

export function normalizeProducto(row: any): Producto {
  if (!row) return {} as Producto;
  return {
    codProducto: (row.codProducto || row.codproducto || row.cod_producto || row.id || '').toString(),
    nombreProducto: (row.nombreProducto || row.nombreproducto || row.nombre_producto || row.nombre || '').toString(),
    Clasificacion: (row.Clasificacion || row.clasificacion || row.categoria || 'POLLO FRESCO').toString() as ClasificacionProducto,
    precioKg: Number(row.precioKg || row.preciokg || row.precio_kg || row.precio || 0),
    unidad: (row.unidad || 'kg').toString(),
  };
}

export function normalizePedido(row: any): EncabezadoPedido {
  if (!row) return {} as EncabezadoPedido;
  return {
    idPedido: Number(row.idPedido || row.idpedido || row.id_pedido || row.id || 0),
    fechaEntrega: (row.fechaEntrega || row.fechaentrega || row.fecha_entrega || '').toString(),
    usuarioDigito: (row.usuarioDigito || row.usuariodigito || row.usuario_digito || '').toString(),
    codCliente: (row.codCliente || row.codcliente || row.cod_cliente || '').toString(),
    ordenVenta: row.ordenVenta || row.ordenventa || row.orden_venta || null,
    orderStatus: (row.orderStatus || row.orderstatus || row.order_status || 'Digitado').toString() as OrderStatus,
    cantidadProductos: Number(row.cantidadProductos || row.cantidadproductos || row.cantidad_productos || 0),
    creadoEn: (row.creadoEn || row.creadoen || row.created_at || row.fechaCreo || row.fechacreo || '').toString(),
    usuarioCreo: (row.usuarioCreo || row.usuariocreo || row.usuario_creo || row.usuarioDigito || row.usuariodigito || '').toString(),
    fechaCreo: (row.fechaCreo || row.fechacreo || row.fecha_creo || row.creadoEn || row.creadoen || row.created_at || '').toString(),
    usuarioModifico: (row.usuarioModifico || row.usuariomodifico || row.usuario_modifico || null)?.toString() || null,
    fechaModifico: (row.fechaModifico || row.fechamodifico || row.fecha_modifico || row.updated_at || null)?.toString() || null,
  };
}

export function normalizeDetalle(row: any): DetallePedido {
  if (!row) return {} as DetallePedido;
  return {
    idPedido: Number(row.idPedido || row.idpedido || row.id_pedido || 0),
    codProducto: (row.codProducto || row.codproducto || row.cod_producto || '').toString(),
    cantidad: Number(row.cantidad || 0),
    precioUnitario: Number(row.precioUnitario || row.preciounitario || row.precio_unitario || 0),
    usuarioCreo: (row.usuarioCreo || row.usuariocreo || row.usuario_creo || '').toString(),
    fechaCreo: (row.fechaCreo || row.fechacreo || row.fecha_creo || row.created_at || '').toString(),
    usuarioModifico: (row.usuarioModifico || row.usuariomodifico || row.usuario_modifico || null)?.toString() || null,
    fechaModifico: (row.fechaModifico || row.fechamodifico || row.fecha_modifico || row.updated_at || null)?.toString() || null,
  };
}

// Servicio CRUD que interactúa EXCLUSIVAMENTE con la base de datos de Supabase
export class DatabaseService {
  // ==========================================
  // 1. RUTAS (public.Ruta)
  // ==========================================
  static async getRutas(): Promise<Ruta[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'Ruta', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeRuta);
  }

  static async createRuta(ruta: Ruta): Promise<void> {
    const client = requireClient();
    const cod = ruta.codRuta.trim();
    const nombre = ruta.nombreRuta.trim();
    const plantel = ruta.Plantel;

    const payloads = [
      { codruta: cod, nombreruta: nombre, plantel: plantel },
      { codRuta: cod, nombreRuta: nombre, Plantel: plantel },
      { cod_ruta: cod, nombre_ruta: nombre, plantel: plantel },
    ];

    let lastError: any = null;
    let targetTable = 'ruta';

    for (const payload of payloads) {
      const { error, usedTable } = await executeWithFallback(client, 'Ruta', (table) =>
        client.from(table).insert([payload])
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al insertar en ${targetTable}: ${lastError?.message || 'Error de columnas'}`);
  }

  static async updateRuta(codRuta: string, ruta: Partial<Ruta>): Promise<void> {
    const client = requireClient();
    const cleanCod = codRuta.trim();
    const nombre = ruta.nombreRuta?.trim();
    const plantel = ruta.Plantel;

    const variants = [
      { data: { nombreruta: nombre, plantel: plantel }, idCol: 'codruta' },
      { data: { nombreRuta: nombre, Plantel: plantel }, idCol: 'codRuta' },
      { data: { nombre_ruta: nombre, plantel: plantel }, idCol: 'cod_ruta' },
    ];

    let lastError: any = null;
    let targetTable = 'ruta';

    for (const v of variants) {
      const { error, usedTable } = await executeWithFallback(client, 'Ruta', (table) =>
        client.from(table).update(v.data).eq(v.idCol, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al actualizar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al actualizar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  static async deleteRuta(codRuta: string): Promise<void> {
    const client = requireClient();
    const cleanCod = codRuta.trim();
    const idCols = ['codruta', 'codRuta', 'cod_ruta'];

    let lastError: any = null;
    let targetTable = 'ruta';

    for (const col of idCols) {
      const { error, usedTable } = await executeWithFallback(client, 'Ruta', (table) =>
        client.from(table).delete().eq(col, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al eliminar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al eliminar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  // ==========================================
  // 2. SUPERVISORES (public.Supervisor)
  // ==========================================
  static async getSupervisores(): Promise<Supervisor[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'Supervisor', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeSupervisor);
  }

  static async createSupervisor(sup: Supervisor): Promise<void> {
    const client = requireClient();
    const id = sup.idSupervisor.trim();
    const nombre = sup.nombreSupervisor.trim();

    // Intentar con variantes de nombres de columnas en la tabla de Supabase (sin 'id'):
    const payloads = [
      { idsupervisor: id, nombresupervisor: nombre },
      { idSupervisor: id, nombreSupervisor: nombre },
      { id_supervisor: id, nombre_supervisor: nombre },
    ];

    let lastError: any = null;
    let targetTable = 'supervisor';

    for (const payload of payloads) {
      const { error, usedTable } = await executeWithFallback(client, 'Supervisor', (table) =>
        client.from(table).insert([payload])
      );
      targetTable = usedTable;

      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al insertar en ${targetTable}: ${lastError?.message || 'Error de columnas'}`);
  }

  static async updateSupervisor(idSupervisor: string, sup: Partial<Supervisor>): Promise<void> {
    const client = requireClient();
    const cleanId = idSupervisor.trim();
    const nombre = (sup.nombreSupervisor || '').trim();

    const variants = [
      { data: { nombresupervisor: nombre }, idCol: 'idsupervisor' },
      { data: { nombreSupervisor: nombre }, idCol: 'idSupervisor' },
      { data: { nombre_supervisor: nombre }, idCol: 'id_supervisor' },
    ];

    let lastError: any = null;
    let targetTable = 'supervisor';

    for (const v of variants) {
      const { error, usedTable } = await executeWithFallback(client, 'Supervisor', (table) =>
        client.from(table).update(v.data).eq(v.idCol, cleanId)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al actualizar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al actualizar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  static async deleteSupervisor(idSupervisor: string): Promise<void> {
    const client = requireClient();
    const cleanId = idSupervisor.trim();

    const idCols = ['idsupervisor', 'idSupervisor', 'id_supervisor'];
    let lastError: any = null;
    let targetTable = 'supervisor';

    for (const col of idCols) {
      const { error, usedTable } = await executeWithFallback(client, 'Supervisor', (table) =>
        client.from(table).delete().eq(col, cleanId)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al eliminar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al eliminar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  // ==========================================
  // 3. CLIENTES (public.Clientes)
  // ==========================================
  static async getClientes(): Promise<Cliente[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'Clientes', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeCliente);
  }

  static async createCliente(cliente: Cliente): Promise<void> {
    const client = requireClient();
    const cod = cliente.codCliente.trim();
    const nombre = cliente.nombreCliente.trim();
    const supId = cliente.idSupervisor.trim();

    const payloads = [
      { codcliente: cod, nombrecliente: nombre, idsupervisor: supId },
      { codCliente: cod, nombreCliente: nombre, idSupervisor: supId },
      { cod_cliente: cod, nombre_cliente: nombre, id_supervisor: supId },
    ];

    let lastError: any = null;
    let targetTable = 'clientes';

    for (const payload of payloads) {
      const { error, usedTable } = await executeWithFallback(client, 'Clientes', (table) =>
        client.from(table).insert([payload])
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al insertar en ${targetTable}: ${lastError?.message || 'Error de columnas'}`);
  }

  static async updateCliente(codCliente: string, cliente: Partial<Cliente>): Promise<void> {
    const client = requireClient();
    const cleanCod = codCliente.trim();
    const nombre = (cliente.nombreCliente || '').trim();
    const supId = (cliente.idSupervisor || '').trim();

    const variants = [
      { data: { nombrecliente: nombre, idsupervisor: supId }, idCol: 'codcliente' },
      { data: { nombreCliente: nombre, idSupervisor: supId }, idCol: 'codCliente' },
      { data: { nombre_cliente: nombre, id_supervisor: supId }, idCol: 'cod_cliente' },
    ];

    let lastError: any = null;
    let targetTable = 'clientes';

    for (const v of variants) {
      const { error, usedTable } = await executeWithFallback(client, 'Clientes', (table) =>
        client.from(table).update(v.data).eq(v.idCol, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al actualizar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al actualizar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  static async deleteCliente(codCliente: string): Promise<void> {
    const client = requireClient();
    const cleanCod = codCliente.trim();
    const idCols = ['codcliente', 'codCliente', 'cod_cliente'];

    let lastError: any = null;
    let targetTable = 'clientes';

    for (const col of idCols) {
      const { error, usedTable } = await executeWithFallback(client, 'Clientes', (table) =>
        client.from(table).delete().eq(col, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al eliminar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al eliminar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  // ==========================================
  // 4. PRODUCTOS (public.Productos)
  // ==========================================
  static async getProductos(): Promise<Producto[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'Productos', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeProducto);
  }

  static async createProducto(prod: Producto): Promise<void> {
    const client = requireClient();
    const cod = prod.codProducto.trim();
    const nombre = prod.nombreProducto.trim();
    const clasif = prod.Clasificacion;
    const precio = prod.precioKg ?? 0;
    const unidad = prod.unidad || 'kg';

    // Priorizar los 3 campos oficiales estrictos del esquema: codProducto, nombreProducto, Clasificacion
    // NUNCA enviar 'id'
    const payloads = [
      // 1. Minúsculas oficiales del esquema
      { codproducto: cod, nombreproducto: nombre, clasificacion: clasif },
      // 2. CamelCase oficiales del esquema
      { codProducto: cod, nombreProducto: nombre, Clasificacion: clasif },
      // 3. Snake_case
      { cod_producto: cod, nombre_producto: nombre, clasificacion: clasif },
      // 4. Si la tabla llegara a tener columnas opcionales de precio / unidad
      { codproducto: cod, nombreproducto: nombre, clasificacion: clasif, preciokg: precio, unidad: unidad },
      { codProducto: cod, nombreProducto: nombre, Clasificacion: clasif, precioKg: precio, unidad: unidad },
    ];

    let lastError: any = null;
    let targetTable = 'productos';

    for (const payload of payloads) {
      const { error, usedTable } = await executeWithFallback(client, 'Productos', (table) =>
        client.from(table).insert([payload])
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al insertar en ${targetTable}: ${lastError?.message || 'Error de columnas'}`);
  }

  static async updateProducto(codProducto: string, prod: Partial<Producto>): Promise<void> {
    const client = requireClient();
    const cleanCod = codProducto.trim();
    const nombre = (prod.nombreProducto || '').trim();
    const clasif = prod.Clasificacion;

    const variants = [
      // 1. Minúsculas oficiales
      {
        data: {
          ...(nombre && { nombreproducto: nombre }),
          ...(clasif && { clasificacion: clasif }),
        },
        idCol: 'codproducto',
      },
      // 2. CamelCase oficiales
      {
        data: {
          ...(nombre && { nombreProducto: nombre }),
          ...(clasif && { Clasificacion: clasif }),
        },
        idCol: 'codProducto',
      },
      // 3. Snake_case
      {
        data: {
          ...(nombre && { nombre_producto: nombre }),
          ...(clasif && { clasificacion: clasif }),
        },
        idCol: 'cod_producto',
      },
    ];

    let lastError: any = null;
    let targetTable = 'productos';

    for (const v of variants) {
      const { error, usedTable } = await executeWithFallback(client, 'Productos', (table) =>
        client.from(table).update(v.data).eq(v.idCol, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al actualizar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al actualizar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  static async deleteProducto(codProducto: string): Promise<void> {
    const client = requireClient();
    const cleanCod = codProducto.trim();
    const idCols = ['codproducto', 'codProducto', 'cod_producto'];

    let lastError: any = null;
    let targetTable = 'productos';

    for (const col of idCols) {
      const { error, usedTable } = await executeWithFallback(client, 'Productos', (table) =>
        client.from(table).delete().eq(col, cleanCod)
      );
      targetTable = usedTable;
      if (!error) return;

      const isColumnErr =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        (error.message || '').toLowerCase().includes('column');

      if (isColumnErr) {
        lastError = error;
        continue;
      }

      throw new Error(`Error al eliminar en ${usedTable}: ${error.message}`);
    }

    throw new Error(`Error al eliminar en ${targetTable}: ${lastError?.message || 'Error desconocido'}`);
  }

  // ==========================================
  // 5. USUARIOS MOVILES (public.usuariosMoviles)
  // ==========================================
  static async getUsuarios(): Promise<UsuarioMovil[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'usuariosMoviles', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en tabla ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeUsuario);
  }

  static async getUsuarioByEmail(correo: string): Promise<UsuarioMovil | null> {
    const clean = (correo || '').trim().toLowerCase();
    if (!clean) return null;

    // 1. Obtener lista completa de usuarios (que sabemos que funciona sin errores de filtro de ruta en PostgREST)
    try {
      const allUsers = await this.getUsuarios();
      const match = allUsers.find((u) => u.correo.toLowerCase() === clean);
      if (match) return match;
    } catch (e) {
      console.warn('Error al buscar usuario en lista general:', e);
    }

    // 2. Fallback de consulta directa por correo / email
    try {
      const client = requireClient();
      const { data, error } = await executeWithFallback(client, 'usuariosMoviles', async (table) => {
        const res1 = await client.from(table).select('*').ilike('correo', clean).maybeSingle();
        if (!res1.error && res1.data) return res1;
        return client.from(table).select('*').ilike('email', clean).maybeSingle();
      });

      if (!error && data) {
        return normalizeUsuario(data);
      }
    } catch (e) {
      console.warn('Error en fallback directo por correo:', e);
    }

    return null;
  }

  static async createUsuario(user: UsuarioMovil): Promise<void> {
    const client = requireClient();
    const cleanEmail = (user.correo || '').trim().toLowerCase();
    const codes = parseClientCodes(user.codCliente);
    const rowToInsert: any = {
      correo: cleanEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      typeUser: user.typeUser,
    };
    if (codes.length > 0) {
      rowToInsert.codCliente = codes.join(', ');
    }

    const { error, usedTable } = await executeWithFallback(client, 'usuariosMoviles', (table) =>
      client.from(table).insert([rowToInsert])
    );

    if (error) {
      // Si la columna codCliente aún no existe en la tabla de Supabase (error 42703)
      if (
        (error.code === '42703' || (error.message || '').toLowerCase().includes('codcliente')) &&
        rowToInsert.codCliente !== undefined
      ) {
        console.warn('Columna codCliente aún no creada en Supabase; guardando sin ella.');
        delete rowToInsert.codCliente;
        const retry = await executeWithFallback(client, 'usuariosMoviles', (table) =>
          client.from(table).insert([rowToInsert])
        );
        if (retry.error) throw new Error(`Error al insertar en ${retry.usedTable}: ${retry.error.message}`);
        return;
      }
      throw new Error(`Error al insertar en ${usedTable}: ${error.message}`);
    }
  }

  static async updateUsuario(correo: string, user: Partial<UsuarioMovil>): Promise<void> {
    const client = requireClient();
    const cleanEmail = (correo || '').trim().toLowerCase();
    const updates: any = {};
    if (user.firstName !== undefined) updates.firstName = user.firstName;
    if (user.lastName !== undefined) updates.lastName = user.lastName;
    if (user.typeUser !== undefined) updates.typeUser = user.typeUser;
    if (user.codCliente !== undefined) {
      const codes = parseClientCodes(user.codCliente);
      updates.codCliente = codes.length > 0 ? codes.join(', ') : null;
    }

    const { error, usedTable } = await executeWithFallback(client, 'usuariosMoviles', (table) =>
      client.from(table).update(updates).eq('correo', cleanEmail)
    );

    if (error) {
      // Si la columna codCliente no existe en la tabla de Supabase (error 42703)
      if (
        (error.code === '42703' || (error.message || '').toLowerCase().includes('codcliente')) &&
        updates.codCliente !== undefined
      ) {
        console.warn('Columna codCliente aún no creada en Supabase; actualizando sin ella.');
        delete updates.codCliente;
        const retry = await executeWithFallback(client, 'usuariosMoviles', (table) =>
          client.from(table).update(updates).eq('correo', cleanEmail)
        );
        if (retry.error) throw new Error(`Error al actualizar en ${retry.usedTable}: ${retry.error.message}`);
        return;
      }
      throw new Error(`Error al actualizar en ${usedTable}: ${error.message}`);
    }
  }

  static async deleteUsuario(correo: string): Promise<void> {
    const client = requireClient();
    const cleanEmail = (correo || '').trim().toLowerCase();
    const { error, usedTable } = await executeWithFallback(client, 'usuariosMoviles', (table) =>
      client.from(table).delete().eq('correo', cleanEmail)
    );
    if (error) throw new Error(`Error al eliminar en ${usedTable}: ${error.message}`);
  }

  // ==========================================
  // 6. ASIGNACIÓN DE SALAS PARA EL USUARIO
  // Lee codCliente tanto de usuariosMoviles como de la tabla intermedia usuarioClientes
  // Soporta 1 o múltiples salas asociadas al usuario
  // ==========================================
  static async getClientesForUsuario(correo: string, userObj?: UsuarioMovil | null): Promise<Cliente[]> {
    const client = requireClient();
    const clean = (correo || '').trim().toLowerCase();
    const foundCodes = new Set<string>();

    // 1. Extraer codCliente directamente del objeto usuario (en usuariosMoviles)
    let user = userObj;
    if (!user && clean) {
      user = await this.getUsuarioByEmail(clean).catch(() => null);
    }

    if (user && user.codCliente) {
      const codes = parseClientCodes(user.codCliente);
      codes.forEach((c) => foundCodes.add(c));
    }

    // 2. Extraer de la tabla intermedia usuarioClientes si está presente
    try {
      const { data: assignments } = await executeWithFallback(client, 'usuarioClientes', (table) =>
        client.from(table).select('*')
      );

      if (assignments && assignments.length > 0) {
        assignments.forEach((a: any) => {
          const rowEmail = (a.correo || a.email || '').toString().trim().toLowerCase();
          if (rowEmail === clean) {
            const rawCode = a.codCliente || a.codcliente || a.cod_cliente || a.cliente;
            const codes = parseClientCodes(rawCode);
            codes.forEach((c) => foundCodes.add(c));
          }
        });
      }
    } catch {
      // Ignorar si usuarioClientes no existe
    }

    // 3. Consultar clientes existentes
    const allClientes = await this.getClientes().catch(() => []);

    if (foundCodes.size > 0) {
      const matched = allClientes.filter((c) =>
        foundCodes.has(c.codCliente) ||
        foundCodes.has(c.codCliente.toLowerCase()) ||
        Array.from(foundCodes).some((fc) => c.codCliente.toLowerCase() === fc.toLowerCase())
      );

      if (matched.length > 0) {
        return matched;
      }

      // Si los códigos están en usuariosMoviles pero aún no están en la tabla Clientes,
      // crear salas representativas para no bloquear la operación
      return Array.from(foundCodes).map((code) => ({
        codCliente: code,
        nombreCliente: `Sala ${code}`,
        idSupervisor: 'SUP-01',
      }));
    }

    // Si no tiene salas específicas vinculadas, devolver los clientes disponibles en la DB
    return allClientes;
  }

  static async setClientesForUsuario(correo: string, clientCodes: string[]): Promise<void> {
    const client = requireClient();
    const clean = (correo || '').trim().toLowerCase();
    const codesString = clientCodes.join(', ');

    // 1. Actualizar el campo codCliente directamente en usuariosMoviles
    try {
      await this.updateUsuario(clean, {
        codCliente: codesString,
      });
    } catch (e) {
      console.warn('No se pudo actualizar codCliente en usuariosMoviles:', e);
    }

    // 2. Actualizar también en la tabla intermedia usuarioClientes si existe
    try {
      await executeWithFallback(client, 'usuarioClientes', async (table) => {
        await client.from(table).delete().eq('correo', clean);
        if (clientCodes.length > 0) {
          const rows = clientCodes.map((cod) => ({
            correo: clean,
            codCliente: cod,
          }));
          return client.from(table).insert(rows);
        }
        return { data: null, error: null };
      });
    } catch {
      // Ignorar si no existe usuarioClientes
    }
  }

  // ==========================================
  // 7. ENCABEZADO Y DETALLE DE PEDIDOS
  // ==========================================
  static async getPedidos(): Promise<EncabezadoPedido[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'encabezadoPedido', (table) =>
      client.from(table).select('*')
    );

    if (error) throw new Error(`Error en ${usedTable}: ${error.message}`);
    return (data || []).map(normalizePedido).sort((a: EncabezadoPedido, b: EncabezadoPedido) => b.idPedido - a.idPedido);
  }

  static async getDetalles(idPedido?: number): Promise<DetallePedido[]> {
    const client = requireClient();
    const { data, error, usedTable } = await executeWithFallback(client, 'detallePedido', (table) => {
      let q = client.from(table).select('*');
      if (idPedido !== undefined) {
        q = q.eq('idPedido', idPedido);
      }
      return q;
    });

    if (error) throw new Error(`Error en ${usedTable}: ${error.message}`);
    return (data || []).map(normalizeDetalle);
  }

  static async isOrdenVentaAvailable(ordenVenta: string, currentIdPedido?: number): Promise<boolean> {
    const client = requireClient();
    const clean = ordenVenta.trim();
    if (!clean) return true;

    try {
      const colPairs = [
        { ovCol: 'ordenVenta', idCol: 'idPedido' },
        { ovCol: 'ordenventa', idCol: 'idpedido' },
        { ovCol: 'orden_venta', idCol: 'id_pedido' },
      ];

      for (const pair of colPairs) {
        const { data, error } = await executeWithFallback(client, 'encabezadoPedido', (table) => {
          let q = client.from(table).select('*').eq(pair.ovCol, clean);
          if (currentIdPedido !== undefined) {
            q = q.neq(pair.idCol, currentIdPedido);
          }
          return q;
        });

        if (!error) {
          return !data || data.length === 0;
        }

        const isColErr =
          error?.code === 'PGRST204' ||
          error?.code === '42703' ||
          (error?.message || '').toLowerCase().includes('column');
        if (!isColErr) {
          return true;
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  static async savePedidoConDetalles(
    encabezado: Omit<EncabezadoPedido, 'idPedido'>,
    detalles: Array<{ codProducto: string; cantidad: number; precioUnitario?: number }>
  ): Promise<{ success: boolean; idPedido: number; message?: string }> {
    const client = requireClient();

    if (encabezado.ordenVenta) {
      const isAvailable = await this.isOrdenVentaAvailable(encabezado.ordenVenta);
      if (!isAvailable) {
        return {
          success: false,
          idPedido: 0,
          message: `El número de Orden de Venta "${encabezado.ordenVenta}" ya está registrado en Supabase.`,
        };
      }
    }

    // El campo cantidadProductos debe ser llenado por el conteo de productos digitados
    // (por ejemplo 2 si se han digitado 2 productos en el pedido)
    const countProductos = detalles.length > 0 ? detalles.length : Number(encabezado.cantidadProductos || 0);

    const nowIso = new Date().toISOString();
    const userEmail = (encabezado.usuarioDigito || '').trim();
    const userCreo = encabezado.usuarioCreo || userEmail;
    const fechaCreo = encabezado.fechaCreo || nowIso;
    const userModifico = encabezado.usuarioModifico || userEmail;
    const fechaModifico = encabezado.fechaModifico || nowIso;

    // Variantes de payload para encabezadoPedido con tolerancia a columnas de bitácora
    // y casing en minúsculas (Postgres), camelCase y snake_case
    const headerVariants = [
      // 1. Minúsculas con Bitácora (estándar de PostgreSQL si se crearon las columnas)
      {
        fechaentrega: encabezado.fechaEntrega,
        usuariodigito: userEmail,
        codcliente: encabezado.codCliente,
        ordenventa: encabezado.ordenVenta || null,
        orderstatus: encabezado.orderStatus,
        cantidadproductos: countProductos,
        usuariocreo: userCreo,
        fechacreo: fechaCreo,
        usuariomodifico: userModifico,
        fechamodifico: fechaModifico,
      },
      // 2. camelCase con Bitácora
      {
        fechaEntrega: encabezado.fechaEntrega,
        usuarioDigito: userEmail,
        codCliente: encabezado.codCliente,
        ordenVenta: encabezado.ordenVenta || null,
        orderStatus: encabezado.orderStatus,
        cantidadProductos: countProductos,
        usuarioCreo: userCreo,
        fechaCreo: fechaCreo,
        usuarioModifico: userModifico,
        fechaModifico: fechaModifico,
      },
      // 3. snake_case con Bitácora
      {
        fecha_entrega: encabezado.fechaEntrega,
        usuario_digito: userEmail,
        cod_cliente: encabezado.codCliente,
        orden_venta: encabezado.ordenVenta || null,
        order_status: encabezado.orderStatus,
        cantidad_productos: countProductos,
        usuario_creo: userCreo,
        fecha_creo: fechaCreo,
        usuario_modifico: userModifico,
        fecha_modifico: fechaModifico,
      },
      // --- Fallbacks sin campos de bitácora (por si aún no se ejecutan las migraciones en Supabase) ---
      // 4. Minúsculas estándar
      {
        fechaentrega: encabezado.fechaEntrega,
        usuariodigito: userEmail,
        codcliente: encabezado.codCliente,
        ordenventa: encabezado.ordenVenta || null,
        orderstatus: encabezado.orderStatus,
        cantidadproductos: countProductos,
      },
      // 5. camelCase
      {
        fechaEntrega: encabezado.fechaEntrega,
        usuarioDigito: userEmail,
        codCliente: encabezado.codCliente,
        ordenVenta: encabezado.ordenVenta || null,
        orderStatus: encabezado.orderStatus,
        cantidadProductos: countProductos,
      },
      // 6. Híbrido: camelCase con cantidadproductos en minúscula
      {
        fechaEntrega: encabezado.fechaEntrega,
        usuarioDigito: userEmail,
        codCliente: encabezado.codCliente,
        ordenVenta: encabezado.ordenVenta || null,
        orderStatus: encabezado.orderStatus,
        cantidadproductos: countProductos,
      },
      // 7. Híbrido: minúsculas con cantidadProductos en camelCase
      {
        fechaentrega: encabezado.fechaEntrega,
        usuariodigito: userEmail,
        codcliente: encabezado.codCliente,
        ordenventa: encabezado.ordenVenta || null,
        orderstatus: encabezado.orderStatus,
        cantidadProductos: countProductos,
      },
      // 8. snake_case
      {
        fecha_entrega: encabezado.fechaEntrega,
        usuario_digito: userEmail,
        cod_cliente: encabezado.codCliente,
        orden_venta: encabezado.ordenVenta || null,
        order_status: encabezado.orderStatus,
        cantidad_productos: countProductos,
      },
    ];

    let headerData: any = null;
    let lastHeaderError: any = null;
    let encTableUsed = 'encabezadoPedido';

    // Intentar insertar encabezadoPedido probando las variantes de columna
    for (const payload of headerVariants) {
      const { data, error, usedTable } = await executeWithFallback(
        client,
        'encabezadoPedido',
        (table) => client.from(table).insert([payload]).select().single()
      );
      encTableUsed = usedTable;

      if (!error && data) {
        headerData = data;
        lastHeaderError = null;
        break;
      }

      // Si insertó sin error pero no devolvió el single() (ej. RLS o select vacío)
      if (!error && !data) {
        const { data: recentRows } = await executeWithFallback(
          client,
          'encabezadoPedido',
          (table) =>
            client
              .from(table)
              .select('*')
              .order('idPedido', { ascending: false })
              .limit(1)
        );
        if (recentRows && recentRows.length > 0) {
          headerData = recentRows[0];
          lastHeaderError = null;
          break;
        }
      }

      lastHeaderError = error;

      const isColErr =
        error?.code === 'PGRST204' ||
        error?.code === '42703' ||
        (error?.message || '').toLowerCase().includes('column') ||
        (error?.message || '').toLowerCase().includes('schema cache');

      if (isColErr) {
        continue;
      }

      // Si es otro error (por ejemplo Orden de Venta duplicada por restricción UNIQUE de base de datos)
      break;
    }

    if (!headerData) {
      throw new Error(`Error al insertar en ${encTableUsed}: ${lastHeaderError?.message || 'No se pudo registrar el encabezado del pedido'}`);
    }

    const nuevoIdPedido = Number(
      headerData.idPedido ??
      headerData.idpedido ??
      headerData.id_pedido ??
      headerData.id ??
      0
    );

    // 2. Insertar detallePedido con soporte para columnas de bitácora y casing
    if (detalles.length > 0 && nuevoIdPedido > 0) {
      const detailVariants = [
        // 1. Minúsculas con Bitácora
        detalles.map((d) => ({
          idpedido: nuevoIdPedido,
          codproducto: d.codProducto,
          cantidad: d.cantidad,
          usuariocreo: userCreo,
          fechacreo: fechaCreo,
          usuariomodifico: userModifico,
          fechamodifico: fechaModifico,
        })),
        // 2. camelCase con Bitácora
        detalles.map((d) => ({
          idPedido: nuevoIdPedido,
          codProducto: d.codProducto,
          cantidad: d.cantidad,
          usuarioCreo: userCreo,
          fechaCreo: fechaCreo,
          usuarioModifico: userModifico,
          fechaModifico: fechaModifico,
        })),
        // 3. snake_case con Bitácora
        detalles.map((d) => ({
          id_pedido: nuevoIdPedido,
          cod_producto: d.codProducto,
          cantidad: d.cantidad,
          usuario_creo: userCreo,
          fecha_creo: fechaCreo,
          usuario_modifico: userModifico,
          fecha_modifico: fechaModifico,
        })),
        // --- Fallbacks sin Bitácora ---
        // 4. Minúsculas estándar de Postgres
        detalles.map((d) => ({
          idpedido: nuevoIdPedido,
          codproducto: d.codProducto,
          cantidad: d.cantidad,
        })),
        // 5. camelCase exacto
        detalles.map((d) => ({
          idPedido: nuevoIdPedido,
          codProducto: d.codProducto,
          cantidad: d.cantidad,
        })),
        // 6. snake_case
        detalles.map((d) => ({
          id_pedido: nuevoIdPedido,
          cod_producto: d.codProducto,
          cantidad: d.cantidad,
        })),
      ];

      let detSuccess = false;
      let lastDetError: any = null;
      let detTableUsed = 'detallePedido';

      for (const items of detailVariants) {
        const { error: itemsError, usedTable } = await executeWithFallback(
          client,
          'detallePedido',
          (table) => client.from(table).insert(items as any)
        );
        detTableUsed = usedTable;

        if (!itemsError) {
          detSuccess = true;
          break;
        }

        lastDetError = itemsError;
        const isColErr =
          itemsError?.code === 'PGRST204' ||
          itemsError?.code === '42703' ||
          (itemsError?.message || '').toLowerCase().includes('column') ||
          (itemsError?.message || '').toLowerCase().includes('schema cache');

        if (isColErr) {
          continue;
        }
        break;
      }

      if (!detSuccess && lastDetError) {
        throw new Error(
          `Error al insertar en ${detTableUsed} para el pedido #${nuevoIdPedido}: ${lastDetError.message}`
        );
      }
    }

    return { success: true, idPedido: nuevoIdPedido };
  }

  static async anularPedido(idPedido: number, usuarioModifico?: string): Promise<{ success: boolean; freedOV: string | null }> {
    const client = requireClient();
    const nowIso = new Date().toISOString();
    const modUser = (usuarioModifico || '').trim();

    let existing: any = null;
    for (const col of ['idPedido', 'idpedido', 'id_pedido', 'id']) {
      const { data } = await executeWithFallback(client, 'encabezadoPedido', (table) =>
        client.from(table).select('*').eq(col, idPedido).maybeSingle()
      );
      if (data) {
        existing = data;
        break;
      }
    }

    const anteriorOV = existing ? (existing.ordenVenta || existing.ordenventa || existing.orden_venta || null) : null;

    const updateVariants = [
      // Con bitácora de modificación
      ...(modUser
        ? [
            {
              data: { orderstatus: 'Anulado', ordenventa: null, usuariomodifico: modUser, fechamodifico: nowIso },
              col: 'idpedido',
            },
            {
              data: { orderStatus: 'Anulado', ordenVenta: null, usuarioModifico: modUser, fechaModifico: nowIso },
              col: 'idPedido',
            },
            {
              data: { order_status: 'Anulado', orden_venta: null, usuario_modifico: modUser, fecha_modifico: nowIso },
              col: 'id_pedido',
            },
          ]
        : []),
      // Fallback sin bitácora por si no existen aún las columnas
      { data: { orderstatus: 'Anulado', ordenventa: null }, col: 'idpedido' },
      { data: { orderStatus: 'Anulado', ordenVenta: null }, col: 'idPedido' },
      { data: { order_status: 'Anulado', orden_venta: null }, col: 'id_pedido' },
    ];

    let updateSuccess = false;
    let lastError: any = null;
    let tableUsed = 'encabezadoPedido';

    for (const v of updateVariants) {
      const { error, usedTable } = await executeWithFallback(client, 'encabezadoPedido', (table) =>
        client.from(table).update(v.data).eq(v.col, idPedido)
      );
      tableUsed = usedTable;
      if (!error) {
        updateSuccess = true;
        break;
      }
      lastError = error;
    }

    if (!updateSuccess && lastError) {
      throw new Error(`Error al anular pedido en ${tableUsed}: ${lastError.message}`);
    }

    return { success: true, freedOV: anteriorOV };
  }

  // Diagnóstico completo
  static async testConnection(): Promise<{
    connected: boolean;
    counts: Record<string, number>;
    resolvedTables: Record<string, string>;
    foundUserEmail?: string;
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        connected: false,
        counts: {},
        resolvedTables: {},
        error: 'No hay URL o Anon Key de Supabase configurada.',
      };
    }

    try {
      const counts: Record<string, number> = {};
      const resolved: Record<string, string> = {};

      const keys: Array<keyof typeof TABLE_CANDIDATES> = [
        'usuariosMoviles',
        'Clientes',
        'Supervisor',
        'Ruta',
        'Productos',
        'usuarioClientes',
        'encabezadoPedido',
        'detallePedido',
      ];

      for (const k of keys) {
        const { data, usedTable } = await executeWithFallback(client, k, (t) =>
          client.from(t).select('*', { count: 'exact', head: true })
        );
        resolved[k] = usedTable;
        counts[k] = (data as any) ?? 0;
      }

      // Obtener correos existentes en la tabla de usuarios
      let foundUserEmail: string | undefined = undefined;
      const { data: usersData } = await executeWithFallback(client, 'usuariosMoviles', (t) =>
        client.from(t).select('*')
      );

      if (usersData && Array.isArray(usersData) && usersData.length > 0) {
        const emails = usersData.map((u: any) => (u.correo || u.email || '').toString().trim());
        foundUserEmail = emails.filter(Boolean).join(', ');
      }

      return {
        connected: true,
        counts,
        resolvedTables: resolved,
        foundUserEmail,
      };
    } catch (err: any) {
      return {
        connected: false,
        counts: {},
        resolvedTables: {},
        error: err.message || 'Error de conexión',
      };
    }
  }
}

// Script SQL PostgreSQL DDL
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- ESQUEMA POSTGRESQL PARA SUPABASE
-- Con soporte para codCliente directo en usuariosMoviles
-- ========================================================

-- Si ya creaste usuariosMoviles, puedes agregar el campo codCliente así:
ALTER TABLE IF EXISTS public."usuariosMoviles" ADD COLUMN IF NOT EXISTS "codCliente" TEXT;
-- O si tu tabla está en minúsculas:
ALTER TABLE IF EXISTS public.usuariosmoviles ADD COLUMN IF NOT EXISTS "codCliente" TEXT;

-- Script de creación completa:
DO $$ BEGIN
  CREATE TYPE plantel_enum AS ENUM ('AT', 'SM', 'ST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE clasificacion_producto_enum AS ENUM (
    'POLLO FRESCO',
    'EMBUTIDOS',
    'EMPANIZADOS',
    'HUGO PORK',
    'POLLO CAFETERIA'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_usuario_enum AS ENUM ('ADMIN', 'DISPLAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('Digitado', 'Nuevo', 'Recibido', 'Anulado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabla: usuariosMoviles (con soporte para codCliente directo)
CREATE TABLE IF NOT EXISTS public."usuariosMoviles" (
  "correo" TEXT PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "typeUser" tipo_usuario_enum NOT NULL DEFAULT 'DISPLAY',
  "codCliente" TEXT NULL
);

-- Tabla: Clientes
CREATE TABLE IF NOT EXISTS public."Clientes" (
  "codCliente" TEXT PRIMARY KEY,
  "nombreCliente" TEXT NOT NULL,
  "idSupervisor" TEXT NOT NULL
);

-- Tabla: Supervisor
CREATE TABLE IF NOT EXISTS public."Supervisor" (
  "idSupervisor" TEXT PRIMARY KEY,
  "nombreSupervisor" TEXT NOT NULL
);

-- Tabla: Ruta
CREATE TABLE IF NOT EXISTS public."Ruta" (
  "codRuta" TEXT PRIMARY KEY,
  "nombreRuta" TEXT NOT NULL,
  "Plantel" plantel_enum NOT NULL
);

-- Tabla: Productos
CREATE TABLE IF NOT EXISTS public."Productos" (
  "codProducto" TEXT PRIMARY KEY,
  "nombreProducto" TEXT NOT NULL,
  "Clasificacion" clasificacion_producto_enum NOT NULL,
  "precioKg" NUMERIC(10,2) DEFAULT 0.00,
  "unidad" TEXT DEFAULT 'kg'
);

-- Tabla: encabezadoPedido (con campos de auditoría y bitácora)
CREATE TABLE IF NOT EXISTS public."encabezadoPedido" (
  "idPedido" SERIAL PRIMARY KEY,
  "fechaEntrega" DATE NOT NULL,
  "usuarioDigito" TEXT NOT NULL,
  "codCliente" TEXT NOT NULL,
  "ordenVenta" VARCHAR(15) NULL,
  "orderStatus" order_status_enum NOT NULL DEFAULT 'Digitado',
  "cantidadProductos" INTEGER NOT NULL DEFAULT 0,
  "creadoEn" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "usuarioCreo" TEXT NULL,
  "fechaCreo" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "usuarioModifico" TEXT NULL,
  "fechaModifico" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: detallePedido (con campos de auditoría, bitácora y borrado en cascada)
CREATE TABLE IF NOT EXISTS public."detallePedido" (
  "idPedido" INTEGER NOT NULL,
  "codProducto" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "usuarioCreo" TEXT NULL,
  "fechaCreo" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "usuarioModifico" TEXT NULL,
  "fechaModifico" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("idPedido", "codProducto"),
  CONSTRAINT fk_detalle_encabezado
    FOREIGN KEY ("idPedido")
    REFERENCES public."encabezadoPedido" ("idPedido")
    ON DELETE CASCADE
);

-- =========================================================
-- SCRIPT DE MIGRACIÓN PARA TABLAS YA EXISTENTES EN SUPABASE:
-- Copia y ejecuta este bloque en Supabase > SQL Editor si tus
-- tablas ya fueron creadas previamente:
-- =========================================================

-- 1. Agregar campos de bitácora a encabezadoPedido:
ALTER TABLE public."encabezadoPedido" 
  ADD COLUMN IF NOT EXISTS "usuarioCreo" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaCreo" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "usuarioModifico" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaModifico" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Agregar campos de bitácora a detallePedido:
ALTER TABLE public."detallePedido" 
  ADD COLUMN IF NOT EXISTS "usuarioCreo" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaCreo" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "usuarioModifico" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaModifico" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Configurar Borrado en Cascada (ON DELETE CASCADE) si aún no está activo:
ALTER TABLE public."detallePedido" 
  DROP CONSTRAINT IF EXISTS fk_detalle_encabezado;

ALTER TABLE public."detallePedido"
  ADD CONSTRAINT fk_detalle_encabezado
  FOREIGN KEY ("idPedido") 
  REFERENCES public."encabezadoPedido" ("idPedido")
  ON DELETE CASCADE;

-- (Variante si tus tablas están en minúsculas sin comillas en Postgres):
-- ALTER TABLE public.detallepedido DROP CONSTRAINT IF EXISTS fk_detalle_encabezado;
-- ALTER TABLE public.detallepedido ADD CONSTRAINT fk_detalle_encabezado FOREIGN KEY (idpedido) REFERENCES public.encabezadopedido(idpedido) ON DELETE CASCADE;
`;
