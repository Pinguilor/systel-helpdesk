export interface ConsumoRow {
    solicitudId: string;
    nc: string;
    ticketId: string | null;
    local: string;       // sigla (para filtros y búsqueda)
    localSigla: string;  // ej. "KNN"
    localTitulo: string; // ej. "Revisión de POS"
    fecha: string;
    tecnico: string;
    modelo: string;
    familia: string;
    cantidad: number;
    estadoSolicitud: string;
    estadoTicket: string;
}
