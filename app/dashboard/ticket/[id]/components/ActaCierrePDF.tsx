import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#0e3187'
  },
  companyLogo: {
    height: 90,
    width: 240,
    objectFit: 'contain',
    marginBottom: 5
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 4,
    marginBottom: 5
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3
  },
  label: {
    width: 120,
    fontWeight: 'bold'
  },
  value: {
    flex: 1
  },
  table: {
    flexDirection: 'column',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    padding: 5,
    fontWeight: 'bold'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 5
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 10
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center'
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginBottom: 5
  },
  signatureImage: {
    height: 60,
    objectFit: 'contain',
    marginBottom: 5
  }
});

interface Props {
  ticket: any;
  materiales: any[];
  notas: string;
  firmaClienteUrl: string;
  firmaTecnicoUrl: string;
  agenteNombre: string;
}

export const ActaCierrePDF = ({ ticket, materiales = [], notas, firmaClienteUrl, firmaTecnicoUrl, agenteNombre }: Props) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
            <View>
                {/* Company Logo */}
                <Image src="/systelcom.png" style={styles.companyLogo} />
                <Text style={{ fontSize: 9, color: '#666', fontWeight: 'bold' }}>Soluciones Tecnológicas</Text>
                <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>www.systelltda.cl</Text>
            </View>
            <View style={{ textAlign: 'right', paddingTop: 10 }}>
                <Text style={styles.title}>ORDEN DE SERVICIO</Text>
                <Text style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Nº: {ticket?.numero_ticket}</Text>
                <Text style={{ fontSize: 9, color: '#333' }}>Fecha: {new Date().toLocaleDateString()}</Text>
            </View>
        </View>

        {/* Datos del Cliente */}
        <View style={styles.section}>
            <View style={styles.row}>
                <Text style={styles.label}>Cliente:</Text>
                <Text style={styles.value}>{ticket?.restaurantes?.razon_social || 'No definido'}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Ubicación:</Text>
                <Text style={styles.value}>{ticket?.restaurantes?.nombre_restaurante || 'No definida'}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Tipo de Servicio:</Text>
                <Text style={styles.value}>{ticket?.catalogo_servicios?.categoria || 'Mantenimiento / Reparación'} - {ticket?.catalogo_servicios?.elemento}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Receptor / Encargado:</Text>
                <Text style={styles.value}>{ticket?.receptor_nombre || 'No registrado'}</Text>
            </View>
        </View>

        {/* Descripción del Trabajo */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESCRIPCIÓN DEL TRABAJO</Text>
            <Text style={{ minHeight: 60, padding: 5 }}>{notas}</Text>
        </View>

        {/* Materiales */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>MATERIALES INSUMIDOS</Text>
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={styles.col1}>Descripción</Text>
                    <Text style={styles.col2}>Cantidad</Text>
                </View>
                {materiales.length === 0 ? (
                    <View style={styles.tableRow}><Text style={styles.col1}>No se utilizaron materiales adicionales</Text></View>
                ) : (
                    materiales.map((item, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={styles.col1}>
                                {item.equipos?.modelo || item.modelo || item.descripcion || '-'}
                            </Text>
                            <Text style={styles.col2}>{item.cantidad || 1} UND</Text>
                        </View>
                    ))
                )}
            </View>
        </View>

        {/* Personal */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL TÉCNICO ASIGNADO</Text>
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={{ flex: 2 }}>Nombre Técnico</Text>
                    <Text style={{ flex: 1, textAlign: 'center' }}>Fecha de Ejecución</Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={{ flex: 2 }}>{agenteNombre || 'Técnico Autorizado'}</Text>
                    <Text style={{ flex: 1, textAlign: 'center' }}>{new Date().toLocaleDateString()}</Text>
                </View>
            </View>
        </View>

        {/* Status */}
        <View style={{ alignItems: 'center', marginVertical: 15 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>ESTADO DEL TRABAJO: TERMINADO</Text>
        </View>

        {/* Firmas */}
        <View style={styles.signatures}>
            <View style={styles.signatureBox}>
                {firmaClienteUrl ? <Image src={firmaClienteUrl} style={styles.signatureImage} /> : <View style={styles.signatureImage} />}
                <View style={styles.signatureLine} />
                <Text>Receptor: {ticket?.receptor_nombre || 'Firma del Cliente'}</Text>
            </View>
            <View style={styles.signatureBox}>
                {firmaTecnicoUrl ? <Image src={firmaTecnicoUrl} style={styles.signatureImage} /> : <View style={styles.signatureImage} />}
                <View style={styles.signatureLine} />
                <Text>Nombre y Firma del Técnico</Text>
            </View>
        </View>

        {/* Disclaimer */}
        <View style={{ marginTop: 20, fontSize: 8, color: '#666', textAlign: 'justify' }}>
            <Text>Al firmar la presente Orden de Servicio, el trabajo se entiende recepcionado a plena conformidad, por lo que el cliente en ningún caso podrá retener, compensar, aplazar, suspender o de cualquier otro modo alterar el pago de cargos u otras obligaciones correspondientes al trabajo realizado.</Text>
            {ticket?.latitud_cierre && ticket?.longitud_cierre && (
                <Text style={{ marginTop: 5, color: '#888' }}>
                    Auditoría de Cierre: Documento firmado y geolocalizado en coordenadas {ticket.latitud_cierre}, {ticket.longitud_cierre}
                </Text>
            )}
        </View>
      </Page>
    </Document>
  );
};
