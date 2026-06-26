# Mapa Interactivo de Switch/Rack para Proyectos — Diseño Arquitectónico

## Contexto

Los técnicos necesitan documentar visualmente qué dispositivo está conectado a qué
puerto del/los switch(es) en el rack de un local durante una instalación. Hoy esa
información no existe de forma estructurada (a lo sumo en fotos o notas sueltas).

El módulo vive dentro de la vista de Proyecto (`/dashboard/proyectos/[id]`), como una
pestaña nueva junto a "Hardware y Logística", reutilizando el patrón de pestañas ya
existente (`HardwareLogisticaTabs`). Los dispositivos asignables provienen de la
**Receta Maestra** (`proyecto_equipamiento`) ya aprobada del proyecto.

## Decisiones (confirmadas con el usuario)

1. **Varios switches por proyecto.** Un proyecto modela un rack con N switches; cada
   switch tiene su propio conteo de puertos (8 / 24 / 48). El esquema lo soporta desde
   el día 1.
2. **Plantillas: biblioteca global + guardar desde proyecto.** Existen plantillas
   reutilizables a nivel sistema (ej. "Topología Estándar Restaurante") que
   admin/coordinador curan, y además se puede "Guardar layout actual como plantilla"
   desde cualquier proyecto.
3. **Asignación a puerto: equipo de la Receta + etiqueta libre.** Un puerto puede
   apuntar a un `proyecto_equipamiento` aprobado (y, si es serializado, a un serial
   específico vía `inventario_id`), o llevar una etiqueta de texto libre (ej. "Uplink
   ISP", "Cámara pasillo") para lo que no está en la Receta.

## Alcance

**Incluye:** modelo de datos (switches, puertos, plantillas), grilla visual interactiva
por switch, modal de asignación de puerto, CRUD de switches, aplicar plantilla global y
guardar layout como plantilla, RLS e integridad referencial.

**Fuera de alcance (fase futura):** diagramas de cableado punto-a-punto entre switches,
generación de etiquetas físicas/PDF, detección automática vía SNMP/LLDP, y versionado
histórico de cambios de puerto (audit trail más allá de `actualizado_por`/`updated_at`).

## 1. Modelo de datos

### Decisión: relacional para datos vivos, JSONB para plantillas

Se evaluaron tres opciones:

| Enfoque | Pros | Contras |
|---|---|---|
| **JSONB puro** (un blob por switch/proyecto) | Simple de escribir; flexible | Pierde integridad referencial con `proyecto_equipamiento`; difícil consultar "¿dónde está el equipo X?"; no hay FK que limpie al borrar receta |
| **Relacional puro** | Integridad (FK + cascadas), consultas naturales, audit por fila | Una tabla extra para plantillas que son intrínsecamente variables |
| **Híbrido (recomendado)** | Relacional para switches/puertos (donde la integridad importa) + JSONB para el *payload* de plantillas (que es schema-light y variable) | Dos paradigmas, pero cada uno donde rinde mejor |

**Recomendación: híbrido.** Los puertos se vinculan a `proyecto_equipamiento` por FK,
y dado que recién lidiamos con limpieza de datos huérfanos, la integridad referencial
(cascadas) es un requisito, no un lujo. Las plantillas, en cambio, son definiciones
portables y sin FKs a datos vivos → JSONB encaja.

### Tablas

```sql
-- Un switch dentro del rack del proyecto
CREATE TABLE proyecto_switches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL DEFAULT 'Switch',
  num_puertos  INTEGER NOT NULL CHECK (num_puertos IN (8, 24, 48)),
  orden        INTEGER NOT NULL DEFAULT 0,           -- orden visual en el rack
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un puerto CONFIGURADO/ASIGNADO. Modelo disperso: si no hay fila, el puerto está libre.
CREATE TABLE proyecto_puertos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_id     UUID NOT NULL REFERENCES proyecto_switches(id) ON DELETE CASCADE,
  numero_puerto INTEGER NOT NULL,                    -- 1..num_puertos
  -- atributos ortogonales del puerto (PoE y uplink no son excluyentes de "ocupado")
  rol           TEXT NOT NULL DEFAULT 'acceso' CHECK (rol IN ('acceso','uplink')),
  es_poe        BOOLEAN NOT NULL DEFAULT FALSE,
  -- asignación (todos opcionales): un puerto puede tener fila solo por sus atributos
  -- (ej. un uplink reservado o un puerto PoE marcado) sin equipo ni etiqueta todavía
  proyecto_equipamiento_id UUID REFERENCES proyecto_equipamiento(id) ON DELETE SET NULL,
  inventario_id            UUID REFERENCES inventario(id) ON DELETE SET NULL, -- serial específico
  etiqueta_libre           TEXT,
  notas         TEXT,
  actualizado_por UUID REFERENCES profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (switch_id, numero_puerto)
);

-- Biblioteca global de plantillas de layout (curadas por admin/coordinador)
CREATE TABLE rack_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  payload     JSONB NOT NULL,           -- ver "Forma del payload" abajo
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notas de modelado:**

- **Estado visual derivado, no almacenado.** El componente deriva el color/estado del
  puerto: `libre` (no hay fila), `ocupado` (hay asignación), más realces por `rol='uplink'`
  y `es_poe`. Evitamos un enum único que confunda conceptos ortogonales (un puerto puede
  ser PoE *y* estar ocupado *y* ser uplink).
- **`ON DELETE SET NULL` en `proyecto_equipamiento_id`/`inventario_id`:** si se borra un
  ítem de la Receta o de inventario, el puerto no se rompe — queda con su etiqueta/estado
  y simplemente pierde el vínculo. Aplica la lección de integridad de la limpieza de
  proyectos.
- **`ON DELETE CASCADE`** desde `proyectos` → `proyecto_switches` → `proyecto_puertos`:
  borrar un proyecto limpia su rack sin pasos manuales.

### Forma del payload de plantilla (JSONB)

Las plantillas son **agnósticas de dispositivos** (no fijan seriales): pre-pueblan lo
*conocido* (cuántos switches, qué puertos son uplink/PoE, etiquetas estándar).

```json
{
  "switches": [
    {
      "nombre": "Switch Principal",
      "num_puertos": 24,
      "puertos": [
        { "numero": 1,  "rol": "uplink", "es_poe": false, "etiqueta_libre": "Uplink ISP" },
        { "numero": 2,  "rol": "acceso", "es_poe": true,  "etiqueta_libre": "Cámara 1" },
        { "numero": 24, "rol": "uplink", "es_poe": false, "etiqueta_libre": "Backbone" }
      ]
    }
  ]
}
```

## 2. Componentes React

Estructura por responsabilidad única, siguiendo los patrones del proyecto (server
component que carga datos + client components para interacción; pestañas reutilizando el
patrón existente).

| Componente | Tipo | Responsabilidad |
|---|---|---|
| `RackMapperTab` | Server | Carga `getRackData(proyectoId)` (switches+puertos), la Receta y las plantillas; orquesta la vista. Se monta como pestaña junto a "Hardware y Logística". |
| `RackBoard` | Client | Contenedor del rack: lista de `SwitchPortGrid`, barra de acciones (agregar switch, aplicar plantilla, guardar como plantilla). Mantiene el estado reactivo. |
| `SwitchPortGrid` | Client | Renderiza **un** switch como grilla CSS (Tailwind): dos filas (impares arriba / pares abajo, como un switch real), puertos coloreados por estado derivado. Maneja el click de puerto. |
| `PortCell` | Client | Visual de un puerto individual: número, color por estado (libre/ocupado/poe/uplink), tooltip con dispositivo/etiqueta. |
| `PortModal` | Client | Se abre al click. Permite: (a) asignar equipo de la Receta (lista buscable de `proyecto_equipamiento`; si es serializado, selector de serial), (b) etiqueta libre, (c) flags PoE/uplink, (d) liberar el puerto. |
| `SwitchConfigBar` | Client | Agregar/renombrar/eliminar switch; elegir conteo de puertos (8/24/48). |
| `ApplyTemplateModal` | Client | Elegir plantilla de la biblioteca global, previsualizar, aplicar (con manejo de conflicto si ya hay switches). |
| `SaveAsTemplateModal` | Client | Nombre + descripción; serializa el layout actual del proyecto a `rack_templates`. |

**Estados visuales del puerto (derivados en `PortCell`):**
`libre` (gris), `ocupado` (índigo/emerald), `PoE` (realce ámbar/ícono rayo), `uplink`
(borde/realce azul). PoE y uplink se componen sobre ocupado/libre.

## 3. Flujo de datos y Server Actions

Ubicación: `app/dashboard/proyectos/[id]/rack/actions.ts`. Todas las mutaciones usan
`createAdminClient()` **después** de un chequeo de rol (admin/coordinador/técnico
participante), siguiendo el patrón establecido en el proyecto para evitar choques de RLS.
Tras cada mutación: `revalidatePath` y sincronización de estado en cliente (aplicando la
lección de reactividad: el estado local debe re-sincronizarse con los props frescos, no
sombrear la revalidación).

| Acción | Firma | Notas |
|---|---|---|
| `getRackData` | `(proyectoId) → { switches, puertos, receta, plantillas }` | Lectura para `RackMapperTab`. |
| `crearSwitchAction` | `(proyectoId, nombre, numPuertos)` | Inserta `proyecto_switches`. |
| `renombrarSwitchAction` / `eliminarSwitchAction` | `(switchId, ...)` | CRUD switch. |
| `asignarPuertoAction` | `(switchId, numeroPuerto, { proyectoEquipamientoId?, inventarioId?, etiquetaLibre?, rol, esPoe, notas })` | Upsert por `(switch_id, numero_puerto)`. Valida que el equipamiento pertenezca al proyecto. |
| `liberarPuertoAction` | `(switchId, numeroPuerto)` | Borra la fila del puerto (vuelve a "libre"). |
| `aplicarPlantillaAction` | `(proyectoId, templateId, modo)` | Lee `payload` y crea switches+puertos en transacción. `modo`: 'reemplazar' o 'agregar' (manejo de conflicto si ya hay rack). |
| `guardarComoPlantillaAction` | `(proyectoId, nombre, descripcion)` | Serializa el layout actual (sin seriales/dispositivos) → inserta en `rack_templates`. |

### Flujo: aplicar plantilla

1. Usuario abre `ApplyTemplateModal` → `getRackData` ya trae la lista de `rack_templates` activas.
2. Selecciona una → preview del payload (cuántos switches, puertos marcados).
3. Si el proyecto ya tiene switches, se pide elegir **reemplazar** (borra rack actual) o **agregar**.
4. `aplicarPlantillaAction` corre en transacción: por cada `switch` del payload inserta
   `proyecto_switches`; por cada `puerto` inserta `proyecto_puertos` con `rol/es_poe/etiqueta_libre`
   (sin vínculo a equipamiento — la plantilla es agnóstica de dispositivos).
5. `revalidatePath` → la grilla refleja el layout pre-poblado; el técnico solo asigna los
   dispositivos reales sobre los puertos ya etiquetados.

### Flujo: guardar como plantilla

1. `SaveAsTemplateModal` pide nombre/descripción.
2. `guardarComoPlantillaAction` lee los switches+puertos del proyecto y construye el
   `payload` JSONB **omitiendo** `proyecto_equipamiento_id`/`inventario_id` (solo
   estructura: switches, conteos, rol, PoE, etiquetas). Inserta en `rack_templates`.

## 4. Seguridad (RLS) e integridad

- Las tres tablas habilitan RLS con políticas para `admin`/`coordinador` (y lectura para
  técnicos participantes del proyecto), espejando las políticas de `proyectos`.
- Las mutaciones corren con service-role tras el chequeo de rol (patrón establecido), de
  modo que cualquier trigger o FK interno no choque con RLS.
- Cascadas y `SET NULL` (ver §1) garantizan que borrar proyectos, switches o ítems de la
  Receta deje el rack en estado consistente sin limpieza manual.

## 5. Plan de fases (para writing-plans)

1. **Esquema SQL** (3 tablas + RLS + índices) en `sql/rack_mapper.sql`.
2. **Server actions** de lectura/CRUD de switches y puertos.
3. **UI base:** `RackMapperTab` + `SwitchPortGrid` + `PortCell` (solo lectura/visual).
4. **Interacción:** `PortModal` (asignar/liberar, equipo de Receta + etiqueta libre).
5. **Config de switches:** agregar/renombrar/eliminar, conteo de puertos.
6. **Plantillas:** `rack_templates` + aplicar + guardar como plantilla.

Cada fase es entregable e independiente; el módulo es usable desde la fase 4 (un switch,
asignación manual) y la fase 6 agrega el ahorro de tiempo con plantillas.
