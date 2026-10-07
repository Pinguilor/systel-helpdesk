import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, color: '#0e3187' },
  companyLogo: { height: 90, width: 240, objectFit: 'contain', marginBottom: 5 },
  section: { marginBottom: 15 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 4,
    marginBottom: 5,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 120, fontWeight: 'bold' },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 5,
    fontWeight: 'bold',
    marginTop: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    padding: 5,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    padding: 5,
    backgroundColor: '#fafafa',
  },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, paddingTop: 10 },
  signatureBox: { width: '45%', alignItems: 'center' },
  signatureLine: { width: '100%', borderTopWidth: 1, borderTopColor: '#000', marginBottom: 5 },
  signatureImage: { height: 60, objectFit: 'contain', marginBottom: 5 },
});

export interface TecnicoActa {
  nombre: string;
  rol: string;
}

export interface ActaProyectoProps {
  proyectoNombre: string;
  cliente: string;
  ubicacion: string;
  receptorNombre: string;
  receptorCargo?: string | null;
  descripcion: string;
  tecnicos: TecnicoActa[];
  /** Nombre de quien registra la firma en terreno (firma del técnico). */
  tecnicoFirmanteNombre: string;
  firmaReceptorUrl: string;
  firmaTecnicoUrl?: string | null;
  sha256: string;
  latitud?: number | null;
  longitud?: number | null;
  signedAt: Date;
  /** Fotos de respaldo (data URIs), máx. 5. Si hay, se agrega la página de anexo. */
  evidencias?: string[];
  logoUrl?: string;
}

const TZ = 'America/Santiago';

export const ActaProyectoPDF = ({
  proyectoNombre,
  cliente,
  ubicacion,
  receptorNombre,
  receptorCargo,
  descripcion,
  tecnicos,
  tecnicoFirmanteNombre,
  firmaReceptorUrl,
  firmaTecnicoUrl,
  sha256,
  latitud,
  longitud,
  signedAt,
  evidencias = [],
  logoUrl,
}: ActaProyectoProps) => {
  const fechaDisplay = signedAt.toLocaleDateString('es-CL', { timeZone: TZ });
  const horaDisplay =
    signedAt.toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) + ' hrs';
  const hasGeo = typeof latitud === 'number' && typeof longitud === 'number';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Image src={logoUrl ?? '/systelcom.png'} style={styles.companyLogo} />
            <Text style={{ fontSize: 9, color: '#666', fontWeight: 'bold' }}>Soluciones Tecnológicas</Text>
            <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>www.systelltda.cl</Text>
          </View>
          <View style={{ textAlign: 'right', paddingTop: 10 }}>
            <Text style={styles.title}>ACTA DE AVANCE DE PROYECTO</Text>
            <Text style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Fecha: {fechaDisplay}</Text>
            <Text style={{ fontSize: 9, color: '#333' }}>Hora: {horaDisplay}</Text>
          </View>
        </View>

        {/* Datos del Proyecto */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Proyecto:</Text>
            <Text style={styles.value}>{proyectoNombre}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{cliente || 'No definido'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ubicación:</Text>
            <Text style={styles.value}>{ubicacion || 'No definida'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Receptor / Encargado:</Text>
            <Text style={styles.value}>
              {receptorNombre}
              {receptorCargo ? ` (${receptorCargo})` : ''}
            </Text>
          </View>
        </View>

        {/* Descripción del avance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPCIÓN DEL AVANCE / TRABAJO</Text>
          <Text style={{ minHeight: 60, padding: 5 }}>{descripcion}</Text>
        </View>

        {/* Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL TÉCNICO ASIGNADO</Text>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={{ flex: 2 }}>Nombre Técnico</Text>
            <Text style={{ flex: 1, textAlign: 'center' }}>Rol</Text>
            <Text style={{ flex: 1, textAlign: 'center' }}>Fecha de Ejecución</Text>
          </View>
          {tecnicos.length === 0 ? (
            <View style={styles.tableRow} wrap={false}>
              <Text style={{ flex: 2, color: '#9ca3af', fontStyle: 'italic' }}>Sin personal asignado</Text>
              <Text style={{ flex: 1 }} />
              <Text style={{ flex: 1 }} />
            </View>
          ) : (
            tecnicos.map((t, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={{ flex: 2, fontWeight: 'bold' }}>{t.nombre}</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>{t.rol}</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>{fechaDisplay}</Text>
              </View>
            ))
          )}
        </View>

        {/* Firmas + conformidad + auditoría: bloque indivisible */}
        <View minPresenceAhead={160}>
          <View style={styles.signatures}>
            <View style={styles.signatureBox}>
              <Image src={firmaReceptorUrl} style={styles.signatureImage} />
              <View style={styles.signatureLine} />
              <Text>Receptor: {receptorNombre}</Text>
            </View>
            <View style={styles.signatureBox}>
              {firmaTecnicoUrl ? <Image src={firmaTecnicoUrl} style={styles.signatureImage} /> : <View style={styles.signatureImage} />}
              <View style={styles.signatureLine} />
              <Text>Nombre y Firma del Técnico</Text>
              <Text style={{ fontSize: 8, color: '#666' }}>{tecnicoFirmanteNombre}</Text>
            </View>
          </View>

          <View style={{ marginTop: 20, fontSize: 8, color: '#666', textAlign: 'justify' }}>
            <Text>
              Al firmar la presente Acta de Avance, el cliente declara haber revisado y recepcionado a conformidad los
              trabajos descritos, correspondientes al avance del proyecto a la fecha indicada.
            </Text>
            <Text style={{ marginTop: 5, color: '#888' }}>
              Auditoría de Cierre: documento firmado digitalmente el {fechaDisplay} a las {horaDisplay}.
              {hasGeo ? ` Geolocalización: ${latitud}, ${longitud}.` : ' Geolocalización no disponible.'}
            </Text>
            <Text style={{ marginTop: 3, color: '#888', fontSize: 7 }}>SHA-256 de la firma: {sha256}</Text>
          </View>
        </View>
      </Page>

      {/* Anexo: evidencia fotográfica (cuadrícula 2 columnas; 5 fotos caben en una página) */}
      {evidencias.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>ANEXO: EVIDENCIA FOTOGRÁFICA</Text>
          <Text style={{ fontSize: 8, color: '#666', marginBottom: 10 }}>
            Proyecto: {proyectoNombre} · {fechaDisplay}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {evidencias.map((src, i) => (
              <View key={i} wrap={false} style={{ width: '48.5%', marginBottom: 14 }}>
                <View style={{ borderWidth: 1, borderColor: '#ddd', height: 190, padding: 3, justifyContent: 'center' }}>
                  <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </View>
                <Text style={{ fontSize: 8, color: '#666', marginTop: 3 }}>Evidencia {i + 1} de {evidencias.length}</Text>
              </View>
            ))}
          </View>
        </Page>
      )}
    </Document>
  );
};
