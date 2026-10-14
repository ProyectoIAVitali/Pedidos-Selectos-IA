export type PlantelEnum = 'AT' | 'SM' | 'ST';

export type ClasificacionProducto =
  | 'POLLO FRESCO'
  | 'EMBUTIDOS'
  | 'EMPANIZADOS'
  | 'HUGO PORK'
  | 'POLLO CAFETERIA';

export type UserRole = 'ADMIN' | 'DISPLAY';

export type OrderStatus = 'Digitado' | 'Nuevo' | 'Recibido' | 'Anulado';

export interface Ruta {
  codRuta: string; // PK
  nombreRuta: string;
  Plantel: PlantelEnum;
}

export interface Supervisor {
  idSupervisor: string; // PK
  nombreSupervisor: string;
}

export interface Cliente {
  codCliente: string; // PK
  nombreCliente: string;
  idSupervisor: string; // FK -> Supervisor.idSupervisor
}

export interface Producto {
  codProducto: string; // PK
  nombreProducto: string;
  Clasificacion: ClasificacionProducto;
  precioKg?: number; // Precio referencial en Lempiras
  unidad?: string; // kg o cajas
}

export interface UsuarioMovil {
  correo: string; // PK
  firstName: string;
  lastName: string;
  typeUser: UserRole;
  codCliente?: string | string[]; // Campo para referenciar el/los cliente(s) asignados directamente
}

export interface UsuarioCliente {
  idUsuarioCliente: string; // PK
  correo: string; // FK -> usuariosMoviles.correo
  codCliente: string; // FK -> Clientes.codCliente
}

export interface EncabezadoPedido {
  idPedido: number; // PK auto-incrementable
  fechaEntrega: string; // YYYY-MM-DD
  usuarioDigito: string; // Correo de la cuenta
  codCliente: string; // FK -> Clientes.codCliente
  ordenVenta: string | null; // 10 a 15 dígitos. Nullable si se anula
  orderStatus: OrderStatus;
  cantidadProductos: number;
  creadoEn?: string;
  observaciones?: string;
  // Campos de Bitácora y Auditoría
  usuarioCreo?: string; // Usuario / cuenta Google que adicionó el pedido
  fechaCreo?: string; // Fecha y hora en que se adicionó
  usuarioModifico?: string | null; // Usuario que modificó o anuló por última vez
  fechaModifico?: string | null; // Fecha y hora de última modificación
}

export interface DetallePedido {
  idPedido: number; // PK Compuesta parte 1
  codProducto: string; // PK Compuesta parte 2
  cantidad: number;
  precioUnitario?: number;
  // Campos de Bitácora y Auditoría
  usuarioCreo?: string; // Usuario / cuenta Google que adicionó el ítem
  fechaCreo?: string; // Fecha y hora en que se adicionó
  usuarioModifico?: string | null; // Usuario que modificó por última vez
  fechaModifico?: string | null; // Fecha y hora de última modificación
}

export interface CartItem {
  producto: Producto;
  cantidad: number;
}
