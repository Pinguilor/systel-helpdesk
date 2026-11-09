import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Informe de avance de un Rollout para el cliente (solo render server-side).
// Mismo encabezado corporativo que el Acta de Avance y la documentación de rack.

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
    kpi: { borderWidth: 1, borderColor: '#ddd', borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, minWidth: 110 },
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

export interface InformeLocalFila {
    sigla: string;
    local: string;
    estado: string;
    checklist: string;
    materiales: string;
    instalados: string;
    acta: boolean;
}

export interface InformeMasivoPDFProps {
    proyectoNombre: string;
    cliente: string;
    coordinador: string;
    periodo: string;
    generadoEn: Date;
    resumen: { label: string; value: string }[];
    filas: InformeLocalFila[];
    materiales: { equipo: string; requerido: number; entregado: number; instalado: number }[];
    logoUrl?: string;
}

const TZ = 'America/Santiago';

const COLUMNAS: { key: keyof InformeLocalFila; label: string; flex: number }[] = [
    { key: 'sigla', label: 'Sigla', flex: 0.8 },
    { key: 'local', label: 'Local', flex: 3 },
    { key: 'estado', label: 'Estado', flex: 1.4 },
    { key: 'checklist', label: 'Checklist', flex: 1.2 },
    { key: 'materiales', label: 'Materiales entregados', flex: 1.6 },
    { key: 'instalados', label: 'Instalados', flex: 1 },
    { key: 'acta', label: 'Acta firmada', flex: 1 },
];

export const InformeMasivoPDF = ({
    proyectoNombre, cliente, coordinador, periodo, generadoEn, resumen, filas, materiales, logoUrl,
}: InformeMasivoPDFProps) => {
    const fecha = generadoEn.toLocaleDateString('es-CL', { timeZone: TZ });
    const hora = generadoEn.toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) + ' hrs';

    return (
        <Document title={`Informe de avance - ${proyectoNombre}`}>
            <Page size="A4" orientation="landscape" style={styles.page}>
                <View style={styles.header}>
                    <View>
                        <Image src={logoUrl ?? '/systelcom.png'} style={styles.logo} />
                        <Text style={{ fontSize: 9, color: '#666', fontWeight: 'bold' }}>Soluciones Tecnológicas</Text>
                        <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>www.systelltda.cl</Text>
                    </View>
                    <View style={{ textAlign: 'right', paddingTop: 6 }}>
                        <Text style={styles.title}>INFORME DE AVANCE</Text>
                        <Text style={{ fontSize: 9, marginBottom: 2 }}>Fecha: {fecha}</Text>
                        <Text style={{ fontSize: 9 }}>Hora: {hora}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.row}><Text style={styles.label}>Proyecto:</Text><Text style={[styles.value, { fontWeight: 'bold' }]}>{proyectoNombre}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Cliente:</Text><Text style={styles.value}>{cliente || 'No definido'}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Coordinador:</Text><Text style={styles.value}>{coordinador || 'No asignado'}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Período:</Text><Text style={styles.value}>{periodo}</Text></View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RESUMEN GENERAL</Text>
                    <View style={styles.kpis}>
                        {resumen.map(r => (
                            <View key={r.label} style={styles.kpi}>
                                <Text style={styles.kpiValue}>{r.value}</Text>
                                <Text style={styles.kpiLabel}>{r.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>AVANCE POR LOCAL ({filas.length})</Text>
                    <View style={styles.tableHeader} wrap={false}>
                        {COLUMNAS.map(c => <Text key={c.key} style={{ flex: c.flex }}>{c.label}</Text>)}
                    </View>
                    {filas.map((f, i) => (
                        <View key={`${f.sigla}-${i}`} wrap={false} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                            {COLUMNAS.map(c => {
                                const v = f[c.key];
                                const texto = c.key === 'acta' ? (v ? 'Sí' : '—') : String(v || '—');
                                return (
                                    <Text
                                        key={c.key}
                                        style={{
                                            flex: c.flex, paddingRight: 4,
                                            fontWeight: c.key === 'sigla' ? 'bold' : 'normal',
                                            color: c.key === 'acta' && v ? '#047857' : '#333',
                                        }}
                                    >
                                        {texto}
                                    </Text>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {materiales.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>MATERIALES CONSOLIDADOS</Text>
                        <View style={styles.tableHeader} wrap={false}>
                            <Text style={{ flex: 4 }}>Equipo</Text>
                            <Text style={{ flex: 1, textAlign: 'right' }}>Requerido</Text>
                            <Text style={{ flex: 1, textAlign: 'right' }}>Entregado</Text>
                            <Text style={{ flex: 1, textAlign: 'right' }}>Instalado</Text>
                        </View>
                        {materiales.map((m, i) => (
                            <View key={`${m.equipo}-${i}`} wrap={false} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                                <Text style={{ flex: 4 }}>{m.equipo}</Text>
                                <Text style={{ flex: 1, textAlign: 'right' }}>{m.requerido}</Text>
                                <Text style={{ flex: 1, textAlign: 'right' }}>{m.entregado}</Text>
                                <Text style={{ flex: 1, textAlign: 'right' }}>{m.instalado}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.footer} fixed>
                    <Text>Systel · Informe de avance · {proyectoNombre}</Text>
                    <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
};
