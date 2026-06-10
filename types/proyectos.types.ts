import type { UserRole } from './database.types';

export type { UserRole };

export type ProyectoEstado =
  | 'planificacion'
  | 'en_progreso'
  | 'pausado'
  | 'completado'
  | 'cancelado';

export type BomItemEstado = 'requerido' | 'asignado' | 'instalado' | 'pendiente';

export type BitacoraEntradaTipo = 'nota' | 'foto' | 'firma' | 'hito';

// ── Proyectos ────────────────────────────────────────────────

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string | null;
  cliente_id: string | null;
  estado: ProyectoEstado;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  fecha_fin_real: string | null;
  creado_por: string;
  coordinador_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProyectoConRelaciones extends Proyecto {
  cliente: { nombre_restaurante: string; sigla: string } | null;
  coordinador: { full_name: string | null } | null;
  participantes?: ProyectoParticipanteConPerfil[];
}

// ── Participantes ────────────────────────────────────────────

export interface ProyectoParticipante {
  id: string;
  proyecto_id: string;
  perfil_id: string;
  rol_en_proyecto: string;
  activo: boolean;
  created_at: string;
}

export interface ProyectoParticipanteConPerfil extends ProyectoParticipante {
  perfil: { id: string; full_name: string | null; rol: UserRole } | null;
}

// ── Bitácora ─────────────────────────────────────────────────

export interface BitacoraEntrada {
  id: string;
  proyecto_id: string;
  autor_id: string;
  tipo: BitacoraEntradaTipo;
  contenido: string | null;
  adjuntos: string[];
  created_at: string;
  autor?: { full_name: string | null };
  firma?: BitacoraFirma | null;
}

export interface BitacoraFirma {
  id: string;
  proyecto_id: string;
  entrada_id: string;
  firmante_nombre: string;
  firmante_cargo: string | null;
  storage_path: string;
  storage_url: string;
  sha256_hash: string;
  signed_at: string;
}

// ── BOM ──────────────────────────────────────────────────────

export interface ProyectoBom {
  id: string;
  proyecto_id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  items?: BomItem[];
}

export interface BomItem {
  id: string;
  bom_id: string;
  proyecto_id: string;
  familia: string;
  modelo: string;
  es_serializado: boolean;
  cantidad_requerida: number;
  estado: BomItemEstado;
  bodega_origen_id: string | null;
  inventario_id: string | null;
  numero_serie: string | null;
  notas: string | null;
  actualizado_por: string | null;
  created_at: string;
  updated_at: string;
  bodega?: { nombre: string } | null;
}

export interface MovimientoProyecto {
  id: string;
  bom_item_id: string;
  proyecto_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  realizado_por: string;
  notas: string | null;
  created_at: string;
}

// ── Config visual del BOM ────────────────────────────────────

export const BOM_ESTADO_CONFIG: Record<
  BomItemEstado,
  {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    nextStates: BomItemEstado[];
  }
> = {
  requerido: {
    label: 'Requerido',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
    nextStates: ['asignado', 'pendiente'],
  },
  asignado: {
    label: 'Asignado',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-300',
    nextStates: ['instalado', 'requerido'],
  },
  instalado: {
    label: 'Instalado',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-300',
    nextStates: [], // estado terminal
  },
  pendiente: {
    label: 'Pendiente',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
    nextStates: ['requerido'],
  },
};

export const PROYECTO_ESTADO_CONFIG: Record<
  ProyectoEstado,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  planificacion: {
    label: 'Planificación',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
  },
  en_progreso: {
    label: 'En Progreso',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-300',
  },
  pausado: {
    label: 'Pausado',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
  },
  completado: {
    label: 'Completado',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-300',
  },
  cancelado: {
    label: 'Cancelado',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-300',
  },
};
