import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Documento PDF de un Patch Panel o un Switch (solo render server-side).
// Mismo encabezado corporativo que el Acta de Avance (ActaProyectoPDF).

const styles = StyleSheet.create({
    page: { padding: 32, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9, color: '#333' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 8,
    },
    logo: { height: 60, width: 170, objectFit: 'contain', marginBottom: 4 },
    title: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#0e3187' },
    section: { marginBottom: 12 },
    sectionTitle: { fontSize: 10, fontWeight: 'bold', backgroundColor: '#f0f0f0', padding: 4, marginBottom: 5 },
    row: { flexDirection: 'row', marginBottom: 2 },
    label: { width: 95, fontWeight: 'bold' },
    value: { flex: 1 },
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    kpi: { borderWidth: 1, borderColor: '#ddd', borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, minWidth: 90 },
    kpiValue: { fontSize: 13, fontWeight: 'bold', color: '#0e3187' },
    kpiLabel: { fontSize: 7, color: '#666', textTransform: 'uppercase' },
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#0e3187', color: '#fff',
        paddingVertical: 4, paddingHorizontal: 4, fontWeight: 'bold', fontSize: 8,
    },
    tableRow: {
        flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
        borderColor: '#ddd', paddingVertical: 3, paddingHorizontal: 4,
    },
    footer: {
        position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row',
        justifyContent: 'space-between', fontSize: 7, color: '#888',
        borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 4,
    },
});

export type TonoFila = 'ok' | 'rematada' | 'pendiente' | 'libre';

export interface RackPDFColumna {
    key: string;
    label: string;
    flex: number;
}

export interface RackPDFFila {
    cells: Record<string, string>;
    /** Color del texto de la columna `estado` y atenuación de filas libres. */
    tono: TonoFila;
}

export interface RackPDFProps {
    tipoLabel: 'PATCH PANEL' | 'SWITCH';
    equipoNombre: string;
    proyectoNombre: string;
    cliente: string;
    ubicacion: string;
    generadoEn: Date;
    resumen: { label: string; value: string }[];
    columnas: RackPDFColumna[];
    filas: RackPDFFila[];
    logoUrl?: string;
}

const TZ = 'America/Santiago';

const COLOR_TONO: Record<TonoFila, string> = { ok: '#047857', rematada: '#1d4ed8', pendiente: '#b45309', libre: '#9ca3af' };

export const RackPDF = ({
    tipoLabel, equipoNombre, proyectoNombre, cliente, ubicacion, generadoEn,
    resumen, columnas, filas, logoUrl,
}: RackPDFProps) => {
    const fecha = generadoEn.toLocaleDateString('es-CL', { timeZone: TZ });
    const hora = generadoEn.toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) + ' hrs';

    return (
        <Document title={`${tipoLabel} ${equipoNombre} - ${proyectoNombre}`}>
            <Page size="A4" orientation="landscape" style={styles.page}>
                {/* Encabezado corporativo */}
                <View style={styles.header}>
                    <View>
                        <Image src={logoUrl ?? '/systelcom.png'} style={styles.logo} />
                        <Text style={{ fontSize: 9, color: '#666', fontWeight: 'bold' }}>Soluciones Tecnológicas</Text>
                        <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>www.systelltda.cl</Text>
                    </View>
                    <View style={{ textAlign: 'right', paddingTop: 6 }}>
                        <Text style={styles.title}>DOCUMENTACIÓN DE {tipoLabel}</Text>
                        <Text style={{ fontSize: 9, marginBottom: 2 }}>Fecha: {fecha}</Text>
                        <Text style={{ fontSize: 9 }}>Hora: {hora}</Text>
                    </View>
                </View>

                {/* Datos del proyecto y del equipo */}
                <View style={styles.section}>
                    <View style={styles.row}><Text style={styles.label}>Proyecto:</Text><Text style={styles.value}>{proyectoNombre}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Cliente:</Text><Text style={styles.value}>{cliente || 'No definido'}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Ubicación:</Text><Text style={styles.value}>{ubicacion || 'No definida'}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>{tipoLabel === 'SWITCH' ? 'Switch:' : 'Patch Panel:'}</Text><Text style={[styles.value, { fontWeight: 'bold' }]}>{equipoNombre}</Text></View>
                </View>

                {/* Resumen */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RESUMEN</Text>
                    <View style={styles.kpis}>
                        {resumen.map(r => (
                            <View key={r.label} style={styles.kpi}>
                                <Text style={styles.kpiValue}>{r.value}</Text>
                                <Text style={styles.kpiLabel}>{r.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Detalle */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {tipoLabel === 'SWITCH' ? 'DETALLE DE PUERTOS' : 'DETALLE DE BOCAS'}
                    </Text>
                    <View style={styles.tableHeader} wrap={false}>
                        {columnas.map(c => <Text key={c.key} style={{ flex: c.flex }}>{c.label}</Text>)}
                    </View>
                    {filas.map((f, i) => (
                        <View key={i} wrap={false} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                            {columnas.map(c => (
                                <Text
                                    key={c.key}
                                    style={{
                                        flex: c.flex,
                                        color: c.key === 'estado' ? COLOR_TONO[f.tono] : f.tono === 'libre' ? '#9ca3af' : '#333',
                                        fontWeight: c.key === 'num' || c.key === 'estado' ? 'bold' : 'normal',
                                        paddingRight: 4,
                                    }}
                                >
                                    {f.cells[c.key] || '—'}
                                </Text>
                            ))}
                        </View>
                    ))}
                </View>

                <View style={styles.footer} fixed>
                    <Text>Systel · Documentación de {tipoLabel === 'SWITCH' ? 'switch' : 'patch panel'} · {proyectoNombre}</Text>
                    <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
};
