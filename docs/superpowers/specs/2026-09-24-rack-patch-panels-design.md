# Patch Panels + Cruzadas en el Rack Mapper

**Fecha:** 2026-09-24
**Estado:** Propuesto (pendiente de implementación)
**Contexto previo:** `docs/superpowers/specs/rack-mapper-design.md` (diseño original de switches/puertos)

## Problema

El Mapa de Switch/Rack modela solo infraestructura activa (switches). Los técnicos en
terreno documentan primero la infraestructura pasiva (Patch Panels, bocas/jacks) y
luego hacen la "cruzada" (patch cord) hacia el switch. Hoy no hay forma de registrar
un Patch Panel ni una cruzada; el único vínculo es switch-puerto → dispositivo directo.

## Decisiones de alcance (confirmadas)

1. Cruzadas solo **Patch Panel → Switch** (no panel-a-panel).
2. Cardinalidad **1 a 1**: una boca se cruza a lo sumo a un puerto de switch.
3. Al liberar un puerto de switch cruzado, la boca vuelve a "pendiente de cruzada"
   automáticamente (no se guarda estado en la boca, se deriva).
4. Plantillas (`rack_templates`) **no** se extienden en esta fase.
5. El modal de puerto del switch tiene dos modos mutuamente excluyentes:
   "Conexión directa" (dispositivo de Receta Maestra, como hoy) y "Cruzada a Patch
   Panel" (hereda dispositivo/ubicación de la boca).
6. Tamaños de Patch Panel: **24 o 48** bocas.
7. La boca se documenta igual que un puerto de switch: **Receta Maestra + etiqueta
   libre + notas** (sin rol/PoE/VLAN, que son atributos de puerto activo).
8. "Autogenerar bocas": prefijo + rango, genera etiquetas secuenciales editables
   después boca por boca.

## Modelo de datos

Se evaluaron 3 enfoques (tabla polimórfica, tablas separadas, modelo genérico de
links). Se eligió **tablas separadas**, paralelas a `proyecto_switches`/
`proyecto_puertos`, porque respeta la separación semántica activa/pasiva sin columnas
irrelevantes (una boca no tiene `rol`/`es_poe`/`vlan`), y reutiliza el patrón sparse-row
+ color derivado ya validado en el código existente.

```
proyecto_switches ──< proyecto_puertos >── cruzado_boca_id ──> proyecto_bocas >── proyecto_patch_panels
                                (nullable FK,                        (patch_panel_id,
                                 UNIQUE, mutuamente                   UNIQUE con numero_boca)
                                 excluyente con
                                 proyecto_equipamiento_id)
```

Un puerto de switch documenta un dispositivo de **una sola forma**: directo
(`proyecto_equipamiento_id`/`inventario_id`) **o** cruzada (`cruzado_boca_id`), nunca
ambas. La boca en sí no sabe si está cruzada — eso se deriva consultando si algún
`proyecto_puertos.cruzado_boca_id` apunta a ella (mismo espíritu que "PoE/uplink/
ocupado son ortogonales" en `PortCell.tsx`).

### SQL — `sql/rack_mapper_patch_panels.sql`

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — Patch Panels + Cruzadas (Fase 3)
-- Extiende sql/rack_mapper.sql. Tablas paralelas a switches/puertos para
-- infraestructura pasiva, más una FK de cruzada en proyecto_puertos.
-- Diseño: docs/superpowers/specs/2026-09-24-rack-patch-panels-design.md
-- Idempotente: usa IF NOT EXISTS / DROP ... IF EXISTS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── TABLA: proyecto_patch_panels ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_patch_panels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL DEFAULT 'Patch Panel',
  num_bocas    INTEGER NOT NULL CHECK (num_bocas IN (24, 48)),
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLA: proyecto_bocas ────────────────────────────────────────────────────
-- Modelo disperso, igual que proyecto_puertos: sin fila = boca no rematada.
-- Sin rol/es_poe/vlan: son atributos de puerto activo, no de infraestructura pasiva.
CREATE TABLE IF NOT EXISTS proyecto_bocas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_panel_id   UUID NOT NULL REFERENCES proyecto_patch_panels(id) ON DELETE CASCADE,
  numero_boca      INTEGER NOT NULL CHECK (numero_boca >= 1),
  proyecto_equipamiento_id UUID REFERENCES proyecto_equipamiento(id) ON DELETE SET NULL,
  etiqueta_libre   TEXT,
  notas            TEXT,
  actualizado_por  UUID REFERENCES profiles(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patch_panel_id, numero_boca)
);

-- ── proyecto_puertos: columna de cruzada ────────────────────────────────────
ALTER TABLE proyecto_puertos
  ADD COLUMN IF NOT EXISTS cruzado_boca_id UUID REFERENCES proyecto_bocas(id) ON DELETE RESTRICT;

