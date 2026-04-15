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
  // Tabla: sin borde exterior — cada fila lleva su propio borde para
  // que los saltos de página automáticos no corten el recuadro a la mitad.
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
  ayudantesNombres?: string[];
  /** Ruta absoluta o URL del logo. Permite server-side rendering sin acceso al filesystem de Next.js */
  logoUrl?: string;
}

export const ActaCierrePDF = ({ ticket, materiales = [], notas, firmaClienteUrl, firmaTecnicoUrl, agenteNombre, ayudantesNombres = [], logoUrl }: Props) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
            <View>
                {/* Company Logo */}
                <Image src={logoUrl ?? '/systelcom.png'} style={styles.companyLogo} />
                <Text style={{ fontSize: 9, color: '#666', fontWeight: 'bold' }}>Soluciones Tecnológicas</Text>
                <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>www.systelltda.cl</Text>
            </View>
            <View style={{ textAlign: 'right', paddingTop: 10 }}>
                <Text style={styles.title}>ORDEN DE SERVICIO</Text>
                <Text style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Nº: {ticket?.numero_ticket}</Text>
                <Text style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Fecha: {new Date().toLocaleDateString('es-CL')}</Text>
                <Text style={{ fontSize: 9, color: '#333' }}>Hora: {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs</Text>
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

        {/* Materiales
            Cada fila tiene wrap={false} para que nunca se corte a la mitad entre páginas.
            El header NO usa fixed (eso lo repetiría en TODAS las páginas del documento).
            Con wrap={false} en filas, el motor de react-pdf inserta el salto ANTES del row
            que no cabe, garantizando que el corte siempre ocurre entre filas, nunca dentro.
        */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>MATERIALES INSUMIDOS</Text>

            {/* Cabecera de tabla */}
            <View style={styles.tableHeader} wrap={false}>
                <Text style={styles.col1}>Descripción</Text>
                <Text style={styles.col2}>Cantidad</Text>
            </View>

            {materiales.length === 0 ? (
                <View style={styles.tableRow} wrap={false}>
                    <Text style={styles.col1}>No se utilizaron materiales adicionales</Text>
                </View>
            ) : (
                materiales.map((item, i) => (
                    <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                        <Text style={styles.col1}>
                            {item.equipos?.modelo || item.modelo || item.descripcion || '-'}
                        </Text>
                        <Text style={styles.col2}>{item.cantidad || 1} UND</Text>
                    </View>
                ))
            )}
        </View>

        {/* Personal */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL TÉCNICO ASIGNADO</Text>

            <View style={styles.tableHeader} wrap={false}>
                <Text style={{ flex: 2 }}>Nombre Técnico</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>Rol</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>Fecha de Ejecución</Text>
            </View>

            {/* Técnico responsable */}
            <View style={styles.tableRow} wrap={false}>
                <Text style={{ flex: 2, fontWeight: 'bold' }}>{agenteNombre || 'Técnico Autorizado'}</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>Responsable</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>{new Date().toLocaleDateString('es-CL')}</Text>
            </View>

            {/* Técnicos ayudantes */}
            {ayudantesNombres.length > 0
                ? ayudantesNombres.map((nombre, i) => (
                    <View key={i} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow} wrap={false}>
                        <Text style={{ flex: 2 }}>{nombre}</Text>
                        <Text style={{ flex: 1, textAlign: 'center', color: '#6b7280' }}>Ayudante</Text>
                        <Text style={{ flex: 1, textAlign: 'center' }}>{new Date().toLocaleDateString('es-CL')}</Text>
                    </View>
                ))
                : (
                    <View style={[styles.tableRowAlt]} wrap={false}>
                        <Text style={{ flex: 2, color: '#9ca3af', fontStyle: 'italic' }}>Sin técnicos ayudantes registrados</Text>
                        <Text style={{ flex: 1 }} />
                        <Text style={{ flex: 1 }} />
                    </View>
                )
            }
        </View>

        {/* Estado + Firmas: minPresenceAhead garantiza que si este bloque no cabe entero
            en la página actual, react-pdf lo mueve completo a la siguiente página.
            Así las firmas nunca quedan huérfanas sin el estado ni sin la imagen de firma. */}
        <View minPresenceAhead={160}>
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
                <Text>Al firmar la presente Orden de Servicio, el cliente declara que el trabajo ha sido recepcionado a plena conformidad, certificando que las tareas descritas han sido finalizadas exitosamente y que los equipos o sistemas se encuentran operando según los requerimientos solicitados.</Text>
                {ticket?.latitud_cierre && ticket?.longitud_cierre && (
                    <Text style={{ marginTop: 5, color: '#888' }}>
                        Auditoría de Cierre: Documento firmado y geolocalizado en coordenadas {ticket.latitud_cierre}, {ticket.longitud_cierre}
                    </Text>
                )}
            </View>
        </View>

      </Page>
    </Document>
  );
};
