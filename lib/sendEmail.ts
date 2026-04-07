import { Resend } from 'resend';

// Inicializamos Resend con la variable de entorno o directamente con la clave
const resend = new Resend(process.env.RESEND_API_KEY || 're_KSz9zcdA_3BL7XTgX6dcg5BkrcJbUvbde');
const fromEmail = 'no-reply@systelltda-helpdesk.cl';

export async function sendTicketCreatedEmail(ticketId: string, ticketNumber: number, title: string, priority: string, creatorName: string, recipientEmail: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: `Systel Helpdesk <${fromEmail}>`,
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

export async function sendTicketResolvedEmail(
    ticketId: string,
    ticketNumber: number,
    title: string,
    recipientEmail: string,
    pdfBuffer?: Buffer,
    clientName?: string,
    localName?: string,
) {
    if (!recipientEmail) return { success: false, error: 'Sin destinatario' };

    const greeting = clientName ? `Estimado/a ${clientName},` : 'Estimado/a Cliente,';
    const locationLine = localName
        ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Ubicación</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${localName}</td></tr>`
        : '';

    try {
        const payload: Parameters<typeof resend.emails.send>[0] = {
            from: `Systel Helpdesk <${fromEmail}>`,
            to: [recipientEmail],
            subject: `[Cerrado] Acta de Resolución - NC-${ticketNumber}: ${title}`,
            html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);padding:32px 36px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:#93c5fd;text-transform:uppercase;">Systel Soporte Técnico</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Notificación de Cierre de Ticket</h1>
            <p style="margin:12px 0 0;font-size:13px;color:#bfdbfe;">Su solicitud de servicio ha sido resuelta exitosamente.</p>
          </td>
        </tr>

        <!-- Status badge -->
        <tr>
          <td style="padding:0 36px;">
            <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:14px 18px;margin:24px 0 0;display:inline-block;width:100%;box-sizing:border-box;">
              <p style="margin:0;font-size:13px;color:#065f46;font-weight:700;">
                ✅&nbsp;&nbsp;Estado: <span style="color:#059669;">CERRADO — TRABAJO COMPLETADO</span>
              </p>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 36px 28px;">
            <p style="margin:0 0 18px;font-size:15px;color:#374151;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Le informamos que el ticket <strong style="color:#1e3a8a;">NC-${ticketNumber} &mdash; &ldquo;${title}&rdquo;</strong>
              ha sido marcado como <strong>Resuelto</strong> y cerrado exitosamente por nuestro equipo técnico.
            </p>

            <!-- Ticket detail table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">
                  Detalle del Ticket
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">N° de Ticket</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#1e3a8a;border-bottom:1px solid #f3f4f6;">NC-${ticketNumber}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Asunto</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;">${title}</td>
              </tr>
              ${locationLine}
            </table>

            ${pdfBuffer ? `
            <!-- PDF callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c7d2fe;background:#eef2ff;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#3730a3;">📎 Acta de Cierre adjunta</p>
                  <p style="margin:0;font-size:13px;color:#4338ca;line-height:1.5;">
                    Encontrará el <strong>Acta de Cierre en formato PDF</strong> adjunta a este correo.
                    Este documento detalla el trabajo realizado, los materiales utilizados y las firmas
                    de conformidad para su respaldo y trazabilidad.
                  </p>
                </td>
              </tr>
            </table>
            ` : ''}

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Para nuevos requerimientos o consultas, le invitamos a ingresar al portal de soporte en línea.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 36px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#374151;">Equipo de Soporte Systel</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">Este es un correo automático, por favor no responda directamente.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
            ...(pdfBuffer && {
                attachments: [{
                    filename: `Acta_Cierre_NC-${ticketNumber}.pdf`,
                    content: pdfBuffer,
                }],
            }),
        };

        const { data, error } = await resend.emails.send(payload);
        if (error) console.error('Error enviando email (Resolución):', error);
        return { success: !error, data, error };
    } catch (e) {
        console.error('Excepción enviando email (Resolución):', e);
        return { success: false, error: e };
    }
}