-- Una boca solo puede alimentar un puerto de switch (1:1).
CREATE UNIQUE INDEX IF NOT EXISTS uq_puertos_cruzado_boca
  ON proyecto_puertos(cruzado_boca_id) WHERE cruzado_boca_id IS NOT NULL;

-- Mutuamente excluyente con la asignación directa de dispositivo.
ALTER TABLE proyecto_puertos DROP CONSTRAINT IF EXISTS chk_puerto_directo_o_cruzada;
ALTER TABLE proyecto_puertos ADD CONSTRAINT chk_puerto_directo_o_cruzada
  CHECK (NOT (proyecto_equipamiento_id IS NOT NULL AND cruzado_boca_id IS NOT NULL));

-- ── ÍNDICES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patchpanels_proyecto ON proyecto_patch_panels(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_bocas_panel           ON proyecto_bocas(patch_panel_id);
CREATE INDEX IF NOT EXISTS idx_bocas_equip           ON proyecto_bocas(proyecto_equipamiento_id);
CREATE INDEX IF NOT EXISTS idx_puertos_cruzado_boca  ON proyecto_puertos(cruzado_boca_id);

-- ── TRIGGER: updated_at automático en proyecto_bocas ────────────────────────
-- Reutiliza set_updated_at() ya creada en rack_mapper.sql.
DROP TRIGGER IF EXISTS trg_bocas_updated_at ON proyecto_bocas;
CREATE TRIGGER trg_bocas_updated_at
  BEFORE UPDATE ON proyecto_bocas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TRIGGER: numero_boca dentro del rango del panel ─────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_numero_boca()
RETURNS TRIGGER AS $$
DECLARE v_max INTEGER;
BEGIN
  SELECT num_bocas INTO v_max FROM proyecto_patch_panels WHERE id = NEW.patch_panel_id;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'El patch panel % no existe.', NEW.patch_panel_id;
  END IF;
  IF NEW.numero_boca < 1 OR NEW.numero_boca > v_max THEN
    RAISE EXCEPTION 'numero_boca % fuera de rango (1..%) para este panel.', NEW.numero_boca, v_max;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_numero_boca ON proyecto_bocas;
CREATE TRIGGER trg_validar_numero_boca
  BEFORE INSERT OR UPDATE OF numero_boca, patch_panel_id ON proyecto_bocas
  FOR EACH ROW EXECUTE FUNCTION fn_validar_numero_boca();

-- ── TRIGGER: la cruzada debe apuntar a una boca del MISMO proyecto ──────────
CREATE OR REPLACE FUNCTION fn_validar_cruzada_mismo_proyecto()
RETURNS TRIGGER AS $$
DECLARE v_proyecto_switch UUID; v_proyecto_boca UUID;
BEGIN
  IF NEW.cruzado_boca_id IS NULL THEN RETURN NEW; END IF;
  SELECT s.proyecto_id INTO v_proyecto_switch FROM proyecto_switches s WHERE s.id = NEW.switch_id;
  SELECT pp.proyecto_id INTO v_proyecto_boca
    FROM proyecto_bocas b JOIN proyecto_patch_panels pp ON pp.id = b.patch_panel_id
    WHERE b.id = NEW.cruzado_boca_id;
  IF v_proyecto_boca IS NULL OR v_proyecto_boca <> v_proyecto_switch THEN
    RAISE EXCEPTION 'La boca cruzada debe pertenecer a un patch panel del mismo proyecto.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_cruzada ON proyecto_puertos;
CREATE TRIGGER trg_validar_cruzada
  BEFORE INSERT OR UPDATE OF cruzado_boca_id, switch_id ON proyecto_puertos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_cruzada_mismo_proyecto();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — mismo patrón que proyecto_switches/proyecto_puertos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE proyecto_patch_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_bocas        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patch_panels_admin_coord ON proyecto_patch_panels;
CREATE POLICY patch_panels_admin_coord
  ON proyecto_patch_panels FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS patch_panels_participante_read ON proyecto_patch_panels;
CREATE POLICY patch_panels_participante_read
  ON proyecto_patch_panels FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_participantes pp
    WHERE pp.proyecto_id = proyecto_patch_panels.proyecto_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));

DROP POLICY IF EXISTS bocas_admin_coord ON proyecto_bocas;
CREATE POLICY bocas_admin_coord
  ON proyecto_bocas FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS bocas_participante_read ON proyecto_bocas;
CREATE POLICY bocas_participante_read
  ON proyecto_bocas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_patch_panels p
    JOIN proyecto_participantes pp ON pp.proyecto_id = p.proyecto_id
    WHERE p.id = proyecto_bocas.patch_panel_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));
