// El RPC prefija sus errores estructurados con un código (ver sql/crear_proyecto_masivo.sql
// y sql/proyecto_masivo_gestion.sql). Aquí se traducen a mensajes para el usuario.
export function traducirErrorRpc(message: string): string {
    const obsoletos = message.match(/RECETA_OBSOLETA: (.+)/);
    if (obsoletos) return `La receta seleccionada tiene equipos que ya no existen en el catálogo: ${obsoletos[1]}. Edítala en el gestor de recetas (quita o vuelve a agregar esos equipos) e inténtalo de nuevo.`;
    const yaEnMasivo = message.match(/LOCALES_YA_EN_MASIVO: (.+)/);
    if (yaEnMasivo) return `Estos locales ya forman parte de este Rollout: ${yaEnMasivo[1]}.`;
    if (message.includes('MASIVO_DUPLICADO')) return 'Ya se creó un Rollout con este nombre hace instantes. Revisa el listado de proyectos antes de reintentar.';
    if (message.includes('LOCALES_INEXISTENTES')) return 'Alguno de los locales seleccionados ya no existe. Recarga la página.';
    return message;
}
