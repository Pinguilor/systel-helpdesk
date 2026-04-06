export type UserRole = 'usuario' | 'tecnico' | 'coordinador' | 'admin_bodega' | 'admin';
export type TicketStatus = 'esperando_agente' | 'abierto' | 'pendiente' | 'programado' | 'en_progreso' | 'resuelto' | 'cerrado' | 'anulado';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'crítica';

export interface Profile {
  id: string;
  full_name: string | null;
  rol: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Restaurante {
  id: string;
  sigla: string;
  centro_costo: string | null;
  store_id: string | null;
  compania: string | null;
  nombre_restaurante: string;
  direccion: string | null;
  region: string | null;
  razon_social: string | null;
}

export interface CatalogoServicio {
  id: string; // UUID
  categoria: string;
  subcategoria: string;
  elemento: string;
  activo: boolean;
}

export interface Zona {
  id: string; // UUID
  nombre: string;
  activo: boolean;
}

export interface TicketInsert {
  id?: string;
  numero_ticket?: number;
  titulo: string;
  descripcion: string;
  descripcion_editada?: boolean;
  modificado_por?: string | null;
  fecha_modificacion?: string | null;
  prioridad?: TicketPriority;
  estado?: TicketStatus;
  creado_por: string; // References profiles
  adjuntos?: string[]; // URLs from bucket
  agente_asignado_id?: string | null; // References profiles
  restaurante_id: string; // References restaurantes
  catalogo_servicio_id: string; // References catalogo_servicios
  zona_id: string; // References zonas
  fecha_programada?: string | null; // Timestamp for scheduled visit
  ticket_padre_id?: string | null;
  sufijo_hijo?: string | null;
  notas_cierre?: string | null;
  firma_cliente?: string | null;
  firma_tecnico?: string | null;
  receptor_nombre?: string | null;
}

export interface Ticket extends TicketInsert {
  id: string;
  numero_ticket: number;
  fecha_creacion: string;
  actualizado_en: string;
  estado: TicketStatus;
  prioridad: TicketPriority;
  descripcion_editada: boolean;
  modificado_por?: string | null;
  fecha_modificacion?: string | null;
  profiles?: {
    full_name: string | null;
  };
  agente?: {
    full_name: string | null;
  };
  restaurantes?: Restaurante | null; // Fixed from 'restaurante' to 'restaurantes' for JOIN compatibility
  ticket_messages?: TicketMessage[];
  respuesta_agente?: string | null;
  fecha_resolucion?: string | null;
  calificacion?: number;
  feedback_cliente?: string | null;
  catalogo_servicios?: CatalogoServicio | null;
  zona?: Zona | null;
  padre?: {
    numero_ticket: number;
    titulo?: string;
  } | null;
}

export interface TicketMessageInsert {
  id?: string;
  ticket_id: string;
  sender_id: string; // References profiles
  mensaje: string;
  adjuntos?: string[]; // URLs from bucket
  es_sistema?: boolean;
  tipo_evento?: string; // e.g. 'texto', 'visita_programada'
}

export interface TicketMessage extends TicketMessageInsert {
  id: string;
  creado_en: string;
  tipo_evento: string; // e.g. 'texto', 'visita_programada'
  sender_profile?: {
    full_name: string | null;
    rol: UserRole;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  ticket_id: string;
  mensaje: string;
  leida: boolean;
  creado_en: string;
  tipo?: string;
}

// NUEVAS TABLAS PARA FIELD SERVICE
export interface Bodega {
    id: string;
    nombre: string;
    tipo: 'INTERNA' | 'VIRTUAL' | 'MOCHILA';
    descripcion?: string | null;
    activo?: boolean;
    local_id?: string | null; // references restaurantes
}

export interface FamiliaHardware {
    id: string;
    nombre: string;
}

export interface CatalogoEquipos {
    id: string;
    familia: string;
    modelo: string;
    es_serializado: boolean;
}

export interface Inventario {
    id: string;
    bodega_id: string; // ref bodegas
    modelo: string;
    familia: string;
    es_serializado: boolean;
    numero_serie?: string | null; // opcional para cables, etc.
    estado: 'Disponible' | 'En Tránsito' | 'Dañado' | 'Instalado';
    cantidad: number; // 1 para serializado, N para cables
    
    // Virtual relations for joins
    bodegas?: Bodega;
}

export interface MovimientoInventario {
    id: string;
    inventario_id: string;
    ticket_id: string;
    bodega_origen_id: string;
    bodega_destino_id: string;
    cantidad: number;
    fecha_movimiento: string;
    realizado_por: string; // ref profiles
}