```

**Nota sobre `ON DELETE RESTRICT`:** a diferencia de `proyecto_equipamiento_id` en
`proyecto_puertos` (que usa `SET NULL`), `cruzado_boca_id` usa `RESTRICT` para que
borrar una boca cruzada falle con un error claro en vez de dejar un puerto de switch
en un estado ambiguo (ni libre ni con dispositivo). La acción del servidor traduce
ese error a un mensaje amigable (ver más abajo).

## Estados visuales / leyenda

**Puerto de switch** (sin cambios en la lógica de color — una cruzada rellena
`cruzado_boca_id` en vez de `proyecto_equipamiento_id`, pero para `PortCell` sigue
siendo "ocupado"):

| Color | Estado |
|---|---|
| gris | Libre |
| esmeralda | Ocupado (directo o cruzado) |
| azul | Uplink |
| índigo claro | Reservado (fila sin equipo) |
| punto ámbar | PoE |

**Boca de Patch Panel** (nuevo, en `BocaCell`):

| Color | Estado | Condición |
|---|---|---|
| gris | Sin rematar | no existe fila en `proyecto_bocas` |
| ámbar | Pendiente de cruzada | existe fila, pero ningún puerto de switch tiene `cruzado_boca_id` apuntando a ella |
| violeta | Cruzada | algún puerto de switch tiene `cruzado_boca_id` = esta boca |

El set de bocas cruzadas se deriva en `RackBoard` a partir de `puertos` (todas las
`cruzado_boca_id` no nulas), igual que hoy se deriva "ocupado" en `PortCell` — no se
guarda un booleano de estado en la boca.

## Componentes

Nuevos, en `app/dashboard/proyectos/[id]/rack/components/`:

- **`PatchPanelGrid.tsx`** — espejo de `SwitchPortGrid.tsx`: grilla 24/48 bocas en
  columnas pareadas, pero con acento visual distinto (ícono `PanelsTopLeft`, franja
  ámbar/slate y badge "PASIVO") para que no se confunda con un switch, más un botón
  "Autogenerar bocas".
- **`BocaCell.tsx`** — espejo de `PortCell.tsx` con la paleta de 3 estados de arriba.
- **`BocaModal.tsx`** — espejo simplificado de `PortModal.tsx`: Dispositivo (Receta
  Maestra) + Etiqueta libre + Notas. Sin rol/PoE/VLAN.
- **`AutogenerarBocasModal.tsx`** — prefijo + rango (desde/hasta, default 1..N),
  preview de las etiquetas resultantes, inserta solo las bocas que no existen aún
  (no pisa bocas ya configuradas).

Modificados:

- **`RackBoard.tsx`** — nueva sección "Patch Panels" (antes de "Switches", porque en
  terreno se documenta primero lo pasivo), botón secundario "+ Agregar Patch Panel",
  estado de bocas/paneles, cálculo de `bocasCruzadas`, 2 entradas nuevas en la
  leyenda.
- **`PortModal.tsx`** — toggle "Conexión directa" / "Cruzada a Patch Panel". En modo
  cruzada se reemplaza el `<select>` de Receta Maestra por selects de Panel → Boca,
  con vista previa de solo-lectura del dispositivo heredado.
- **`actions.ts`** — nuevos tipos (`RackPatchPanel`, `RackBoca`), `cruzado_boca_id`
  en `RackPuerto`, `getRackData` trae paneles/bocas, nuevas server actions
  (`crearPatchPanelAction`, `eliminarPatchPanelAction`, `autogenerarBocasAction`,
  `asignarBocaAction`, `liberarBocaAction`), y `asignarPuertoAction` acepta
  `cruzadoBocaId`.

### `actions.ts` — adiciones

```ts
// ── Tipos nuevos ────────────────────────────────────────────────────────────
export interface RackPatchPanel {
    id: string;
    proyecto_id: string;
    nombre: string;
    num_bocas: number;
    orden: number;
    created_at: string;
}

export interface RackBoca {
    id: string;
    patch_panel_id: string;
    numero_boca: number;
    proyecto_equipamiento_id: string | null;
    etiqueta_libre: string | null;
    notas: string | null;
}

// RackPuerto gana un campo:
//   cruzado_boca_id: string | null;

const BOCAS_VALIDAS = [24, 48];

// ── Lectura (extiende getRackData) ──────────────────────────────────────────
// select de proyecto_puertos agrega ", cruzado_boca_id"
// + luego del bloque de switches/puertos:
const { data: patchPanels } = await db
    .from('proyecto_patch_panels')
    .select('id, proyecto_id, nombre, num_bocas, orden, created_at')
    .eq('proyecto_id', proyectoId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });

const panelIds = (patchPanels ?? []).map(p => p.id);
let bocas: RackBoca[] = [];
if (panelIds.length > 0) {
    const { data: b } = await db
        .from('proyecto_bocas')
        .select('id, patch_panel_id, numero_boca, proyecto_equipamiento_id, etiqueta_libre, notas')
        .in('patch_panel_id', panelIds);
    bocas = (b ?? []) as RackBoca[];
}
// return incluye: patchPanels: (patchPanels ?? []) as RackPatchPanel[], bocas

