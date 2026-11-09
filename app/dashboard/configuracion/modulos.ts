import { Users, Building2, Warehouse, Backpack, LayoutGrid, PackageCheck, FolderKanban, ScanLine, type LucideIcon } from 'lucide-react';

export type ModuloConfig = {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    grupo: string;
    rolesAllow: string[];
    keywords?: string[];
};

export const RESUMEN_HREF = '/dashboard/configuracion';

export const RESUMEN: Pick<ModuloConfig, 'href' | 'title' | 'icon'> = {
    href: RESUMEN_HREF,
    title: 'Resumen',
    icon: LayoutGrid,
};

// Para agregar un módulo nuevo basta con sumar una entrada aquí.
export const MODULOS: ModuloConfig[] = [
    {
        href: '/dashboard/configuracion/usuarios',
        title: 'Gestión de Personal',
        description: 'Cuentas, roles y permisos del equipo',
        icon: Users,
        grupo: 'Organización',
        rolesAllow: ['admin'],
        keywords: ['usuarios', 'roles', 'permisos', 'cuentas'],
    },
    {
        href: '/dashboard/configuracion/clientes',
        title: 'Gestión de Clientes',
        description: 'Empresas, catálogos y locales por cliente',
        icon: Building2,
        grupo: 'Organización',
        rolesAllow: ['admin'],
        keywords: ['empresas', 'tenant', 'catalogo'],
    },
    {
        href: '/dashboard/configuracion/bodegas',
        title: 'Gestión de Bodegas',
        description: 'Locaciones de almacenamiento y categorías',
        icon: Warehouse,
        grupo: 'Inventario',
        rolesAllow: ['admin'],
        keywords: ['almacen', 'locaciones', 'stock'],
    },
    {
        href: '/dashboard/configuracion/mochilas',
        title: 'Auditoría de Mochilas',
        description: 'Stock que cada técnico lleva en campo',
        icon: Backpack,
        grupo: 'Inventario',
        rolesAllow: ['admin', 'coordinador'],
        keywords: ['tecnicos', 'campo', 'movimientos'],
    },
];

// Accesos rápidos: las mismas secciones del menú de pestañas del dashboard.
export type AccesoRapido = {
    href: string;
    title: string;
    icon: LucideIcon;
    rolesAllow: string[];
};

export const ACCESOS_RAPIDOS: AccesoRapido[] = [
    { href: '/dashboard/admin', title: 'Vista General', icon: LayoutGrid, rolesAllow: ['admin', 'coordinador'] },
    { href: '/dashboard/admin/bodegas', title: 'Bodegas (Inventario)', icon: Warehouse, rolesAllow: ['admin'] },
    { href: '/dashboard/admin/bodegas/solicitudes', title: 'Solicitudes', icon: PackageCheck, rolesAllow: ['admin'] },
    { href: '/dashboard/proyectos', title: 'Proyectos', icon: FolderKanban, rolesAllow: ['admin', 'coordinador'] },
    { href: '/dashboard/trazabilidad-materiales', title: 'Trazabilidad', icon: ScanLine, rolesAllow: ['admin'] },
];

export function accesosRapidosPorRol(rol: string) {
    return ACCESOS_RAPIDOS.filter(a => a.rolesAllow.includes(rol));
}

export function modulosPorRol(rol: string) {
    return MODULOS.filter(m => m.rolesAllow.includes(rol));
}

export function agruparModulos(modulos: ModuloConfig[]) {
    const map = new Map<string, ModuloConfig[]>();
    for (const m of modulos) {
        if (!map.has(m.grupo)) map.set(m.grupo, []);
        map.get(m.grupo)!.push(m);
    }
    return Array.from(map.entries());
}
