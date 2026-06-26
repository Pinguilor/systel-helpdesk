-- Agrega bodega_destino_id a solicitudes_devoluciones para registrar la bodega
-- a la que se ingresó el ítem al aprobar la devolución.
-- Necesario porque para ítems no-serializados el inventario.bodega_id del row
-- de la mochila nunca cambia (solo disminuye la cantidad), así que no podemos
-- leer la bodega destino desde la fila de inventario.

ALTER TABLE solicitudes_devoluciones
    ADD COLUMN IF NOT EXISTS bodega_destino_id UUID REFERENCES bodegas(id);