// ── CRUD de patch panels (mismo patrón que crearSwitchAction/eliminarSwitchAction) ──
export async function crearPatchPanelAction(proyectoId: string, nombre: string, numBocas: number) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!proyectoId) return { error: 'Proyecto no identificado.' };
    if (!BOCAS_VALIDAS.includes(numBocas)) return { error: 'El conteo de bocas debe ser 24 o 48.' };

    const db = createAdminClient();
    const { count } = await db
        .from('proyecto_patch_panels')
        .select('*', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId);

    const { error } = await db.from('proyecto_patch_panels').insert({
        proyecto_id: proyectoId,
        nombre: nombre?.trim() || 'Patch Panel',
        num_bocas: numBocas,
        orden: count ?? 0,
    });
    if (error) return { error: error.message || 'No se pudo crear el patch panel.' };
    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function eliminarPatchPanelAction(patchPanelId: string, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!patchPanelId) return { error: 'Patch panel no identificado.' };

    const db = createAdminClient();
    const { error } = await db.from('proyecto_patch_panels').delete().eq('id', patchPanelId);
    if (error) {
        // FK RESTRICT desde proyecto_puertos.cruzado_boca_id si hay bocas cruzadas.
        if (error.message.includes('violates foreign key constraint')) {
            return { error: 'Hay bocas de este panel cruzadas a un switch. Libera esas cruzadas antes de eliminar el panel.' };
        }
        return { error: error.message || 'No se pudo eliminar el patch panel.' };
    }
    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Autogenerar bocas ────────────────────────────────────────────────────────
export async function autogenerarBocasAction(
    proyectoId: string,
    patchPanelId: string,
    prefijo: string,
    desde: number,
    hasta: number,
) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!patchPanelId) return { error: 'Patch panel no identificado.' };
    if (desde < 1 || hasta < desde) return { error: 'Rango de bocas inválido.' };

    const db = createAdminClient();
    const { data: panel } = await db
        .from('proyecto_patch_panels').select('num_bocas').eq('id', patchPanelId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!panel) return { error: 'El patch panel no pertenece a este proyecto.' };
    if (hasta > panel.num_bocas) return { error: `El rango no puede superar ${panel.num_bocas} bocas.` };

    const prefijoLimpio = prefijo?.trim();
    const filas = [];
    for (let n = desde; n <= hasta; n++) {
        filas.push({
            patch_panel_id: patchPanelId,
            numero_boca: n,
            etiqueta_libre: prefijoLimpio ? `${prefijoLimpio} ${n}` : null,
        });
    }

    // No pisa bocas ya configuradas: solo inserta las que faltan.
    const { error } = await db
        .from('proyecto_bocas')
        .upsert(filas, { onConflict: 'patch_panel_id,numero_boca', ignoreDuplicates: true });

    if (error) return { error: error.message || 'No se pudieron autogenerar las bocas.' };
    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Asignación de bocas ──────────────────────────────────────────────────────
export interface AsignarBocaInput {
    proyectoId: string;
    patchPanelId: string;
    numeroBoca: number;
    proyectoEquipamientoId?: string | null;
    etiquetaLibre?: string | null;
    notas?: string | null;
}

export async function asignarBocaAction(input: AsignarBocaInput) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const { proyectoId, patchPanelId, numeroBoca } = input;
    if (!patchPanelId || !numeroBoca) return { error: 'Boca no identificada.' };

    const db = createAdminClient();
    const { data: panel } = await db
        .from('proyecto_patch_panels').select('id').eq('id', patchPanelId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!panel) return { error: 'El patch panel no pertenece a este proyecto.' };

    const equipamientoId = input.proyectoEquipamientoId?.trim() || null;
    if (equipamientoId) {
        const { data: eq } = await db
            .from('proyecto_equipamiento').select('id').eq('id', equipamientoId).eq('proyecto_id', proyectoId).maybeSingle();
        if (!eq) return { error: 'El equipo seleccionado no pertenece a la Receta de este proyecto.' };
    }

    const { error } = await db
        .from('proyecto_bocas')
        .upsert(
            {
                patch_panel_id: patchPanelId,
                numero_boca: numeroBoca,
                proyecto_equipamiento_id: equipamientoId,
                etiqueta_libre: input.etiquetaLibre?.trim() || null,
                notas: input.notas?.trim() || null,
                actualizado_por: guard.user.id,
            },
            { onConflict: 'patch_panel_id,numero_boca' },
        );

    if (error) return { error: error.message || 'No se pudo guardar la boca.' };
    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function liberarBocaAction(patchPanelId: string, numeroBoca: number, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!patchPanelId || !numeroBoca) return { error: 'Boca no identificada.' };

    const db = createAdminClient();
    const { data: boca } = await db
        .from('proyecto_bocas').select('id').eq('patch_panel_id', patchPanelId).eq('numero_boca', numeroBoca).maybeSingle();
    if (boca) {
        const { data: cruzada } = await db
            .from('proyecto_puertos').select('id').eq('cruzado_boca_id', boca.id).maybeSingle();
        if (cruzada) return { error: 'Esta boca está cruzada a un switch. Libera la cruzada desde el puerto del switch primero.' };
    }

    const { error } = await db
        .from('proyecto_bocas').delete().eq('patch_panel_id', patchPanelId).eq('numero_boca', numeroBoca);
    if (error) return { error: error.message || 'No se pudo liberar la boca.' };
    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── asignarPuertoAction: agrega soporte de cruzada ──────────────────────────
