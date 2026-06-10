-- Crear tabla de plantillas de recetas BOM (Kitting / Standard BOM)
CREATE TABLE public.proyecto_plantillas_bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.proyecto_plantillas_bom ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para proyecto_plantillas_bom
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.proyecto_plantillas_bom 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserción a usuarios autenticados" 
ON public.proyecto_plantillas_bom 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir actualización a usuarios autenticados" 
ON public.proyecto_plantillas_bom 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir eliminación a usuarios autenticados" 
ON public.proyecto_plantillas_bom 
FOR DELETE 
TO authenticated 
USING (true);
