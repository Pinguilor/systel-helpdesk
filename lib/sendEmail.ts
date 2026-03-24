import { Resend } from 'resend';

// Inicializamos Resend con la variable de entorno o directamente con la clave
const resend = new Resend(process.env.RESEND_API_KEY || 're_KSz9zcdA_3BL7XTgX6dcg5BkrcJbUvbde');
const fromEmail = 'no-reply@loopdeskapp.com';

export async function sendTicketCreatedEmail(ticketId: string, ticketNumber: number, title: string, priority: string, creatorName: string, recipientEmail: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: `Loop Desk <${fromEmail}>`,
            to: [recipientEmail],
            subject: `[Nuevo Ticket NC-${ticketNumber}] ${title}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">Nuevo Ticket Creado</h2>
                    <p style="font-size: 15px;">Se ha registrado una nueva solicitud en el sistema.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>ID del Ticket:</strong> NC-${ticketNumber}</p>
                        <p style="margin: 5px 0;"><strong>Asunto:</strong> ${title}</p>
                        <p style="margin: 5px 0;"><strong>Prioridad:</strong> <span style="text-transform: capitalize;">${priority}</span></p>
                        <p style="margin: 5px 0;"><strong>Creado por:</strong> ${creatorName}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">Por favor revisa el dashboard para asignar y gestionar este ticket.</p>
                </div>
            `
        });
        if (error) console.error('Error enviando email (Creación):', error);
        return { success: !error, data, error };
    } catch (e) {
        console.error('Excepción enviando email (Creación):', e);
        return { success: false, error: e };
    }
}

export async function sendTicketResolvedEmail(ticketId: string, ticketNumber: number, title: string, recipientEmail: string) {
    if (!recipientEmail) return { success: false, error: 'Sin destinatario' };

    try {
        const { data, error } = await resend.emails.send({
            from: `Loop Desk <${fromEmail}>`,
            to: [recipientEmail],
            subject: `[Ticket Resuelto NC-${ticketNumber}] ${title}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #10b981;">Ticket Resuelto</h2>
                    <p style="font-size: 15px;">El ticket <strong>NC-${ticketNumber} - ${title}</strong> ha sido resuelto y cerrado exitosamente por nuestro equipo técnico.</p>
                    <p style="font-size: 14px; margin-top: 20px; color: #666;">Gracias por utilizar nuestro sistema de soporte.</p>
                </div>
            `
        });
        if (error) console.error('Error enviando email (Resolución):', error);
        return { success: !error, data, error };
    } catch (e) {
        console.error('Excepción enviando email (Resolución):', e);
        return { success: false, error: e };
    }
}