export interface AsignarPuertoInput {
    proyectoId: string;
    switchId: string;
    numeroPuerto: number;
    rol: 'acceso' | 'uplink';
    esPoe: boolean;
    proyectoEquipamientoId?: string | null;
    cruzadoBocaId?: string | null;   // ← nuevo
    etiquetaLibre?: string | null;
    notas?: string | null;
    vlan?: number | null;
}

// dentro de asignarPuertoAction, antes del upsert:
const cruzadoBocaId = input.cruzadoBocaId?.trim() || null;
// Mutuamente excluyente con dispositivo directo (defensa además del CHECK de BD).
const equipamientoId = cruzadoBocaId ? null : (input.proyectoEquipamientoId?.trim() || null);

if (cruzadoBocaId) {
    const { data: boca } = await db
        .from('proyecto_bocas')
        .select('id, patch_panel_id, proyecto_patch_panels!inner(proyecto_id)')
        .eq('id', cruzadoBocaId)
        .maybeSingle();
    if (!boca || (boca as any).proyecto_patch_panels.proyecto_id !== proyectoId) {
        return { error: 'La boca seleccionada no pertenece a este proyecto.' };
    }
    const { data: yaCruzada } = await db
        .from('proyecto_puertos').select('id').eq('cruzado_boca_id', cruzadoBocaId).maybeSingle();
    if (yaCruzada && yaCruzada.id !== puerto?.id) {  // puerto existente, si se está editando
        return { error: 'Esa boca ya está cruzada a otro puerto de switch.' };
    }
}

// … y en el objeto del upsert: agregar `cruzado_boca_id: cruzadoBocaId,`
```

*(El chequeo de `yaCruzada.id !== puerto?.id` requiere buscar primero la fila
existente del puerto por `switch_id + numero_puerto` antes del upsert, igual que ya
se hace la verificación de pertenencia del switch — se resuelve con un `select`
adicional al puerto actual antes del bloque de cruzada.)*

### `PatchPanelGrid.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2, PanelsTopLeft, ListPlus } from 'lucide-react';
import type { RackPatchPanel, RackBoca } from '../actions';
import { BocaCell } from './BocaCell';

