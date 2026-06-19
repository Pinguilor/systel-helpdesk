# Sub-bodegas: jerarquía padre/hijo en `bodegas`

## Contexto

Los usuarios están "ensuciando" el Catálogo Maestro (`catalogo_equipos`) creando
equipos falsos con sufijos por proyecto (ej. `NCR POS CX7 [ LIN ]`) y familias
inventadas (`LIN`), para poder separar visualmente el stock de un proyecto del
stock general. Es un anti-patrón: usan el "Qué" (catálogo) para resolver un
problema de "Dónde" (ubicación).

La solución real es modelar **bodegas de proyecto como sub-bodegas**: espacios
delimitados que viven físicamente dentro de una bodega principal (ej. la
sub-bodega "TAC" vive dentro de "Bodega SYSTEL [B.216]").

## Alcance de esta iteración

Incluye:
- Columna `bodega_padre_id` en `bodegas` + validación de integridad (1 nivel).
- Formulario "Nueva/Editar Bodega": selector opcional "Bodega Física Principal".
- Vista "Bodegas del Sistema": listado agrupado/anidado visualmente.

Fuera de alcance (fase futura):
- Mecanismo de traspaso de stock (genérico o serializado) entre una bodega
  física y sus sub-bodegas. Se diseñará una vez exista la jerarquía.

## Decisiones

1. **Un solo nivel de anidación.** Una bodega sin padre ("física") puede tener
   N sub-bodegas. Una sub-bodega no puede tener hijos propios. Cubre el caso
   real (Bodega física → sub-bodegas de proyecto) sin complejidad de árboles
   arbitrarios en la UI.
2. **Traspasos fuera de alcance ahora.** Esta iteración es solo modelo de
   datos + CRUD + listado jerárquico.
3. **Re-anidar bodegas existentes.** El selector de padre está disponible
   tanto en creación como en edición, para poder convertir bodegas "sucias"
   ya existentes en sub-bodegas de una bodega física.

## 1. Modelo de datos (SQL)

```sql
ALTER TABLE bodegas
  ADD COLUMN IF NOT EXISTS bodega_padre_id UUID REFERENCES bodegas(id) ON DELETE SET NULL;
```

Trigger `BEFORE INSERT OR UPDATE OF bodega_padre_id` que rechaza:
- auto-referencia (`bodega_padre_id = id`),
- elegir como padre una bodega que ya es sub-bodega (`bodega_padre_id IS NOT NULL`),
- convertir en sub-bodega una bodega que ya tiene hijos propios.

`ON DELETE SET NULL`: si se elimina la bodega física, sus sub-bodegas quedan
como bodegas de nivel superior (no se cascadea el borrado).

## 2. Server Actions

`app/dashboard/configuracion/bodegas/actions.ts`:
- `crearBodegaAction`: lee `bodega_padre_id` del FormData (string vacío → `null`),
  lo incluye en el `insert`.
- `editarBodegaAction`: idem, lo incluye en el `update`.

## 3. UI — Formulario "Nueva/Editar Bodega"

`GestionBodegasClient.tsx` → `BodegaFormModal`:
- Nuevo `<select name="bodega_padre_id">` "Bodega Física Principal (opcional)".
- Opciones: bodegas con `bodega_padre_id IS NULL`, excluyendo la propia bodega
  si se está editando.
- Si la bodega editada ya tiene sub-bodegas propias, el selector se muestra
  deshabilitado con texto explicativo (refleja la regla del trigger antes de
  que el usuario reciba el error de la base).
- No se necesita un fetch nuevo: `GestionBodegasClient` ya recibe la lista
  completa de bodegas y deriva las opciones de ahí.

## 4. UI — Vista "Bodegas del Sistema"

`page.tsx`: agregar `bodega_padre_id` al `select` de la query.

`GestionBodegasClient.tsx`: agrupar bodegas de nivel superior con sus
sub-bodegas inmediatamente debajo, indentadas (icono conector + estilo visual
distinto). La búsqueda sigue operando sobre nombre/tipo; si una sub-bodega
coincide pero su padre no, se muestra igualmente agrupada bajo el nombre real
de su padre (tomado de la lista completa sin filtrar).
