import type { InteractiveMarker } from '@/components/ui/cobe-globe-interactive';

// Locales conocidos del globo (aparecen siempre, aunque no tengan tickets activos)
export const BASELINE_SIGLAS = [
        // Norte
        'IQS', 'CMA', 'ANT', 'COP', 'LAS', 'LIS', 'LCR', 'MCQ', 'OVA',
        // Centro
        'MMA', 'REI', 'KNN', 'CHA', 'DEH', 'EKI', 'EYZ', 'IDE', 'LBO', 
        'SRB', 'MPE', 'GVE', 'G18', 'FLC', 'ECT', 'ESB', 'EKV', 'ANP', 
        'MPN', 'LFD', 'LLR', 'LMP', 'MA1', 'MAQ', 'MMI', 'MPS', 'MTO', 
        'PA2', 'PCT', 'PDH', 'PFC', 'PFV', 'POE',
        // Sur
        'LIN', 'CLA', 'LAN', 'PTR', 'TEMU', 'PM1'
    ];

// Ubicación estilizada de cada sigla en el globo
export const COORDENADAS_GLOBO: Record<string, [number, number]> = {
        // Norteamérica
        IQS: [40.71, -74.00],      // New York
        CMA: [34.05, -118.24],     // Los Angeles
        ANT: [43.65, -79.38],      // Toronto
        COP: [19.43, -99.13],      // Mexico City
        LAS: [25.76, -80.19],      // Miami
        LIS: [21.30, -157.85],     // Honolulu
        LCR: [45.50, -73.56],      // Montreal
        MCQ: [37.77, -122.41],     // San Francisco
        OVA: [47.60, -122.33],     // Seattle
        
        // Europa
        MMA: [51.50, -0.12],       // London
        REI: [48.85, 2.35],        // Paris
        KNN: [52.52, 13.40],       // Berlin
        "4PS": [41.90, 12.49],     // Rome
        CHA: [40.41, -3.70],       // Madrid
        DEH: [50.11, 8.68],        // Frankfurt
        EKI: [59.32, 18.06],       // Stockholm
        EYZ: [59.91, 10.75],       // Oslo
        IDE: [60.16, 24.93],       // Helsinki
        LBO: [55.75, 37.61],       // Moscow
        SRB: [41.00, 28.97],       // Istanbul
        MPE: [37.98, 23.72],       // Athens
        GVE: [48.20, 16.37],       // Vienna
        G18: [50.85, 4.35],        // Brussels
        FLC: [52.36, 4.90],        // Amsterdam
        ECT: [47.37, 8.54],        // Zurich
        ESB: [38.72, -9.13],       // Lisbon
        
        // Asia & Medio Oriente
        EKV: [39.90, 116.40],      // Beijing
        ANP: [35.67, 139.65],      // Tokyo
        MPN: [37.56, 126.97],      // Seoul
        LFD: [22.39, 114.10],      // Hong Kong
        LLR: [1.35, 103.81],       // Singapore
        LMP: [13.75, 100.50],      // Bangkok
        MA1: [-6.20, 106.81],      // Jakarta
        MAQ: [14.59, 120.98],      // Manila
        MMI: [19.07, 72.87],       // Mumbai
        MPS: [28.61, 77.20],       // Delhi
        MTO: [25.20, 55.27],       // Dubai
        PA2: [24.71, 46.67],       // Riyadh
        
        // África & Oceanía & Sudamérica
        PCT: [30.04, 31.23],       // Cairo
        PDH: [-1.29, 36.82],       // Nairobi
        PFC: [6.52, 3.37],         // Lagos
        PFV: [-33.92, 18.42],      // Cape Town
        POE: [33.57, -7.58],       // Casablanca
        LIN: [-33.86, 151.20],     // Sydney
        CLA: [-36.84, 174.76],     // Auckland
        LAN: [-34.60, -58.38],     // Buenos Aires
        PTR: [-22.90, -43.17],     // Rio de Janeiro
        TEMU: [-12.04, -77.04],    // Lima
        PM1: [4.71, -74.07]        // Bogota
    };

/** Convierte conteos de tickets activos por sigla en marcadores para el globo. */
export function buildGlobeMarkers(counts: Record<string, number>): InteractiveMarker[] {
    const all: Record<string, number> = { ...counts };
    BASELINE_SIGLAS.forEach(sigla => {
        if (all[sigla] === undefined) all[sigla] = 0;
    });

    return Object.entries(all).map(([sigla, count]) => {
        const loc = COORDENADAS_GLOBO[sigla] || [-33.45 - (Math.random() - 0.5) * 1.5, -70.66 - (Math.random() - 0.5) * 1.5];
        return { id: sigla, location: loc, name: sigla, users: count };
    });
}