export function PatchPanelGrid({
    panel,
    bocas,
    bocasCruzadas,
    canEdit,
    onDelete,
    onBocaClick,
    onAutogenerar,
    equipamientoNombres,
}: {
    panel: RackPatchPanel;
    bocas: RackBoca[];
    bocasCruzadas: Set<string>;
    canEdit: boolean;
    onDelete: (patchPanelId: string) => Promise<void>;
    onBocaClick?: (numero: number, boca?: RackBoca) => void;
    onAutogenerar?: () => void;
    equipamientoNombres?: Map<string, string>;
}) {
    const [isPending, startTransition] = useTransition();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const porNumero = new Map<number, RackBoca>();
    bocas.forEach(b => porNumero.set(b.numero_boca, b));

    const columnas = Math.ceil(panel.num_bocas / 2);
    const rematadas = bocas.length;
    const cruzadas = bocas.filter(b => bocasCruzadas.has(b.id)).length;

    return (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
            {/* Header del panel */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                        <PanelsTopLeft className="w-4 h-4 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-slate-800">{panel.nombre}</p>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">Pasivo</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {panel.num_bocas} bocas · {rematadas} rematadas · {cruzadas} cruzadas
                        </p>
                    </div>
                </div>
                {canEdit && (
                    <div className="flex items-center gap-1.5">
                        {onAutogenerar && (
                            <button
                                onClick={onAutogenerar}
                                title="Autogenerar bocas"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                                <ListPlus className="w-3.5 h-3.5" /> Autogenerar
                            </button>
                        )}
                        {confirmDelete ? (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => startTransition(async () => { await onDelete(panel.id); setConfirmDelete(false); })}
                                    disabled={isPending}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                </button>
                                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                title="Eliminar patch panel"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Grilla de bocas */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {Array.from({ length: columnas }, (_, c) => {
                    const top = 2 * c + 1;
                    const bottom = 2 * c + 2;
                    const cell = (numero: number) => {
                        const b = porNumero.get(numero);
                        const nombre = b?.proyecto_equipamiento_id
                            ? equipamientoNombres?.get(b.proyecto_equipamiento_id)
                            : undefined;
                        return (
                            <BocaCell
                                numero={numero}
                                boca={b}
                                cruzada={!!b && bocasCruzadas.has(b.id)}
                                equipNombre={nombre}
                                onClick={onBocaClick ? () => onBocaClick(numero, b) : undefined}
                            />
                        );
                    };
                    return (
                        <div key={c} className="flex flex-col gap-1 shrink-0">
                            {cell(top)}
                            {bottom <= panel.num_bocas && cell(bottom)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

*Nota: se reemplazó `window.confirm(...)` (usado hoy en `SwitchPortGrid.tsx`) por un
confirm inline de dos botones, siguiendo la regla del proyecto de no usar diálogos
nativos.*

### `BocaCell.tsx`

```tsx
'use client';

import type { RackBoca } from '../actions';

function colorClasses(b?: RackBoca, cruzada?: boolean): string {
    if (!b) return 'bg-slate-100 text-slate-400 border-slate-200';           // sin rematar
    if (cruzada) return 'bg-violet-500 text-white border-violet-600';        // cruzada
    return 'bg-amber-100 text-amber-700 border-amber-300';                   // pendiente de cruzada
}

function tooltip(numero: number, b?: RackBoca, cruzada?: boolean, equipNombre?: string): string {
    if (!b) return `Boca ${numero} · Sin rematar`;
    const partes = [`Boca ${numero}`, cruzada ? 'Cruzada' : 'Pendiente de cruzada'];
    if (b.etiqueta_libre) partes.push(b.etiqueta_libre);
    else if (equipNombre) partes.push(equipNombre);
    return partes.join(' · ');
}

export function BocaCell({
    numero,
    boca,
    cruzada,
    equipNombre,
    onClick,
}: {
    numero: number;
    boca?: RackBoca;
    cruzada?: boolean;
    equipNombre?: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            title={tooltip(numero, boca, cruzada, equipNombre)}
            className={`w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-black select-none ${colorClasses(boca, cruzada)} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all' : 'cursor-default'}`}
        >
            {numero}
        </button>
    );
}
```

### `BocaModal.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Trash2 } from 'lucide-react';
import type { RackBoca, RackRecetaItem } from '../actions';
import { asignarBocaAction, liberarBocaAction } from '../actions';

export function BocaModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numero,
    boca,
    receta,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numero: number;
    boca?: RackBoca;
    receta: RackRecetaItem[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [equipId, setEquipId] = useState(boca?.proyecto_equipamiento_id ?? '');
    const [etiqueta, setEtiqueta] = useState(boca?.etiqueta_libre ?? '');
    const [notas, setNotas] = useState(boca?.notas ?? '');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const guardar = () => {
        setError('');
        startTransition(async () => {
            const res = await asignarBocaAction({
                proyectoId, patchPanelId, numeroBoca: numero,
                proyectoEquipamientoId: equipId || null,
                etiquetaLibre: etiqueta || null,
                notas: notas || null,
            });
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    const liberar = () => {
        setError('');
        startTransition(async () => {
            const res = await liberarBocaAction(patchPanelId, numero, proyectoId);
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Boca {numero}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{panelNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && (
                        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo final (Receta Maestra)</label>
                        <select value={equipId} onChange={e => setEquipId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent">
                            <option value="">— Ninguno —</option>
                            {receta.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.modelo} · {r.familia}{r.es_serializado ? ' (serializado)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Etiqueta / Ubicación</label>
                        <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
                            placeholder="Ej: Cámara pasillo, Jack sala 204…"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Notas (opcional)</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                        {boca ? (
                            <button onClick={liberar} disabled={isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" /> Liberar
                            </button>
                        ) : <span />}
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} disabled={isPending}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={guardar} disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

### `AutogenerarBocasModal.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ListPlus } from 'lucide-react';
import { autogenerarBocasAction } from '../actions';

export function AutogenerarBocasModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numBocas,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numBocas: number;
    onClose: () => void;
}) {
    const router = useRouter();
    const [prefijo, setPrefijo] = useState('');
    const [desde, setDesde] = useState(1);
    const [hasta, setHasta] = useState(numBocas);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const rango = Math.max(0, hasta - desde + 1);
    const previewLabel = (n: number) => prefijo.trim() ? `${prefijo.trim()} ${n}` : `Boca ${n} (sin etiqueta)`;

    const generar = () => {
        setError('');
        if (desde < 1 || hasta < desde || hasta > numBocas) { setError(`El rango debe estar entre 1 y ${numBocas}.`); return; }
        startTransition(async () => {
            const res = await autogenerarBocasAction(proyectoId, patchPanelId, prefijo, desde, hasta);
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <ListPlus className="w-4 h-4 text-amber-500" /> Autogenerar bocas
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">{panelNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && (
                        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Prefijo de etiqueta (opcional)</label>
                        <input value={prefijo} onChange={e => setPrefijo(e.target.value)}
                            placeholder="Ej: Jack piso 1 -"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Desde</label>
                            <input type="number" min={1} max={numBocas} value={desde}
                                onChange={e => setDesde(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Hasta</label>
                            <input type="number" min={1} max={numBocas} value={hasta}
                                onChange={e => setHasta(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    {rango > 0 && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            Se crearán <b>{rango}</b> bocas: <span className="font-mono">"{previewLabel(desde)}"</span> … <span className="font-mono">"{previewLabel(hasta)}"</span>.
                            Las bocas ya configuradas no se modifican.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={isPending}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={generar} disabled={isPending || rango === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

### `RackBoard.tsx` — cambios clave

Se agregan imports, estado y una sección "Patch Panels" antes de "Switches". El
botón "+ Agregar Patch Panel" se ubica junto a "+ Agregar switch" como botón
secundario:

```tsx
import { PatchPanelGrid } from './PatchPanelGrid';
import { BocaModal } from './BocaModal';
import { AutogenerarBocasModal } from './AutogenerarBocasModal';
import { crearPatchPanelAction, eliminarPatchPanelAction } from '../actions';
import type { RackPatchPanel, RackBoca } from '../actions';
import { PanelsTopLeft } from 'lucide-react';

const OPCIONES_BOCAS = [24, 48];

// … dentro de RackBoard, junto a switches/puertos:
const [patchPanels, setPatchPanels] = useState(initialPatchPanels);
const [bocas, setBocas] = useState(initialBocas);
useEffect(() => { setPatchPanels(initialPatchPanels); }, [initialPatchPanels]);
useEffect(() => { setBocas(initialBocas); }, [initialBocas]);

const bocasCruzadas = useMemo(
    () => new Set(puertos.filter(p => p.cruzado_boca_id).map(p => p.cruzado_boca_id as string)),
    [puertos],
);
const bocasDe = (patchPanelId: string) => bocas.filter(b => b.patch_panel_id === patchPanelId);

const [bocaModal, setBocaModal] = useState<{ panel: RackPatchPanel; numero: number; boca?: RackBoca } | null>(null);
const [autogenModal, setAutogenModal] = useState<RackPatchPanel | null>(null);
const [showAddPanel, setShowAddPanel] = useState(false);
const [nombrePanel, setNombrePanel] = useState('');
const [numBocas, setNumBocas] = useState(24);

const handleCrearPanel = () => {
    setError('');
    startTransition(async () => {
        const res = await crearPatchPanelAction(proyectoId, nombrePanel, numBocas);
        if (res.error) { setError(res.error); return; }
        setNombrePanel(''); setNumBocas(24); setShowAddPanel(false);
        router.refresh();
    });
};
const handleEliminarPanel = async (patchPanelId: string) => {
    const res = await eliminarPatchPanelAction(patchPanelId, proyectoId);
    if (res.error) { setError(res.error); return; }
    router.refresh();
};
```

Botón secundario en el header (junto al de "+ Agregar switch"):

```tsx
<button
    onClick={() => setShowAddPanel(true)}
    className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-bold rounded-xl transition-all"
>
    <PanelsTopLeft className="w-4 h-4" /> Agregar Patch Panel
</button>
```

Sección de render (antes de la sección "Switches" existente):

```tsx
{patchPanels.length > 0 && (
    <div className="space-y-4 mb-4">
        {patchPanels.map(panel => (
            <PatchPanelGrid
                key={panel.id}
                panel={panel}
                bocas={bocasDe(panel.id)}
                bocasCruzadas={bocasCruzadas}
                canEdit={canEdit}
                onDelete={handleEliminarPanel}
                equipamientoNombres={equipamientoNombres}
                onBocaClick={canEdit ? (numero, boca) => setBocaModal({ panel, numero, boca }) : undefined}
                onAutogenerar={canEdit ? () => setAutogenModal(panel) : undefined}
            />
        ))}
    </div>
)}

{bocaModal && (
    <BocaModal
        proyectoId={proyectoId}
        patchPanelId={bocaModal.panel.id}
        panelNombre={bocaModal.panel.nombre}
        numero={bocaModal.numero}
        boca={bocaModal.boca}
        receta={receta}
        onClose={() => setBocaModal(null)}
    />
)}
{autogenModal && (
    <AutogenerarBocasModal
        proyectoId={proyectoId}
        patchPanelId={autogenModal.id}
        panelNombre={autogenModal.nombre}
        numBocas={autogenModal.num_bocas}
        onClose={() => setAutogenModal(null)}
    />
)}
```

`PortModal` recibe tres props nuevas: `patchPanels`, `bocas` (todas las bocas del
proyecto) y `bocasCruzadas` (el `Set` calculado en `RackBoard`, para filtrar bocas ya
cruzadas a otro puerto). Leyenda extendida:

```tsx
<span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Boca pendiente de cruzada</span>
<span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500" /> Boca cruzada</span>
```

### `PortModal.tsx` — cambios clave

Se agrega un toggle de modo y, en modo cruzada, selects encadenados Panel → Boca
con vista previa de solo lectura del dispositivo heredado:

```tsx
// Props nuevas: patchPanels: RackPatchPanel[]; bocas: RackBoca[]; bocasCruzadas: Set<string>;
// equipamientoNombres: Map<string, string> (ya calculado en RackBoard)

const [modo, setModo] = useState<'directo' | 'cruzada'>(puerto?.cruzado_boca_id ? 'cruzada' : 'directo');
const bocaActual = bocas.find(b => b.id === puerto?.cruzado_boca_id);
const [panelId, setPanelId] = useState(bocaActual?.patch_panel_id ?? '');
const [bocaId, setBocaId] = useState(puerto?.cruzado_boca_id ?? '');

const bocasDelPanel = bocas.filter(b =>
    b.patch_panel_id === panelId &&
    (!bocasCruzadas.has(b.id) || b.id === puerto?.cruzado_boca_id), // oculta ya-cruzadas de OTRO puerto
);
const bocaSeleccionada = bocasDelPanel.find(b => b.id === bocaId);
const nombreHeredado = bocaSeleccionada?.proyecto_equipamiento_id
    ? equipamientoNombres.get(bocaSeleccionada.proyecto_equipamiento_id)
    : undefined;

// guardar():
const res = await asignarPuertoAction({
    proyectoId, switchId, numeroPuerto: numero, rol, esPoe,
    proyectoEquipamientoId: modo === 'directo' ? (equipId || null) : null,
    cruzadoBocaId: modo === 'cruzada' ? (bocaId || null) : null,
    etiquetaLibre: etiqueta || null,
    notas: notas || null,
    vlan: vlanNum,
});
```

Reemplazo del bloque "Dispositivo (Receta Maestra) + VLAN" por el toggle y los dos
modos:

```tsx
<div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Origen del dispositivo</label>
    <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" onClick={() => setModo('directo')}
            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'directo' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            Conexión directa
        </button>
        <button type="button" onClick={() => setModo('cruzada')}
            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'cruzada' ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            Cruzada a Patch Panel
        </button>
    </div>

    {modo === 'directo' ? (
        <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo (Receta Maestra)</label>
                <select value={equipId} onChange={e => handleEquipChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                    <option value="">— Ninguno —</option>
                    {receta.map(r => (
                        <option key={r.id} value={r.id}>{r.modelo} · {r.familia}{r.es_serializado ? ' (serializado)' : ''}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">VLAN</label>
                <input type="number" min={1} max={4094} value={vlan} onChange={e => setVlan(e.target.value)}
                    placeholder="ej: 410"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
            </div>
        </div>
    ) : (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Patch Panel</label>
                    <select value={panelId} onChange={e => { setPanelId(e.target.value); setBocaId(''); }}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent">
                        <option value="">— Seleccionar —</option>
                        {patchPanels.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Boca de origen</label>
                    <select value={bocaId} onChange={e => setBocaId(e.target.value)} disabled={!panelId}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50">
                        <option value="">— Seleccionar —</option>
                        {bocasDelPanel.map(b => <option key={b.id} value={b.id}>Boca {b.numero_boca}{b.etiqueta_libre ? ` · ${b.etiqueta_libre}` : ''}</option>)}
                    </select>
                </div>
            </div>
            {bocaSeleccionada && (
                <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                    Hereda: <b>{bocaSeleccionada.etiqueta_libre || nombreHeredado || 'Sin documentar aún'}</b>
                </div>
            )}
            <div className="w-1/3">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">VLAN</label>
                <input type="number" min={1} max={4094} value={vlan} onChange={e => setVlan(e.target.value)}
                    placeholder="ej: 410"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
            </div>
        </div>
    )}
</div>
```

## Migración de datos existente

Ninguna. `sql/rack_mapper_patch_panels.sql` es aditivo: crea tablas nuevas y agrega
una columna nullable (`cruzado_boca_id`) a `proyecto_puertos`. No toca filas
existentes; todos los puertos de switch actuales siguen siendo "conexión directa".

## Fuera de alcance (explícito)

- Cruzadas panel-a-panel.
- Cruzadas 1-a-muchos.
- Extender `rack_templates` para incluir patch panels.
- Historial/auditoría de cambios de cruzada (se puede agregar después reusando
  `actualizado_por`/`updated_at` que ya existen).

## Plan de archivos

Nuevos:
- `sql/rack_mapper_patch_panels.sql`
- `app/dashboard/proyectos/[id]/rack/components/PatchPanelGrid.tsx`
- `app/dashboard/proyectos/[id]/rack/components/BocaCell.tsx`
- `app/dashboard/proyectos/[id]/rack/components/BocaModal.tsx`
- `app/dashboard/proyectos/[id]/rack/components/AutogenerarBocasModal.tsx`

Modificados:
- `app/dashboard/proyectos/[id]/rack/actions.ts`
- `app/dashboard/proyectos/[id]/rack/components/RackBoard.tsx`
- `app/dashboard/proyectos/[id]/rack/components/PortModal.tsx`
- `app/dashboard/proyectos/[id]/page.tsx` (pasar `patchPanels`/`bocas` de
  `getRackData` a `RackBoard`)
