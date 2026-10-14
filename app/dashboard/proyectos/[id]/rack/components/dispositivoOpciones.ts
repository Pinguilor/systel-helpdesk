import type { RackDispositivoPlantilla } from '../actions';
import type { ComboOption } from './SearchableCombobox';

/**
 * Opciones del selector "Dispositivo" agrupadas por zona (zonas A→Z, "Sin zona" al final,
 * dispositivos A→Z dentro de cada zona). Solo activos, más `conservarId` aunque esté desactivado.
 */
export function opcionesDispositivos(
    dispositivos: RackDispositivoPlantilla[],
    conservarId?: string | null,
): ComboOption[] {
    return dispositivos
        .filter(d => d.activo || d.id === conservarId)
        .sort((x, y) => {
            if (!x.zona !== !y.zona) return x.zona ? -1 : 1;
            return (x.zona ?? '').localeCompare(y.zona ?? '', 'es') || x.dispositivo.localeCompare(y.dispositivo, 'es');
        })
        .map(d => ({
            value: d.id,
            label: d.dispositivo,
            group: d.zona ? `Zona: ${d.zona}` : 'Sin zona',
            selectedLabel: d.nombre,
            hint: [d.vlan_default != null ? `VLAN ${d.vlan_default}` : null, d.activo ? null : 'Desactivada']
                .filter(Boolean).join(' · ') || undefined,
        }));
}
