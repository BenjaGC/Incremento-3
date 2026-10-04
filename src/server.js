const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

const app = express();
if(process.env.TRUST_PROXY_HOPS)app.set('trust proxy',Number(process.env.TRUST_PROXY_HOPS));
const PORT = Number(process.env.PORT || 3000);

// ==========================================
// DIRECTORIOS DE UPLOADS
// ==========================================
const uploadDir = process.env.CLINICA_DATA_DIR ? path.join(process.env.CLINICA_DATA_DIR,'uploads') : path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const manualesDir = process.env.CLINICA_DATA_DIR ? path.join(process.env.CLINICA_DATA_DIR,'manuales') : path.join(__dirname, '..', 'public', 'manuales');
if (!fs.existsSync(manualesDir)) {
    fs.mkdirSync(manualesDir, { recursive: true });
}

// ==========================================
// CONFIGURACIÓN MULTER — Archivos de tickets
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const safeName=path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g,'_');
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// ==========================================
// CONFIGURACIÓN MULTER — Manuales PDF
// ==========================================
const storageManual = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, manualesDir);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
        const uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + safeName);
    }
});

const uploadManual = multer({
    storage: storageManual,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF para manuales.'));
        }
    }
});

// ==========================================
// POOL MySQL
// ==========================================
const pool = require('./config/database');

const codigosRecuperacion = {};

// ==========================================
// NODEMAILER
// ==========================================
const transporter = require('./config/mail');

app.get('/health/live',(req,res)=>res.json({status:'ok'}));
app.get('/health/ready',async(req,res)=>{try{await inc3.ready;await pool.query('SELECT 1');res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});
app.use(express.json({limit:'256kb'}));
require('./access-control')(app,pool);
require('./password-recovery')(app,{pool,transporter});
const inc3 = require('./increment3')(app, {pool,uploadDir,validarRutModulo11,transporter,obtenerComentariosParaViewer,enviarEmailTicketResuelto});
app.use('/uploads',express.static(uploadDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================================
// MAPA DE ESTADOS
// ==========================================
const ESTADOS = {
    1: 'En curso',
    2: 'En espera',
    3: 'Cancelado',
    4: 'Resuelto',
    5: 'Pendiente',
    6: 'Cerrado'
};

// ==========================================
// VALIDACIÓN RUT MÓDULO 11 (backend)
// ==========================================
/**
 * Valida un RUT chileno usando el algoritmo Módulo 11.
 * Acepta el formato: 12345678-9  o  12345678-K
 * @param {string} rut - RUT con guión y dígito verificador
 * @returns {boolean}
 */
function validarRutModulo11(rut) {
    if (!rut || typeof rut !== 'string') return false;

    rut = rut.trim().toUpperCase();

    // Validar formato: solo dígitos, guión y dígito verificador (0-9 o K)
    if (!/^\d{7,8}-[\dK]$/.test(rut)) return false;

    const partes = rut.split('-');
    const cuerpo = partes[0];
    const dvIngresado = partes[1];

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i], 10) * multiplo;
        multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }

    const resto = suma % 11;
    const dvCalc = 11 - resto;

    let dvEsperado;
    if (dvCalc === 11) dvEsperado = '0';
    else if (dvCalc === 10) dvEsperado = 'K';
    else dvEsperado = String(dvCalc);

    return dvIngresado === dvEsperado;
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function enmascararCorreo(correo) {
    if (!correo || !correo.includes('@')) return correo;
    const [nombre, dominio] = correo.split('@');
    let enmascarado = '';
    if (nombre.length > 2) {
        enmascarado = nombre.substring(0, 2) + '*'.repeat(Math.min(nombre.length - 2, 4));
    } else {
        enmascarado = nombre[0] + '*';
    }
    return `${enmascarado}@${dominio}`;
}

async function asignarTecnico(categoryId, priorityId) {
    return inc3.assign(categoryId, priorityId);
}

// ── RF-06: Fallback — obtiene al Técnico Crítico marcado por el administrador ──
async function obtenerTecnicoCritico() {
    const [critico] = await pool.query(`
        SELECT u.user_id, u.first_name
        FROM user u
        JOIN user_role ur ON u.user_id = ur.user_id
        WHERE u.is_critical_tech = 1 AND ur.role_id = 1 AND ur.active = 1
        LIMIT 1
    `);
    if (critico.length > 0) return critico[0];
    return null;
}

function textoEstado(estadoAnteriorId, estadoNuevoId, nombreUsuario) {
    const anterior = ESTADOS[estadoAnteriorId] || `Estado ${estadoAnteriorId}`;
    const nuevo = ESTADOS[estadoNuevoId] || `Estado ${estadoNuevoId}`;
    return `📋 Cambio de estado: "${anterior}" → "${nuevo}" por ${nombreUsuario}.`;
}

// ==========================================
// NOTIFICACIONES AL CREADOR (solo en panel)
// ==========================================
async function marcarNotificacionCreador(ticketId, requesterUserId, actorUserId) {
    try {
        if (requesterUserId && actorUserId && requesterUserId !== actorUserId) {
            await new (require('./domain').NotificacionInApp)(id=>pool.query('UPDATE ticket SET notify_creator = 1 WHERE ticket_id = ?',[id])).enviar(ticketId);
        }
    } catch (error) {
        console.error('Error marcando notificación al creador:', error);
    }
}

// ==========================================
// HELPER: Construir ticket desde fila DB
// ==========================================
async function ocultarEvidenciasEliminadas(comments,ticketId) {
    for(const c of comments)c.texto=require('sanitize-html')(c.texto||'',{allowedTags:['a','img','br','p','strong','b','em','ul','ol','li'],allowedAttributes:{a:['href','target'],img:['src','alt']},allowedSchemes:['http','https'],allowProtocolRelative:false});
    const [deleted]=await pool.query('SELECT file_path FROM attachment WHERE ticket_id=? AND is_deleted=1',[ticketId]);
    for(const c of comments)for(const a of deleted){
        c.texto=c.texto.replace(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi,(html,url)=>url===a.file_path?'[Evidencia en papelera]':html)
            .replace(/<img\b[^>]*src="([^"]+)"[^>]*>/gi,(html,url)=>url===a.file_path?'':html);
    }
}

async function buildTicketFromRow(ticket, viewerUsuario, support=false) {


    // ── RF-22: la ubicación es un atributo propio e inmutable del ticket ──
    // Se usan las columnas dedicadas (piso_ticket/habitacion_ticket); si un ticket
    // antiguo no las tiene cargadas, se recurre al parseo del título como respaldo.
    if (ticket.piso_ticket) {
        ticket.piso = ticket.piso_ticket;
        ticket.habitacion = ticket.habitacion_ticket || (ticket.habitacion_original || 'S/I');
    } else if (ticket.title && ticket.title.startsWith('Incidente en ')) {
        const ubicacion = ticket.title.replace('Incidente en ', '').split(' - ');
        ticket.piso = ubicacion[0] ? ubicacion[0].trim() : 'S/I';
        ticket.habitacion = ubicacion[1] ? ubicacion[1].trim() : (ticket.habitacion_original || 'S/I');
    } else {
        ticket.piso = 'S/I';
        ticket.habitacion = ticket.habitacion_original || 'S/I';
    }

    const [comments] = await pool.query(`
        SELECT c.content as texto, DATE_FORMAT(c.comment_date, '%d/%m/%Y, %H:%i:%s') as fecha,
               COALESCE(u.first_name,'Sistema') as usuario, c.is_private as privado
        FROM comment c LEFT JOIN user u ON c.user_id = u.user_id
        WHERE c.ticket_id = ? ORDER BY c.comment_date DESC
    `, [ticket.ticket_id]);

    await ocultarEvidenciasEliminadas(comments,ticket.ticket_id);
    // ── RF-17: se oculta la nota privada en las vistas del solicitante ──
    const comentariosVisibles = (!support)
        ? comments.filter(c => c.privado !== 1)
        : comments;

    ticket.comentarios = JSON.stringify(comentariosVisibles);

    return ticket;
}

// ==========================================
// HELPER: Comentarios filtrados según quién los solicita (RF-17)
// ==========================================
async function obtenerComentariosParaViewer(ticketId, viewerUsuario, support=false) {
    const [ticketRows] = await pool.query(
        `SELECT u.first_name as creador FROM ticket t LEFT JOIN user u ON t.requester_user_id = u.user_id WHERE t.ticket_id = ?`,
        [ticketId]
    );
    const creador = ticketRows.length > 0 ? ticketRows[0].creador : null;

    const [comments] = await pool.query(`
        SELECT c.content as texto, DATE_FORMAT(c.comment_date, '%d/%m/%Y, %H:%i:%s') as fecha,
               COALESCE(u.first_name,'Sistema') as usuario, c.is_private as privado
        FROM comment c LEFT JOIN user u ON c.user_id = u.user_id
        WHERE c.ticket_id = ? ORDER BY c.comment_date DESC
    `, [ticketId]);

    await ocultarEvidenciasEliminadas(comments,ticketId);
    if (!support) {
        return comments.filter(c => c.privado !== 1);
    }
    return comments;
}

// ==========================================
// RF-14: VENTANA OPERATIVA — horario y cola de correos
// ==========================================
async function obtenerHorarioOperativo() {
    const [rows] = await pool.query('SELECT hora_inicio, hora_fin FROM operating_hours WHERE operating_hours_id = 1');
    if (rows.length === 0) return { hora_inicio: '08:00:00', hora_fin: '20:00:00' };
    return rows[0];
}

function estaDentroDeHorario(horaInicio, horaFin) {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

    const [hiH, hiM] = String(horaInicio).split(':').map(Number);
    const [hfH, hfM] = String(horaFin).split(':').map(Number);
    const minutosInicio = hiH * 60 + hiM;
    const minutosFin = hfH * 60 + hfM;

    if (minutosInicio <= minutosFin) {
        return minutosAhora >= minutosInicio && minutosAhora <= minutosFin;
    }
    // Rango que cruza medianoche (ej. 22:00 a 06:00)
    return minutosAhora >= minutosInicio || minutosAhora <= minutosFin;
}

// Reintenta enviar los correos que quedaron encolados fuera del horario operativo
let procesandoCorreos = false;
async function procesarColaCorreos() {
    if (procesandoCorreos) return 0;
    procesandoCorreos = true;
    try {
        const horario = await obtenerHorarioOperativo();
        const dentroHorario = estaDentroDeHorario(horario.hora_inicio, horario.hora_fin);

        const [pendientes] = await pool.query('SELECT * FROM email_queue WHERE enviado = 0 AND (? = 1 OR asunto LIKE ?) ORDER BY encolado_date ASC', [dentroHorario ? 1 : 0, '🚨 Nuevo Incidente Reportado:%']);
        let enviados = 0;
        for (const correo of pendientes) {
            try {
            await transporter.sendMail({
                from: process.env.MAIL_FROM || process.env.MAIL_USER,
                to: correo.destinatario,
                subject: correo.asunto,
                html: correo.html_body
            });

            await pool.query('UPDATE email_queue SET enviado = 1, enviado_date = NOW() WHERE queue_id = ?', [correo.queue_id]);
            enviados++;
            } catch(error) { console.error('Correo pendiente, se reintentará:', error.message); }
        }
        return enviados;
    } catch (error) {
        console.error('Error procesando cola de correos:', error);
        return 0;
    } finally { procesandoCorreos = false; }
}

// Punto único de envío para las notificaciones operativas de ticket (RF-14):
// respeta la ventana horaria configurada por el administrador; fuera de rango, encola.
async function enviarCorreoOperativo(destinatario, asunto, html) {
    if (!destinatario || destinatario.trim() === '' || destinatario.includes('@temp.com')) return;

    try {
        await procesarColaCorreos();
        const horario = await obtenerHorarioOperativo();

        await pool.query('INSERT INTO email_queue (destinatario, asunto, html_body) VALUES (?, ?, ?)', [destinatario, asunto, html]);
        if (estaDentroDeHorario(horario.hora_inicio, horario.hora_fin)) await procesarColaCorreos();
    } catch (error) {
        console.error('Error en enviarCorreoOperativo:', error);
    }
}

// ==========================================
// FUNCIONES DE EMAIL
// ==========================================
async function enviarAvisoNuevoTicket(destinatario, asunto, html) {
    try {
        await pool.query('INSERT INTO email_queue (destinatario, asunto, html_body) VALUES (?, ?, ?)', [destinatario, asunto, html]);
        await procesarColaCorreos();
    } catch(error) { console.error('No se pudo registrar el aviso del ticket:', error.message); }
}
function enviarEmailNuevoTicket(destinatarios, ticketData) {
    if (!destinatarios || destinatarios.trim() === '') return;

    const { ticketCode, creador, piso, habitacion, aparato, descripcion, fecha, tecnicoAsignado } = ticketData;

    const textoPlano = `Se ha generado un nuevo ticket en el sistema.\n\nDetalles del Incidente:\nID: ${ticketCode}\nCreador: ${creador}\nUbicación: ${piso} - ${habitacion}\nAparato: ${aparato}\nDescripción: ${descripcion}\nFecha: ${fecha}\nTécnico asignado: ${tecnicoAsignado || 'Sin asignar'}\n\nPor favor, revisa el panel para tomar acción.`;

    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#2c3e50; padding: 25px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; letter-spacing:1px;">🚨 Nuevo Incidente Reportado</h1>
              <p style="margin:8px 0 0 0; color:#a0b0c0; font-size:13px;">Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px 10px 30px;">
              <p style="margin:0; color:#555; font-size:15px;">Se ha generado un nuevo ticket en el sistema.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed; border-radius:6px; overflow:hidden;">
                <tr>
                  <td colspan="2" style="background-color:#3d5a80; padding:12px 18px;">
                    <span style="color:#ffffff; font-weight:bold; font-size:14px;">Detalles del Incidente</span>
                  </td>
                </tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; width:35%; border-bottom:1px solid #eef1f5;">ID</td><td style="padding:11px 18px; color:#222; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">${ticketCode}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Creador</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${creador}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Ubicación</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${piso} - ${habitacion}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Aparato</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${aparato}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Descripción</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${descripcion}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Fecha</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${fecha}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold;">Técnico Asignado</td><td style="padding:11px 18px; color:#3d5a80; font-size:13px; font-weight:bold;">${tecnicoAsignado || 'Sin asignar'}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align:center;">
              <p style="color:#555; font-size:14px; margin:0 0 15px 0;">Por favor, revisa el panel para tomar acción.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f0f4f8; padding:18px 30px; text-align:center; border-top:1px solid #e0e6ed;">
              <p style="margin:0; color:#aaa; font-size:12px;">Mensaje automático — Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Los tickets nuevos se notifican inmediatamente; quedan pendientes si SMTP falla.
    return enviarAvisoNuevoTicket(destinatarios, `🚨 Nuevo Incidente Reportado: ${ticketCode}`, htmlEmail);
}

function enviarEmailTicketResuelto(destinatario, ticketData) {
    if (!destinatario || destinatario.trim() === '' || destinatario.includes('@temp.com')) return;

    const { ticketCode, creador, aparato, descripcion, fechaCreacion, fechaResolucion, tecnico, resolucion } = ticketData;

    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#27ae60; padding: 25px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; letter-spacing:1px;">✅ Ticket Resuelto</h1>
              <p style="margin:8px 0 0 0; color:#d5f5e3; font-size:13px;">Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px 10px 30px;">
              <p style="margin:0; color:#555; font-size:15px;">Hola <strong>${creador}</strong>, tu incidente ha sido marcado como <strong>resuelto</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed; border-radius:6px; overflow:hidden;">
                <tr>
                  <td colspan="2" style="background-color:#27ae60; padding:12px 18px;">
                    <span style="color:#ffffff; font-weight:bold; font-size:14px;">Resumen del Ticket</span>
                  </td>
                </tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; width:35%; border-bottom:1px solid #eef1f5;">ID</td><td style="padding:11px 18px; color:#222; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">${ticketCode}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Aparato</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${aparato}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Descripción</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${descripcion}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Fecha apertura</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${fechaCreacion}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Fecha resolución</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${fechaResolucion}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Técnico</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${tecnico}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold;">Resolución</td><td style="padding:11px 18px; color:#27ae60; font-size:13px; font-weight:bold;">${resolucion}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f0f4f8; padding:18px 30px; text-align:center; border-top:1px solid #e0e6ed;">
              <p style="margin:0; color:#aaa; font-size:12px;">Mensaje automático — Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // RF-14: respeta la ventana operativa configurada por el administrador
    enviarCorreoOperativo(destinatario, `✅ Tu ticket ${ticketCode} ha sido resuelto`, htmlEmail);
}

// ── RF-18: Notificación al técnico cuando un ticket es reabierto ──
function enviarEmailTicketReabierto(destinatario, ticketData) {
    if (!destinatario || destinatario.trim() === '' || destinatario.includes('@temp.com')) return;

    const { ticketCode, creador, tecnico, justificacion, reaperturas } = ticketData;

    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#e67e22; padding: 25px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; letter-spacing:1px;">🔁 Ticket Reabierto</h1>
              <p style="margin:8px 0 0 0; color:#fdebd0; font-size:13px;">Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px 10px 30px;">
              <p style="margin:0; color:#555; font-size:15px;">Hola <strong>${tecnico}</strong>, el ticket <strong>${ticketCode}</strong> fue reabierto por <strong>${creador}</strong> porque la solución no fue efectiva.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed; border-radius:6px; overflow:hidden;">
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; width:35%; border-bottom:1px solid #eef1f5;">Ticket</td><td style="padding:11px 18px; color:#222; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">${ticketCode}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Reaperturas</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${reaperturas} / ${LIMITE_REAPERTURAS}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold;">Justificación</td><td style="padding:11px 18px; color:#333; font-size:13px;">${justificacion}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f0f4f8; padding:18px 30px; text-align:center; border-top:1px solid #e0e6ed;">
              <p style="margin:0; color:#aaa; font-size:12px;">Mensaje automático — Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // RF-14: respeta la ventana operativa configurada por el administrador
    enviarCorreoOperativo(destinatario, `🔁 El ticket ${ticketCode} fue reabierto`, htmlEmail);
}

function enviarNotificacionAdminDerivado(destinatario, ticketData) {
    if (!destinatario || destinatario.trim() === '' || destinatario.includes('@temp.com')) return;

    const { ticketCode, creador, aparato, descripcion, fecha, tecnicoAsignado } = ticketData;

    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#8e44ad; padding: 25px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; letter-spacing:1px;">🔔 Ticket Derivado a tu Equipo</h1>
              <p style="margin:8px 0 0 0; color:#e8d5f5; font-size:13px;">Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px 10px 30px;">
              <p style="margin:0; color:#555; font-size:15px;">Se ha derivado un nuevo incidente que requiere tu atención como administrador.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed; border-radius:6px; overflow:hidden;">
                <tr>
                  <td colspan="2" style="background-color:#8e44ad; padding:12px 18px;">
                    <span style="color:#ffffff; font-weight:bold; font-size:14px;">Detalles del Incidente Derivado</span>
                  </td>
                </tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; width:35%; border-bottom:1px solid #eef1f5;">ID</td><td style="padding:11px 18px; color:#222; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">${ticketCode}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Reportado por</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${creador}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Aparato</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${aparato}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Descripción</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${descripcion}</td></tr>
                <tr style="background-color:#f8fafc;"><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold; border-bottom:1px solid #eef1f5;">Fecha</td><td style="padding:11px 18px; color:#333; font-size:13px; border-bottom:1px solid #eef1f5;">${fecha}</td></tr>
                <tr><td style="padding:11px 18px; color:#888; font-size:13px; font-weight:bold;">Técnico asignado</td><td style="padding:11px 18px; color:#8e44ad; font-size:13px; font-weight:bold;">${tecnicoAsignado}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 25px 30px; text-align:center;">
              <p style="color:#555; font-size:14px; margin:0;">Accede al panel para hacer seguimiento de este incidente.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f0f4f8; padding:18px 30px; text-align:center; border-top:1px solid #e0e6ed;">
              <p style="margin:0; color:#aaa; font-size:12px;">Mensaje automático — Ticketera Clínica Aconcagua</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // RF-14: respeta la ventana operativa configurada por el administrador
    enviarCorreoOperativo(destinatario, `🔔 Ticket derivado: ${ticketCode}`, htmlEmail);
}

// ==========================================
// RUTAS — AUTH
// ==========================================

app.post('/registro', async (req, res) => {
    const { nombre, rut, correo, password } = req.body;
    if(typeof nombre!=='string'||!nombre.trim()||nombre.length>50||typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72||typeof correo!=='string'||!/^\S+@\S+\.\S+$/.test(correo)||correo.length>150)return res.status(400).json({error:'Revisa nombre, correo y contraseña (mínimo 8 caracteres).'});

    // Validación módulo 11 (backend) — nunca confiar solo en el frontend
    if (!validarRutModulo11(rut)) {
        return res.status(400).json({ error: 'RUT inválido', rutValido: false });
    }

    try {
        const [existing] = await pool.query('SELECT * FROM user WHERE rut = ?', [rut]);
        if (existing.length > 0) return res.status(400).json({ error: 'El RUT ya está registrado.' });

        const correoFinal = (correo && correo.trim() !== '') ? correo : `sin_correo_${Date.now()}@temp.com`;

        const [result] = await pool.query(
            `INSERT INTO user (first_name, first_last_name, second_last_name, institutional_email, rut, username, password_hash)
             VALUES (?, '', '', ?, ?, ?, ?)`,
            [nombre, correoFinal, rut, rut, await require('./passwords').hash(password)]
        );

        await pool.query(`INSERT INTO user_role (assignment_date, active, role_id, user_id) VALUES (NOW(), 1, 2, ?)`, [result.insertId]);

        res.json({ success: true, message: 'Usuario generado con exito' });
    } catch (error) {
        console.error("ERROR EN REGISTRO:", error);
        res.status(500).json({ error: 'Error en la base de datos' });
    }
});

// ==========================================
// VALIDAR RUT (solo validación, sin registrar)
// Devuelve: { valido: true,  mensaje: "RUT válido"   }
//           { valido: false, mensaje: "RUT inválido" }
// ==========================================
app.post('/validar-rut', (req, res) => {
    const { rut } = req.body;

    if (!rut || rut.trim() === '') {
        return res.status(400).json({ valido: false, mensaje: 'Debes ingresar un RUT.' });
    }

    const esValido = validarRutModulo11(rut.trim());

    if (esValido) {
        return res.json({ valido: true, mensaje: 'RUT válido' });
    } else {
        return res.json({ valido: false, mensaje: 'RUT inválido' });
    }
});

app.post('/login', async (req, res) => {
    const { rut, password } = req.body;

    if (!/^\d{7,9}-[\dkK]$/.test(rut)) return res.status(400).json({ error: 'rut invalido' });

    try {
        const [users] = await pool.query(
            `SELECT u.*, r.role_name
             FROM user u
             LEFT JOIN user_role ur ON u.user_id = ur.user_id
             LEFT JOIN role r ON ur.role_id = r.role_id
             WHERE u.rut = ? AND u.password_hash = ?`,
            [rut, password]
        );

        if (users.length > 0) {
            const usuario = users[0];
            const permisos = usuario.role_name === 'Admin' ? 'si' : 'no';
            const correoMostrar = usuario.institutional_email.includes('@temp.com') ? '' : usuario.institutional_email;

            const nuevoToken = crypto.randomBytes(32).toString('hex');
            await pool.query('UPDATE user SET session_token = ? WHERE user_id = ?', [nuevoToken, usuario.user_id]);

            res.json({
                success: true,
                message: `Bienvenido, ${usuario.first_name}!`,
                nombre: usuario.first_name,
                permisos: permisos,
                esCritico: usuario.is_critical_tech === 1,
                rut: usuario.rut,
                correo: correoMostrar,
                token: nuevoToken
            });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta o usuario no encontrado.' });
        }
    } catch (error) {
        console.error("ERROR EN LOGIN:", error);
        res.status(500).json({ error: 'Error en la base de datos' });
    }
});

app.post('/sesion/verificar', async (req, res) => {
    const { rut, token } = req.body;
    if (!rut || !token) return res.json({ valida: false });

    try {
        const user = req.security.user;
        const valida = user.rut === rut && user.session_token === token;
        res.json(valida ? {
            valida: true,
            user_id: user.user_id,
            permisos: req.security.admin ? 'si' : 'no',
            esCritico: !!user.is_critical_tech,
            esTecnico: user.tipo_usuario === 'TECNICO'
        } : { valida: false });
    } catch (error) {
        console.error("ERROR VERIFICANDO SESION:", error);
        res.json({ valida: false });
    }
});

app.post('/sesion/cerrar', async (req, res) => {
    const { rut, token } = req.body;
    if (!rut || !token) return res.json({ success: true });

    try {
        await pool.query(
            'UPDATE user SET session_token = NULL WHERE rut = ? AND session_token = ?',
            [rut, token]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR CERRANDO SESION:", error);
        res.json({ success: true });
    }
});

// ==========================================
// RECUPERAR CONTRASEÑA
// ==========================================
// ==========================================
// EDITAR PERFIL
// ==========================================
app.post('/editar-perfil', async (req, res) => {
    const { rut, nombre, correo, passwordActual, passwordNueva, codigo } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM user WHERE rut = ?', [rut]);
        if (users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        const usuario = users[0];

        if (passwordNueva && passwordNueva.trim() !== '') {
            if (codigo && codigo.trim() !== '') {
                if (!codigosRecuperacion[rut] || codigosRecuperacion[rut] !== codigo) {
                    return res.status(400).json({ error: 'Código incorrecto o expirado.' });
                }
                delete codigosRecuperacion[rut];
            } else if (passwordActual && passwordActual.trim() !== '') {
                if (usuario.password_hash !== passwordActual) return res.status(400).json({ error: 'Contraseña actual incorrecta.' });
            } else {
                return res.status(400).json({ error: 'Proporciona la contraseña actual o un código.' });
            }
            await pool.query('UPDATE user SET password_hash = ? WHERE rut = ?', [passwordNueva, rut]);
        }

        const correoFinal = (correo && correo.trim() !== '') ? correo : `sin_correo_${Date.now()}@temp.com`;
        await pool.query('UPDATE user SET first_name = ?, institutional_email = ? WHERE rut = ?', [nombre, correoFinal, rut]);
        res.json({ success: true, message: 'Perfil actualizado.' });
    } catch (error) {
        res.status(500).json({ error: 'Error en la base de datos' });
    }
});

// ==========================================
// GET /incidentes
// Devuelve SOLO tickets ACTIVOS (Pendiente / En curso / En espera)
// Para todos los usuarios (el frontend filtra por permisos para mostrar)
// ==========================================
app.get('/incidentes', async (req, res) => {
    const usuario = req.security.user.first_name;
    try {
        const query = `
            SELECT
                t.ticket_id,
                t.ticket_code as id_ticket,
                t.ticket_origin,
                t.requester_user_id,
                u.first_name as creador,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y, %H:%i:%s') as fecha,
                t.description as descripcion,
                t.title,
                s.status_name as estado,
                e.equipment_name as aparato,
                e.location as habitacion_original,
                t.assigned_user_id,
                au.first_name as tecnico_asignado,
                t.notify_creator as notificacion_creador,
                t.reopen_count as reaperturas,
                t.piso_ticket, t.habitacion_ticket, t.sla_deadline, t.priority_id as ticket_priority_id,
                t.alerta_75_enviada, t.auto_cerrado
            FROM ticket t
            LEFT JOIN user u ON t.requester_user_id = u.user_id
            LEFT JOIN status s ON t.status_id = s.status_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            LEFT JOIN user au ON t.assigned_user_id = au.user_id
            WHERE t.is_archived=0 AND t.status_id IN (1, 2, 5) AND (? = 1 OR t.requester_user_id = ? OR t.assigned_user_id = ?)
            ORDER BY t.ticket_id DESC
        `;

        const [tickets] = await pool.query(query, [req.security.soporte ? 1 : 0, req.security.user.user_id, req.security.user.user_id]);

        for (let ticket of tickets) {
            await buildTicketFromRow(ticket, usuario, req.security.soporte);
        }

        res.json(tickets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo incidentes' });
    }
});

// ==========================================
// GET /incidentes/cerrados
// Devuelve TODOS los tickets cerrados (Resuelto / Cancelado) desde la BD.
// Admin: todos. Usuario normal: solo los suyos.
// ==========================================
app.get('/incidentes/cerrados', async (req, res) => {
    const { usuario, esAdmin } = req.query;
    const esAdminBool = esAdmin === 'si';

    try {
        let query = `
            SELECT
                t.ticket_id,
                t.ticket_code as id_ticket,
                t.ticket_origin,
                t.requester_user_id,
                u.first_name as creador,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y, %H:%i:%s') as fecha,
                t.description as descripcion,
                t.title,
                s.status_name as estado,
                e.equipment_name as aparato,
                e.location as habitacion_original,
                t.assigned_user_id,
                au.first_name as tecnico_asignado,
                t.notify_creator as notificacion_creador,
                t.reopen_count as reaperturas,
                t.piso_ticket, t.habitacion_ticket, t.sla_deadline, t.priority_id as ticket_priority_id,
                t.alerta_75_enviada, t.auto_cerrado
            FROM ticket t
            LEFT JOIN user u ON t.requester_user_id = u.user_id
            LEFT JOIN status s ON t.status_id = s.status_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            LEFT JOIN user au ON t.assigned_user_id = au.user_id
            WHERE t.is_archived=0 AND t.status_id IN (3, 4, 6)
        `;

        const params = [];

        if (!esAdminBool) {
            query += ` AND (t.requester_user_id = ? OR t.assigned_user_id = ?)`;
            params.push(req.security.user.user_id, req.security.user.user_id);
        }

        query += ` ORDER BY t.ticket_id DESC`;

        const [tickets] = await pool.query(query, params);

        for (let ticket of tickets) {
            await buildTicketFromRow(ticket, usuario, req.security.soporte);
        }

        res.json(tickets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo historial' });
    }
});

// ==========================================
// GET /incidentes/buscar
// Búsqueda en TODOS los tickets activos desde la BD.
// ==========================================
app.get('/incidentes/buscar', async (req, res) => {
    const { q, usuario } = req.query;
    if (!q || q.trim() === '') return res.json([]);

    const termino = `%${q.trim()}%`;

    try {
        const query = `
            SELECT
                t.ticket_id,
                t.ticket_code as id_ticket,
                t.ticket_origin,
                t.requester_user_id,
                u.first_name as creador,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y, %H:%i:%s') as fecha,
                t.description as descripcion,
                t.title,
                s.status_name as estado,
                e.equipment_name as aparato,
                e.location as habitacion_original,
                t.assigned_user_id,
                au.first_name as tecnico_asignado,
                t.notify_creator as notificacion_creador,
                t.reopen_count as reaperturas,
                t.piso_ticket, t.habitacion_ticket, t.sla_deadline, t.priority_id as ticket_priority_id,
                t.alerta_75_enviada, t.auto_cerrado
            FROM ticket t
            LEFT JOIN user u ON t.requester_user_id = u.user_id
            LEFT JOIN status s ON t.status_id = s.status_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            LEFT JOIN user au ON t.assigned_user_id = au.user_id
            WHERE t.is_archived=0 AND t.status_id IN (1, 2, 5) AND (? = 1 OR t.requester_user_id = ? OR t.assigned_user_id = ?)
              AND (
                t.ticket_code LIKE ? OR
                u.first_name LIKE ? OR
                e.equipment_name LIKE ? OR
                t.description LIKE ?
              )
            ORDER BY t.ticket_id DESC
        `;

        const [tickets] = await pool.query(query, [req.security.soporte ? 1 : 0, req.security.user.user_id, req.security.user.user_id, termino, termino, termino, termino]);

        for (let ticket of tickets) {
            await buildTicketFromRow(ticket, usuario, req.security.soporte);
        }

        res.json(tickets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

// ==========================================
// GET /estadisticas
// ==========================================
app.get('/estadisticas', async (req, res) => {
    try {
        const [ticketsTotales] = await pool.query(`
            SELECT
                t.title,
                s.status_name as estado,
                e.equipment_name as aparato,
                u.first_name as creador,
                DATE_FORMAT(t.creation_date, '%Y-%m-%d') as fecha_dia,
                YEARWEEK(t.creation_date, 1) as semana
            FROM ticket t
            LEFT JOIN status s ON t.status_id = s.status_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            LEFT JOIN user u ON t.requester_user_id = u.user_id
        `);

        const porAparato = {};
        const porCreador = {};
        const porEstado  = {};
        const porPiso    = {};
        const porSemana  = {};

        const estadoNormalizar = (e) => e === 'Cerrado' ? 'Resuelto' : (e || 'En curso');

        ticketsTotales.forEach(t => {
            const estado = estadoNormalizar(t.estado);

            const ap = t.aparato || 'Desconocido';
            porAparato[ap] = (porAparato[ap] || 0) + 1;

            const cr = t.creador || 'Anónimo';
            porCreador[cr] = (porCreador[cr] || 0) + 1;

            porEstado[estado] = (porEstado[estado] || 0) + 1;

            let piso = 'Sin info';
            if (t.title && t.title.startsWith('Incidente en ')) {
                const partes = t.title.replace('Incidente en ', '').split(' - ');
                piso = partes[0] ? partes[0].trim() : 'Sin info';
            }
            porPiso[piso] = (porPiso[piso] || 0) + 1;

            if (estado === 'Resuelto' && t.semana) {
                porSemana[t.semana] = (porSemana[t.semana] || 0) + 1;
            }
        });

        const semanasOrdenadas = Object.entries(porSemana)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-8);

        res.json({
            porAparato,
            porCreador,
            porEstado,
            porPiso,
            semanasResueltas: semanasOrdenadas.map(([semana, total]) => ({
                semana: `Sem. ${semana.slice(4)}/${semana.slice(0, 4)}`,
                total
            }))
        });
    } catch (error) {
        console.error('Error estadísticas:', error);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// ==========================================
// POST /incidente/ver
// ==========================================
app.post('/incidente/ver', async (req, res) => {
    const { id_ticket, usuario } = req.body;
    try {
        const [tickets] = await pool.query(
            `SELECT t.ticket_id, t.status_id, t.notify_creator,
                    au.first_name as tecnico_nombre,
                    cu.first_name as creador_nombre
             FROM ticket t
             LEFT JOIN user au ON t.assigned_user_id = au.user_id
             LEFT JOIN user cu ON t.requester_user_id = cu.user_id
             WHERE t.ticket_code = ?`,
            [id_ticket]
        );
        if (tickets.length === 0) return res.json({ cambio: false, notifLimpiada: false });

        const ticket = tickets[0];
        let cambio = false;
        let nuevoEstado = null;
        let notifLimpiada = false;

        if (ticket.status_id === 5 && ticket.tecnico_nombre === usuario) {
            await pool.query('UPDATE ticket SET status_id = 1 WHERE ticket_id = ?', [ticket.ticket_id]);

            const [users] = await pool.query('SELECT user_id FROM user WHERE first_name = ? LIMIT 1', [usuario]);
            const userId = users.length > 0 ? users[0].user_id : 1;

            const comentarioCambio = textoEstado(5, 1, usuario);
            await pool.query(
                'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
                [comentarioCambio, userId, ticket.ticket_id]
            );

            cambio = true;
            nuevoEstado = 'En curso';
        }

        if (ticket.notify_creator === 1 && ticket.creador_nombre === usuario) {
            await pool.query('UPDATE ticket SET notify_creator = 0 WHERE ticket_id = ?', [ticket.ticket_id]);
            notifLimpiada = true;
        }

        res.json({ cambio, nuevoEstado, notifLimpiada });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error procesando vista' });
    }
});

// ==========================================
// POST /incidente
// ==========================================
app.post('/incidente', async (req, res) => {
    const { creador, piso, habitacion, aparato, descripcion, nombreActivo } = req.body;
    // ── RF-06: categoría (derivada del aparato) y prioridad elegida en el formulario ──
    const categoryId = parseInt(req.body.category_id, 10) || 1;
    const priorityId = parseInt(req.body.priority_id, 10) || 1;

    // ── Validación: la descripción no puede tener menos de 10 caracteres ──
    if (!descripcion || descripcion.trim().length < 10) {
        return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres.' });
    }

    try {
        // ── RF-22: el sistema consulta la configuración global para validar la modalidad ──
        const [configRows] = await pool.query('SELECT modalidad_atencion FROM system_config WHERE config_id = 1');
        const modalidad = configRows.length > 0 ? configRows[0].modalidad_atencion : 'Presencial';
        const ubicacionRequerida = modalidad !== 'Remota';

        // Excepción: Campo vacío → el sistema bloquea la creación del ticket y despliega alerta específica
        if (ubicacionRequerida && (!piso || !piso.trim() || !habitacion || !habitacion.trim())) {
            return res.status(400).json({ error: 'La ubicación (piso y habitación) es obligatoria para crear el ticket.' });
        }

        // ── RF-23: el nombre del activo es obligatorio solo para categorías Hardware (1) o Red (5) ──
        if ((categoryId === 1 || categoryId === 5) && (!nombreActivo || !nombreActivo.trim())) {
            return res.status(400).json({ error: 'Debes indicar el nombre del activo/equipo para esta categoría.' });
        }

        const users = [{user_id:req.actor.user_id}];
        if (!users.length) return res.status(400).json({ error: 'No se encontró el solicitante. Vuelve a iniciar sesión.' });
        const userId = users[0].user_id;

        // ── RF-23: se busca el activo en la base histórica; si no existe, se crea (estandariza nomenclatura) ──
        let equipId;
        const nombreEquipoBuscado = (nombreActivo && nombreActivo.trim()) ? nombreActivo.trim() : aparato;
        const [equipos] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_name = ? LIMIT 1', [nombreEquipoBuscado]);
        if (equipos.length > 0) {
            equipId = equipos[0].equipment_id;
        } else {
            const [nuevoEquipo] = await pool.query(
                'INSERT INTO equipment (equipment_name, location, equipment_type) VALUES (?, ?, ?)',
                [nombreEquipoBuscado, habitacion || null, aparato || 'Otro']
            );
            equipId = nuevoEquipo.insertId;
        }

let ticketCode;

        let tecnico;
        const assignmentConnection=await pool.getConnection();
        try{
        await assignmentConnection.beginTransaction();
        tecnico=await inc3.assign(categoryId,priorityId,assignmentConnection);
        const [[lastCode]]=await assignmentConnection.query("SELECT MAX(CAST(SUBSTRING(ticket_code,4) AS UNSIGNED)) maxCode FROM ticket WHERE ticket_code LIKE 'INC%'");
        ticketCode='INC'+String((lastCode.maxCode||0)+1).padStart(7,'0');
        const tecnicoId = tecnico ? tecnico.user_id : null;


        // ── RF-21: fecha límite de SLA, calculada según la prioridad elegida ──
        const [prioridadRows] = await pool.query('SELECT sla_hours FROM priority WHERE priority_id = ?', [priorityId]);
        const slaHoras = prioridadRows.length > 0 ? prioridadRows[0].sla_hours : 24;

        await assignmentConnection.query(`
            INSERT INTO ticket (ticket_code, title, description, ticket_origin, requester_user_id, category_id, status_id, priority_id, equipment_id, assigned_user_id, piso_ticket, habitacion_ticket, sla_deadline)
            VALUES (?, ?, ?, 'web', ?, ?, 5, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
        `, [ticketCode, `Incidente en ${piso} - ${habitacion}`, descripcion, userId, categoryId, priorityId, equipId, tecnicoId, piso || null, habitacion || null, slaHoras]);

        await assignmentConnection.commit();
        }catch(e){await assignmentConnection.rollback();throw e;}finally{assignmentConnection.release();}
        const tecnicoNombre=tecnico?.first_name||'Sin asignar';

        const ahora = new Date();
        const fechaFormateada = ahora.toLocaleDateString('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        const ticketDataEmail = {
            ticketCode,
            creador,
            piso,
            habitacion,
            aparato,
            descripcion,
            fecha: fechaFormateada,
            tecnicoAsignado: tecnicoNombre
        };

        const [admins] = await pool.query(`
            SELECT u.institutional_email FROM user u JOIN user_role ur ON u.user_id = ur.user_id
            JOIN role r ON ur.role_id = r.role_id WHERE r.role_name = 'Admin' AND ur.active = 1 AND u.user_status = 1 AND u.institutional_email NOT LIKE '%@temp.com'
        `);

        const correosAdmins = admins.map(a => a.institutional_email).join(', ');
        await enviarEmailNuevoTicket(correosAdmins, ticketDataEmail);

        for (const admin of admins) {
            enviarNotificacionAdminDerivado(admin.institutional_email, ticketDataEmail);
        }

        res.json({ success: true, message: `¡Ticket ${ticketCode} generado con éxito! Asignado a: ${tecnicoNombre}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error creando ticket' });
    }
});

// ==========================================
// POST /incidente/comentar
// ==========================================
const uploadMiddleware = (req,res,cb)=>multer({storage,limits:{fileSize:inc3.config.upload_mb*1024*1024}}).single('archivo')(req,res,cb);

app.post('/incidente/comentar', (req, res) => {
    uploadMiddleware(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo excede el límite de '+inc3.config.upload_mb+' MB.' });
            }
            return res.status(500).json({ error: err.message });
        } else if (err) {
            return res.status(500).json({ error: 'Error al subir el archivo.' });
        }

        const { id_ticket, texto } = req.body;
        const usuario=req.actor.first_name;
        const file = req.file;

        try {
            const [tickets] = await pool.query('SELECT ticket_id, requester_user_id,assigned_user_id,is_archived FROM ticket WHERE ticket_code = ?', [id_ticket]);
            if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
            if(tickets[0].is_archived||(!req.actor.admin&&!req.actor.is_critical_tech&&tickets[0].requester_user_id!==req.actor.user_id&&tickets[0].assigned_user_id!==req.actor.user_id)){if(file)fs.unlinkSync(file.path);return res.status(403).json({error:'Ticket de solo lectura o sin acceso.'});}
            const ticketId = tickets[0].ticket_id;
            const requesterUserId = tickets[0].requester_user_id;

            const [users] = await pool.query('SELECT user_id FROM user WHERE first_name = ? LIMIT 1', [usuario]);
            const userId = req.actor.user_id;

            let comentarioFinal = require('sanitize-html')(texto || '',{allowedTags:[],allowedAttributes:{}});

            if (file) {
                const filePath = '/uploads/' + file.filename;
                const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);

                await pool.query(
                    'INSERT INTO attachment (file_name, file_path, mime_type, file_size_mb, upload_by_user_id, ticket_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [file.originalname, filePath, file.mimetype, fileSizeMb, userId, ticketId]
                );

                let fileHtml = `<a href="${filePath}" target="_blank" style="color: #007bff; font-weight: bold; text-decoration: underline;">📎 Descargar: ${file.originalname.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</a>`;

                if (file.mimetype.startsWith('image/')) {
                    fileHtml += `<br><img src="${filePath}" style="max-width: 100%; max-height: 250px; margin-top: 10px; border-radius: 6px; border: 1px solid #ccc;">`;
                }

                if (comentarioFinal !== '') comentarioFinal += '\n\n';
                comentarioFinal += fileHtml;
            }

            await pool.query('INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)', [comentarioFinal, userId, ticketId]);

            await marcarNotificacionCreador(ticketId, requesterUserId, userId);

            const comments = await obtenerComentariosParaViewer(ticketId, usuario, req.security.soporte);

            res.json({ success: true, comentarios: comments });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error procesando comentario' });
        }
    });
});

// ==========================================
// HELPER: Procesar acción de ticket
// ==========================================
async function procesarAccionTicket(ticketCode, usuarioNombre, estadoAnteriorId, nuevoEstadoId, comentarioTexto, res) {
    try {
        const [tickets] = await pool.query('SELECT ticket_id, status_id, requester_user_id FROM ticket WHERE ticket_code = ?', [ticketCode]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticketId = tickets[0].ticket_id;
        const estadoPrevio = estadoAnteriorId || tickets[0].status_id;
        const requesterUserId = tickets[0].requester_user_id;

        const [users] = await pool.query('SELECT user_id FROM user WHERE first_name = ? LIMIT 1', [usuarioNombre]);
        const userId = users.length > 0 ? users[0].user_id : 1;

        if (nuevoEstadoId) {
            await pool.query('UPDATE ticket SET status_id = ? WHERE ticket_id = ?', [nuevoEstadoId, ticketId]);
        }

        await pool.query('INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)', [comentarioTexto, userId, ticketId]);

        if (nuevoEstadoId && nuevoEstadoId !== estadoPrevio) {
            const bitacora = textoEstado(estadoPrevio, nuevoEstadoId, usuarioNombre);
            await pool.query('INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)', [bitacora, userId, ticketId]);
        }

        await marcarNotificacionCreador(ticketId, requesterUserId, userId);

        const comments = await obtenerComentariosParaViewer(ticketId, usuarioNombre);

        res.json({ success: true, comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error procesando acción' });
    }
}

// ==========================================
// ACCIONES DE TICKETS
// ==========================================
app.post('/incidente/espera', async (req, res) => {
    const { id_ticket, usuario, info_espera } = req.body;
    // Excepción: Pausa sin motivo → el sistema exige la justificación obligatoria
    if (!info_espera || !info_espera.trim()) {
        return res.status(400).json({ error: 'Debes indicar el motivo de la pausa.' });
    }
    try {
        // El sistema detiene el conteo de tiempo del SLA (se marca el inicio de la pausa)
        await pool.query('UPDATE ticket SET pausa_inicio = COALESCE(pausa_inicio, NOW()) WHERE ticket_code = ?', [id_ticket]);
    } catch (e) { console.error('Error marcando inicio de pausa:', e); }
    procesarAccionTicket(id_ticket, usuario, null, 2, `⏸️ TICKET EN ESPERA.\nMotivo: ${info_espera.trim()}`, res);
});

app.post('/incidente/continuar', async (req, res) => {
    const { id_ticket, usuario } = req.body;
    try {
        // Se descuenta del SLA el tiempo que estuvo pausado (no cuenta como vencido injustificadamente)
        const [tickets] = await pool.query('SELECT ticket_id, pausa_inicio FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length > 0 && tickets[0].pausa_inicio) {
            await pool.query(
                `UPDATE ticket SET sla_deadline = DATE_ADD(sla_deadline, INTERVAL TIMESTAMPDIFF(SECOND, pausa_inicio, NOW()) SECOND), pausa_inicio = NULL
                 WHERE ticket_id = ?`,
                [tickets[0].ticket_id]
            );
        }
    } catch (e) { console.error('Error descontando tiempo de pausa del SLA:', e); }
    procesarAccionTicket(id_ticket, usuario, null, 1, `▶️ TICKET RETOMADO.`, res);
});

app.post('/incidente/cancelar', (req, res) => {
    const { id_ticket, usuario, info_cancelar } = req.body;
    procesarAccionTicket(id_ticket, usuario, null, 3, `🚫 TICKET CANCELADO.\nMotivo: ${info_cancelar}`, res);
});

app.post('/incidente/resolver', async (req, res) => {
    const { id_ticket, usuario, info_resolucion } = req.body;

    try {
        const [tickets] = await pool.query(`
            SELECT
                t.ticket_id, t.status_id, t.description, t.requester_user_id,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y, %H:%i:%s') as fecha_creacion,
                u_creador.first_name as creador_nombre,
                u_creador.institutional_email as creador_email,
                e.equipment_name as aparato,
                u_tecnico.first_name as tecnico_nombre
            FROM ticket t
            LEFT JOIN user u_creador ON t.requester_user_id = u_creador.user_id
            LEFT JOIN user u_tecnico ON t.assigned_user_id = u_tecnico.user_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            WHERE t.ticket_code = ?
        `, [id_ticket]);

        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        const [users] = await pool.query('SELECT user_id FROM user WHERE first_name = ? LIMIT 1', [usuario]);
        const userId = users.length > 0 ? users[0].user_id : 1;

        const estadoPrevio = ticket.status_id;

        // ── RF-12: se registra resolution_date para poder calcular el MTTR ──
        await pool.query('UPDATE ticket SET status_id = 4, resolution_date = NOW() WHERE ticket_id = ?', [ticket.ticket_id]);

        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`✅ TICKET RESUELTO.\nResolución: ${info_resolucion}`, userId, ticket.ticket_id]
        );

        const bitacora = textoEstado(estadoPrevio, 4, usuario);
        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [bitacora, userId, ticket.ticket_id]
        );

        await marcarNotificacionCreador(ticket.ticket_id, ticket.requester_user_id, userId);

        const fechaResolucion = new Date().toLocaleDateString('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        enviarEmailTicketResuelto(ticket.creador_email, {
            ticketCode: id_ticket,
            creador: ticket.creador_nombre,
            aparato: ticket.aparato,
            descripcion: ticket.description,
            fechaCreacion: ticket.fecha_creacion,
            fechaResolucion: fechaResolucion,
            tecnico: ticket.tecnico_nombre || usuario,
            resolucion: info_resolucion
        });

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, usuario, req.security.soporte);

        res.json({ success: true, comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error resolviendo ticket' });
    }
});

app.post('/incidente/cerrar', async (req, res) => {
    req.body.info_resolucion = req.body.info_cierre || req.body.info_resolucion || '';
    const { id_ticket, usuario, info_resolucion } = req.body;

    try {
        const [tickets] = await pool.query(`
            SELECT
                t.ticket_id, t.status_id, t.description, t.requester_user_id,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y, %H:%i:%s') as fecha_creacion,
                u_creador.first_name as creador_nombre,
                u_creador.institutional_email as creador_email,
                e.equipment_name as aparato,
                u_tecnico.first_name as tecnico_nombre
            FROM ticket t
            LEFT JOIN user u_creador ON t.requester_user_id = u_creador.user_id
            LEFT JOIN user u_tecnico ON t.assigned_user_id = u_tecnico.user_id
            LEFT JOIN equipment e ON t.equipment_id = e.equipment_id
            WHERE t.ticket_code = ?
        `, [id_ticket]);

        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        const [users] = await pool.query('SELECT user_id FROM user WHERE first_name = ? LIMIT 1', [usuario]);
        const userId = users.length > 0 ? users[0].user_id : 1;
        const estadoPrevio = ticket.status_id;

        // ── RF-12: se registra resolution_date para poder calcular el MTTR ──
        await pool.query('UPDATE ticket SET status_id = 4, resolution_date = NOW() WHERE ticket_id = ?', [ticket.ticket_id]);
        await pool.query('INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`✅ TICKET RESUELTO.\nResolución: ${info_resolucion}`, userId, ticket.ticket_id]);

        const bitacora = textoEstado(estadoPrevio, 4, usuario);
        await pool.query('INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [bitacora, userId, ticket.ticket_id]);

        await marcarNotificacionCreador(ticket.ticket_id, ticket.requester_user_id, userId);

        const fechaResolucion = new Date().toLocaleDateString('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        enviarEmailTicketResuelto(ticket.creador_email, {
            ticketCode: id_ticket,
            creador: ticket.creador_nombre,
            aparato: ticket.aparato,
            descripcion: ticket.description,
            fechaCreacion: ticket.fecha_creacion,
            fechaResolucion,
            tecnico: ticket.tecnico_nombre || usuario,
            resolucion: info_resolucion
        });

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, usuario, req.security.soporte);

        res.json({ success: true, comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error resolviendo ticket' });
    }
});

// ==========================================
// RF-23 — AUTOCOMPLETADO DEL NOMBRE DEL ACTIVO
// ==========================================
app.get('/equipos/sugerencias', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json([]);

    try {
        // El sistema activa el motor de autocompletado consultando la base histórica
        const [equipos] = await pool.query(
            'SELECT DISTINCT equipment_name FROM equipment WHERE equipment_name LIKE ? ORDER BY equipment_name ASC LIMIT 8',
            [`%${q.trim()}%`]
        );
        res.json(equipos.map(e => e.equipment_name));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo sugerencias de activos' });
    }
});

// RF-64: variante que además devuelve el equipment_id, para poder generar el QR del activo elegido
app.get('/equipos/sugerencias-completas', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json([]);

    try {
        const [equipos] = await pool.query(
            'SELECT equipment_id, equipment_name FROM equipment WHERE equipment_name LIKE ? ORDER BY equipment_name ASC LIMIT 8',
            [`%${q.trim()}%`]
        );
        res.json(equipos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo sugerencias de activos' });
    }
});

// ==========================================
// RF-05 — PRIORIDADES Y SLA
// ==========================================
function validarDatosPrioridad(priority_name, sla_hours, color_hex) {
    if (!priority_name || typeof priority_name !== 'string' || priority_name.trim() === '') {
        return 'El nombre de la prioridad es obligatorio.';
    }
    // Validación de formato numérico
    if (sla_hours === undefined || sla_hours === null || sla_hours === '' || isNaN(Number(sla_hours))) {
        return 'El tiempo de SLA debe ser un valor numérico.';
    }
    if (!Number.isInteger(Number(sla_hours))) {
        return 'El tiempo de SLA debe ser un número entero de horas.';
    }
    // Excepción: Tiempo negativo → el sistema bloquea la actualización
    if (Number(sla_hours) <= 0) {
        return 'El tiempo de SLA no puede ser negativo ni cero.';
    }
    if (color_hex && !/^#[0-9A-Fa-f]{6}$/.test(color_hex)) {
        return 'El color debe tener formato hexadecimal (ej: #3d5a80).';
    }
    return null;
}

app.get('/prioridades', async (req, res) => {
    try {
        const [prioridades] = await pool.query(
            'SELECT priority_id, priority_name, sla_hours, color_hex FROM priority ORDER BY sla_hours ASC'
        );
        res.json(prioridades);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo prioridades' });
    }
});

app.post('/prioridades', async (req, res) => {
    const { priority_name, sla_hours, color_hex } = req.body;

    const errorValidacion = validarDatosPrioridad(priority_name, sla_hours, color_hex);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const colorFinal = color_hex || '#3d5a80';
        const [resultado] = await pool.query(
            'INSERT INTO priority (priority_name, sla_hours, color_hex) VALUES (?, ?, ?)',
            [priority_name.trim(), Number(sla_hours), colorFinal]
        );
        res.json({
            success: true,
            message: `Prioridad "${priority_name.trim()}" configurada correctamente.`,
            priority_id: resultado.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error creando la prioridad' });
    }
});

app.put('/prioridades/:id', async (req, res) => {
    const { id } = req.params;
    const { priority_name, sla_hours, color_hex } = req.body;

    const errorValidacion = validarDatosPrioridad(priority_name, sla_hours, color_hex);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const colorFinal = color_hex || '#3d5a80';
        // El sistema actualiza la matriz normativa de tiempos
        await pool.query(
            'UPDATE priority SET priority_name = ?, sla_hours = ?, color_hex = ? WHERE priority_id = ?',
            [priority_name.trim(), Number(sla_hours), colorFinal, id]
        );
        res.json({ success: true, message: 'Configuración de prioridad y SLA actualizada correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando la prioridad' });
    }
});

// ==========================================
// RF-06 — MATRIZ CATEGORÍA VS PRIORIDAD Y TÉCNICO CRÍTICO
// ==========================================
app.get('/categorias', async (req, res) => {
    try {
        const [categorias] = await pool.query('SELECT category_id, category_name FROM category ORDER BY category_id ASC');
        res.json(categorias);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo categorías' });
    }
});

app.get('/tecnicos', async (req, res) => {
    try {
        const [tecnicos] = await pool.query(`
            SELECT DISTINCT u.user_id, u.first_name, u.is_critical_tech
            FROM user u
            JOIN user_role ur ON u.user_id = ur.user_id
            WHERE ur.active = 1 AND u.user_status = 1
              AND (ur.role_id = 1 OR u.is_critical_tech = 1 OR u.tipo_usuario = 'TECNICO')
            ORDER BY u.first_name ASC
        `);
        res.json(tecnicos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo técnicos' });
    }
});

app.put('/tecnicos/:id/critico', async (req, res) => {
    const { id } = req.params;
    const { critico } = req.body;

    if (!Number.isInteger(Number(id)) || Number(id) < 1 || typeof critico !== 'boolean') return res.status(400).json({ error: 'Indica un técnico válido y un estado verdadero o falso.' });
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Bloquea el catálogo para que dos cambios concurrentes no creen dos fallbacks.
        await connection.query('SELECT user_id FROM user ORDER BY user_id FOR UPDATE');
        const [selected] = await connection.query("SELECT u.user_id FROM user u WHERE u.user_id=? AND u.user_status=1 AND (u.tipo_usuario='TECNICO' OR EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.active=1 AND r.role_id=1))", [id]);
        if (!selected.length) return res.status(404).json({ error: 'Técnico activo no encontrado.' });
        if (critico) {
            // Solo puede existir un Técnico Crítico a la vez (fallback único)
            await connection.query('UPDATE user SET is_critical_tech = 0 WHERE is_critical_tech = 1');
            await connection.query('UPDATE user SET is_critical_tech = 1 WHERE user_id = ?', [id]);
        } else {
            await connection.query('UPDATE user SET is_critical_tech = 0 WHERE user_id = ?', [id]);
        }
        await connection.commit();
        res.json({ success: true, message: 'Técnico Crítico actualizado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando Técnico Crítico' });
    } finally { await connection.rollback(); connection.release(); }
});

app.get('/matriz-categorias', async (req, res) => {
    try {
        const [matriz] = await pool.query(`
            SELECT cpm.matrix_id, cpm.category_id, c.category_name, cpm.priority_id, p.priority_name,
                   cpm.preferred_user_id, u.first_name as tecnico_preferido
            FROM category_priority_matrix cpm
            JOIN category c ON cpm.category_id = c.category_id
            JOIN priority p ON cpm.priority_id = p.priority_id
            LEFT JOIN user u ON cpm.preferred_user_id = u.user_id
        `);
        res.json(matriz);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo la matriz de categorías' });
    }
});

app.post('/matriz-categorias', async (req, res) => {
    const { category_id, priority_id, preferred_user_id } = req.body;

    if (!category_id || !priority_id) {
        return res.status(400).json({ error: 'Debes indicar categoría y prioridad.' });
    }

    try {
        // El sistema evalúa la matriz de Categoría vs Prioridad — se guarda el técnico idóneo
        await pool.query(`
            INSERT INTO category_priority_matrix (category_id, priority_id, preferred_user_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE preferred_user_id = VALUES(preferred_user_id)
        `, [category_id, priority_id, preferred_user_id || null]);

        res.json({ success: true, message: 'Matriz de asignación actualizada correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando la matriz de categorías' });
    }
});

// ==========================================
// RF-12 — REPORTES Y KPIs
// ==========================================
app.get('/reportes/kpi', async (req, res) => {
    const { desde, hasta, area, priority_id } = req.query;

    try {
        let where = 'WHERE t.status_id IN (4,6) AND t.resolution_date IS NOT NULL';
        const params = [];

        if (desde) {
            where += ' AND t.creation_date >= ?';
            params.push(`${desde} 00:00:00`);
        }
        if (hasta) {
            where += ' AND t.creation_date <= ?';
            params.push(`${hasta} 23:59:59`);
        }
        if (area) {
            where += " AND t.title LIKE ?";
            params.push(`Incidente en ${area}%`);
        }
        if (priority_id) {
            where += ' AND t.priority_id = ?';
            params.push(priority_id);
        }

        const [filas] = await pool.query(`
            SELECT
                t.ticket_id,
                p.priority_id,
                p.priority_name,
                p.sla_hours,
                p.color_hex,
                TIMESTAMPDIFF(MINUTE, t.creation_date, t.resolution_date) as minutos_resolucion,
                (t.resolution_date <= COALESCE(t.sla_deadline, DATE_ADD(t.creation_date, INTERVAL p.sla_hours HOUR))) as cumple_sla
            FROM ticket t
            JOIN priority p ON t.priority_id = p.priority_id
            ${where}
        `, params);

        // Excepción: Sin datos en el periodo → el sistema despliega un mensaje informativo
        if (filas.length === 0) {
            return res.json({ sinDatos: true, totalTickets: 0, mttrHoras: 0, cumplimientoSlaPct: 0, porPrioridad: [] });
        }

        res.json(new (require('./reports').ReporteKPI)().generar(filas));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el reporte de KPIs' });
    }
});

// ==========================================
// RF-13 — EXPORTANDO INFORMACIÓN CONSOLIDADA
// ==========================================
app.post('/reportes/exportar', async (req, res) => {
    const { usuario, formato, desde, hasta, area, priority_id } = req.body;

    try {
        // El sistema valida los permisos del actor (Administrador o Técnico Crítico)
        const esAdmin = req.security.admin;
        const esCritico = req.security.user.is_critical_tech === 1;

        if (!esAdmin && !esCritico) {
            return res.status(403).json({ error: 'No tienes permisos para exportar reportes.' });
        }

        if (!['excel', 'csv', 'pdf'].includes(formato)) {
            return res.status(400).json({ error: 'Formato no soportado.' });
        }

        let where = 'WHERE t.status_id IN (4,6) AND t.resolution_date IS NOT NULL';
        const params = [];
        if (desde) { where += ' AND t.creation_date >= ?'; params.push(`${desde} 00:00:00`); }
        if (hasta) { where += ' AND t.creation_date <= ?'; params.push(`${hasta} 23:59:59`); }
        if (area)  { where += ' AND t.title LIKE ?'; params.push(`Incidente en ${area}%`); }
        if (priority_id) { where += ' AND t.priority_id = ?'; params.push(priority_id); }

        const [filas] = await pool.query(`
            SELECT
                t.ticket_code as ticket, p.priority_name as prioridad, p.sla_hours,
                DATE_FORMAT(t.creation_date, '%d/%m/%Y %H:%i') as creado,
                DATE_FORMAT(t.resolution_date, '%d/%m/%Y %H:%i') as resuelto,
                TIMESTAMPDIFF(MINUTE, t.creation_date, t.resolution_date) as minutos_resolucion,
                (t.resolution_date <= COALESCE(t.sla_deadline, DATE_ADD(t.creation_date, INTERVAL p.sla_hours HOUR))) as cumple_sla
            FROM ticket t
            JOIN priority p ON t.priority_id = p.priority_id
            ${where}
        `, params);

        const userId = req.security.user.user_id;

        const filasProcesadas = filas.map(f => ({
            Ticket: f.ticket,
            Prioridad: f.prioridad,
            'SLA (hrs)': f.sla_hours,
            Creado: f.creado,
            Resuelto: f.resuelto,
            'Tiempo de resolución (hrs)': Number((f.minutos_resolucion / 60).toFixed(1)),
            'Cumple SLA': Number(f.cumple_sla) === 1 ? 'Sí' : 'No'
        }));

        if (formato === 'csv') {
            const encabezados = filasProcesadas.length > 0 ? Object.keys(filasProcesadas[0]) : ['Ticket'];
            let csv = encabezados.join(';') + '\n';
            filasProcesadas.forEach(f => {
                csv += encabezados.map(h => `"${String(f[h]).replace(/"/g, '""')}"`).join(';') + '\n';
            });
            await pool.query('INSERT INTO export_log (user_id, formato, exito) VALUES (?, ?, 1)', [userId, 'csv']);
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_kpi.csv"');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send('\uFEFF' + csv);
        }

        if (formato === 'excel') {
            const hoja = XLSX.utils.json_to_sheet(filasProcesadas.length > 0 ? filasProcesadas : [{ Ticket: 'Sin datos en el periodo' }]);
            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja, 'Reporte KPI');
            const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
            await pool.query('INSERT INTO export_log (user_id, formato, exito) VALUES (?, ?, 1)', [userId, 'excel']);
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_kpi.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        }

        if (formato === 'pdf') {
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_kpi.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.pipe(res);
            doc.fontSize(16).text('Reporte de KPIs — Clínica Aconcagua', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10);
            if (filasProcesadas.length === 0) {
                doc.text('No hay datos de tickets resueltos en el periodo seleccionado.');
            } else {
                filasProcesadas.forEach(f => {
                    doc.text(`Ticket: ${f.Ticket}  |  Prioridad: ${f.Prioridad}  |  SLA: ${f['SLA (hrs)']} hrs`);
                    doc.text(`Creado: ${f.Creado}  →  Resuelto: ${f.Resuelto}  |  Duración: ${f['Tiempo de resolución (hrs)']} hrs  |  Cumple SLA: ${f['Cumple SLA']}`);
                    doc.moveDown(0.5);
                });
            }
            doc.end();
            await pool.query('INSERT INTO export_log (user_id, formato, exito) VALUES (?, ?, 1)', [userId, 'pdf']);
            return;
        }
    } catch (error) {
        console.error(error);
        // Excepción: Fallo en compilación → el sistema bloquea la descarga y emite una alerta
        try {
            const userId = req.security.user.user_id;
            await pool.query('INSERT INTO export_log (user_id, formato, exito) VALUES (?, ?, 0)', [userId, formato || 'desconocido']);
        } catch (e2) { /* no bloquear la respuesta de error por un fallo de log */ }
        if (!res.headersSent) {
            res.status(500).json({ error: 'No fue posible compilar el archivo de exportación. Descarga bloqueada.' });
        }
    }
});

// ==========================================
// RF-17 — NOTAS TÉCNICAS PRIVADAS
// ==========================================
app.post('/incidente/nota-privada', async (req, res) => {
    const { id_ticket, usuario, nota } = req.body;

    // El sistema valida formato → Excepción: Error de formato, se aborta la transacción
    if (!nota || !nota.trim()) {
        return res.status(400).json({ error: 'La nota técnica no puede estar vacía.' });
    }

    try {
        const [tickets] = await pool.query('SELECT ticket_id FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticketId = tickets[0].ticket_id;

        // El sistema valida los privilegios del rol activo (Técnico o Administrador)
        if (!req.security.soporte) {
            return res.status(403).json({ error: 'Solo técnicos o administradores pueden registrar notas técnicas privadas.' });
        }
        const userId = req.actor.user_id;

        // El sistema marca el registro con un flag de visibilidad restringida
        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id, is_private) VALUES (?, ?, ?, 1)',
            [`🔒 NOTA TÉCNICA PRIVADA:\n${nota.trim()}`, userId, ticketId]
        );

        // El sistema oculta la nota en las vistas del solicitante
        const comments = await obtenerComentariosParaViewer(ticketId, usuario, req.security.soporte);
        res.json({ success: true, message: 'Nota técnica privada registrada.', comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registrando la nota técnica privada.' });
    }
});

// ==========================================
// RF-18 — RETOMANDO LA ATENCIÓN OPERATIVA (REAPERTURA)
// ==========================================
const LIMITE_REAPERTURAS = 3;
// RF-24: umbral financiero sobre el cual una línea de materiales requiere aprobación administrativa
const UMBRAL_FINANCIERO_MATERIALES = 50000;

app.post('/incidente/reabrir', async (req, res) => {
    const { id_ticket, usuario, justificacion } = req.body;

    // El sistema valida que el texto tenga al menos 10 caracteres
    if (!justificacion || justificacion.trim().length < 10) {
        return res.status(400).json({ error: 'La justificación debe tener al menos 10 caracteres.' });
    }

    try {
        const [tickets] = await pool.query(`
            SELECT t.ticket_id, t.status_id, t.reopen_count, t.requester_user_id,
                   u.first_name as creador, u_tecnico.first_name as tecnico_nombre, u_tecnico.institutional_email as tecnico_email
            FROM ticket t
            LEFT JOIN user u ON t.requester_user_id = u.user_id
            LEFT JOIN user u_tecnico ON t.assigned_user_id = u_tecnico.user_id
            WHERE t.ticket_code = ?
        `, [id_ticket]);

        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        if (![3, 4, 6].includes(ticket.status_id)) {
            return res.status(400).json({ error: 'Solo se pueden reabrir tickets Resueltos o Cerrados.' });
        }
        if (ticket.requester_user_id !== req.actor.user_id) {
            return res.status(403).json({ error: 'Solo el usuario solicitante puede reabrir este ticket.' });
        }

        // Excepción: Límite alcanzado → el sistema bloquea el botón y sugiere ticket nuevo
        if (ticket.reopen_count >= LIMITE_REAPERTURAS) {
            return res.status(400).json({
                error: `Se alcanzó el límite de ${LIMITE_REAPERTURAS} reaperturas para este ticket. Por favor genera un ticket nuevo.`,
                limiteAlcanzado: true
            });
        }

        const userId = req.actor.user_id;

        // El sistema revierte el estado a Pendiente y se incrementa el contador de reaperturas
        await pool.query(
            'UPDATE ticket SET status_id = 5, reopen_count = reopen_count + 1, auto_cerrado=0, close_date=NULL, resolution_date=NULL WHERE ticket_id = ?',
            [ticket.ticket_id]
        );

        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`🔁 TICKET REABIERTO (reapertura ${ticket.reopen_count + 1}/${LIMITE_REAPERTURAS}).\nJustificación: ${justificacion.trim()}`, userId, ticket.ticket_id]
        );

        // Se notifica al técnico
        if (ticket.tecnico_email && !ticket.tecnico_email.includes('@temp.com')) {
            enviarEmailTicketReabierto(ticket.tecnico_email, {
                ticketCode: id_ticket,
                creador: ticket.creador,
                tecnico: ticket.tecnico_nombre,
                justificacion: justificacion.trim(),
                reaperturas: ticket.reopen_count + 1
            });
        }

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, usuario, req.security.soporte);
        res.json({
            success: true,
            message: 'Ticket reabierto y reasignado a estado Pendiente.',
            reaperturas: ticket.reopen_count + 1,
            comentarios: comments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error reabriendo el ticket.' });
    }
});

// ==========================================
// RF-14 — VENTANA OPERATIVA
// ==========================================
app.get('/horario-operativo', async (req, res) => {
    try {
        const horario = await obtenerHorarioOperativo();
        const [pendientesRows] = await pool.query('SELECT COUNT(*) as total FROM email_queue WHERE enviado = 0');
        res.json({
            hora_inicio: String(horario.hora_inicio).substring(0, 5),
            hora_fin: String(horario.hora_fin).substring(0, 5),
            correosEncolados: pendientesRows[0].total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el horario operativo' });
    }
});

app.put('/horario-operativo', async (req, res) => {
    const { hora_inicio, hora_fin } = req.body;
    const formatoValido = /^([01]\d|2[0-3]):([0-5]\d)$/;

    // El sistema valida la consistencia del formato HH:mm
    // Excepción: Formato inválido → el sistema bloquea la actualización de la tabla
    if (!hora_inicio || !hora_fin || !formatoValido.test(hora_inicio) || !formatoValido.test(hora_fin)) {
        return res.status(400).json({ error: 'El rango horario debe tener formato HH:mm válido (00:00 a 23:59).' });
    }

    try {
        // El sistema actualiza los parámetros en la base de datos y los aplica al motor de envíos
        await pool.query(
            'UPDATE operating_hours SET hora_inicio = ?, hora_fin = ? WHERE operating_hours_id = 1',
            [hora_inicio + ':00', hora_fin + ':00']
        );
        res.json({ success: true, message: `Ventana operativa actualizada: ${hora_inicio} a ${hora_fin}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando el horario operativo' });
    }
});

app.post('/horario-operativo/procesar-cola', async (req, res) => {
    try {
        const enviados = await procesarColaCorreos();
        res.json({ success: true, message: enviados > 0 ? `${enviados} correo(s) pendiente(s) enviado(s).` : 'No hay correos pendientes dentro del horario actual.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error procesando la cola de correos' });
    }
});

// ==========================================
// RF-21 — AJUSTANDO TÉCNICAMENTE LA URGENCIA
// ==========================================
app.post('/incidente/ajustar-prioridad', async (req, res) => {
    const { id_ticket, usuario, priority_id, justificacion } = req.body;

    // Excepción: Justificación vacía → el sistema bloquea la transacción
    if (!justificacion || justificacion.trim().length < 10) {
        return res.status(400).json({ error: 'La justificación técnica debe tener al menos 10 caracteres.' });
    }
    if (!priority_id) {
        return res.status(400).json({ error: 'Debes seleccionar el nuevo nivel de prioridad.' });
    }

    try {
        const [tickets] = await pool.query(
            'SELECT ticket_id, status_id, priority_id, creation_date FROM ticket WHERE ticket_code = ?',
            [id_ticket]
        );
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        // Precondición: el ticket debe estar en estado "Pendiente" (5) o "En Proceso" (1)
        if (![1, 5].includes(ticket.status_id)) {
            return res.status(400).json({ error: 'Solo se puede ajustar la prioridad de tickets Pendientes o En Proceso.' });
        }

        // El técnico debe tener rol activo de Técnico (role_id = 1) o Admin
        if (!req.security.soporte) {
            return res.status(403).json({ error: 'Solo un técnico o administrador puede ajustar la prioridad.' });
        }
        const userId = req.actor.user_id;

        const [prioridadNueva] = await pool.query('SELECT sla_hours, priority_name FROM priority WHERE priority_id = ?', [priority_id]);
        if (prioridadNueva.length === 0) return res.status(400).json({ error: 'Prioridad no válida.' });

        // El sistema recalcula automáticamente la fecha límite de resolución
        // basado en la fecha de creación original
        await pool.query(
            `UPDATE ticket SET priority_id = ?, sla_deadline = DATE_ADD(DATE_ADD(creation_date, INTERVAL ? HOUR), INTERVAL sla_paused_seconds SECOND) WHERE ticket_id = ?`,
            [priority_id, prioridadNueva[0].sla_hours, ticket.ticket_id]
        );

        // El sistema registra el cambio en el log de auditoría
        await pool.query(
            'INSERT INTO priority_change_log (ticket_id, user_id, priority_anterior, priority_nueva, justificacion) VALUES (?, ?, ?, ?, ?)',
            [ticket.ticket_id, userId, ticket.priority_id, priority_id, justificacion.trim()]
        );

        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`⚙️ PRIORIDAD AJUSTADA a "${prioridadNueva[0].priority_name}".\nJustificación técnica: ${justificacion.trim()}`, userId, ticket.ticket_id]
        );

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, usuario, req.security.soporte);
        res.json({ success: true, message: 'Prioridad y fecha límite de SLA actualizadas correctamente.', comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error ajustando la prioridad del ticket.' });
    }
});

// ==========================================
// RF-24 — IMPUTANDO MATERIALES CONSUMIDOS
// ==========================================
app.get('/materiales', async (req, res) => {
    try {
        const [materiales] = await pool.query(
            'SELECT material_id, nombre, costo_unitario_referencia, stock_actual, stock_minimo FROM insumo_catalogo ORDER BY nombre ASC'
        );
        res.json(materiales);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el catálogo de materiales' });
    }
});

app.get('/incidente/:id_ticket/materiales', async (req, res) => {
    const { id_ticket } = req.params;
    try {
        const [tickets] = await pool.query('SELECT ticket_id FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

        const [usados] = await pool.query(`
            SELECT tm.ticket_material_id, m.nombre, tm.cantidad, tm.costo_unitario, tm.costo_total,
                   tm.requiere_aprobacion, tm.aprobado, DATE_FORMAT(tm.fecha, '%d/%m/%Y %H:%i') as fecha,
                   u.first_name as tecnico
            FROM ticket_material tm
            JOIN insumo_catalogo m ON tm.material_id = m.material_id
            LEFT JOIN user u ON tm.user_id = u.user_id
            WHERE tm.ticket_id = ?
            ORDER BY tm.fecha DESC
        `, [tickets[0].ticket_id]);

        res.json(usados);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo los materiales del ticket' });
    }
});

app.post('/incidente/materiales', async (req, res) => {
    const { id_ticket, usuario, material_id, cantidad, costo_unitario } = req.body;

    if (!material_id || !cantidad || !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0 || costo_unitario === undefined || !Number.isFinite(Number(costo_unitario)) || Number(costo_unitario) < 0) {
        return res.status(400).json({ error: 'Debes indicar un insumo, cantidad y costo unitario válidos.' });
    }

    const materialConnection = await pool.getConnection();
    try {
        await materialConnection.beginTransaction();
        const [tickets] = await materialConnection.query('SELECT ticket_id, status_id FROM ticket WHERE ticket_code = ? FOR UPDATE', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        // Precondición: el ticket debe estar en estado "En Proceso" (status_id = 1)
        if (ticket.status_id !== 1) {
            return res.status(400).json({ error: 'Solo se pueden imputar materiales a tickets En Proceso.' });
        }

        if (!req.security.soporte) {
            return res.status(403).json({ error: 'Solo un técnico o administrador puede imputar materiales.' });
        }
        const userId = req.actor.user_id;

        // ── RF-52: el usuario asocia una salida de material a un ticket específico ──
        // Excepción: Stock insuficiente → el sistema bloquea la salida y emite alerta de reposición
        const [insumoRows] = await materialConnection.query('SELECT nombre, stock_actual, stock_minimo FROM insumo_catalogo WHERE material_id = ? FOR UPDATE', [material_id]);
        if (insumoRows.length === 0) return res.status(400).json({ error: 'Insumo no encontrado en el catálogo.' });
        const insumo = insumoRows[0];

        if (insumo.stock_actual < Number(cantidad)) {
            return res.status(400).json({
                error: `Stock insuficiente de "${insumo.nombre}" (disponible: ${insumo.stock_actual}, solicitado: ${cantidad}). Se requiere reposición antes de continuar.`,
                alertaReposicion: true
            });
        }

        // El sistema calcula dinámicamente el costo total de la orden
        const costoTotal = Number(cantidad) * Number(costo_unitario);

        // Excepción: Exceso de umbral financiero → el sistema intercepta la transición
        // y requiere aprobación administrativa
        const requiereAprobacion = costoTotal > inc3.config.cost_threshold;

        // El sistema persiste la relación en la tabla de materiales usados
        await materialConnection.query(
            `INSERT INTO ticket_material (ticket_id, material_id, cantidad, costo_unitario, costo_total, user_id, requiere_aprobacion, aprobado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticket.ticket_id, material_id, cantidad, costo_unitario, costoTotal, userId, requiereAprobacion ? 1 : 0, requiereAprobacion ? 0 : 1]
        );

        // El sistema descuenta automáticamente las unidades del stock
        await materialConnection.query('UPDATE insumo_catalogo SET stock_actual = stock_actual - ? WHERE material_id = ?', [cantidad, material_id]);
        const stockRestante = insumo.stock_actual - Number(cantidad);
        const stockBajo = stockRestante <= insumo.stock_minimo;

        await materialConnection.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`🧰 MATERIAL IMPUTADO — cantidad: ${cantidad}, costo total: $${costoTotal.toLocaleString('es-CL')}.${requiereAprobacion ? ' ⚠️ Requiere aprobación administrativa (excede umbral financiero).' : ''}`, userId, ticket.ticket_id]
        );

        await materialConnection.commit();
        res.json({
            success: true,
            message: requiereAprobacion
                ? `Material registrado, pero el costo ($${costoTotal.toLocaleString('es-CL')}) excede el umbral y queda pendiente de aprobación administrativa.`
                : 'Material registrado correctamente.',
            stockBajo,
            stockRestante,
            requiereAprobacion,
            costoTotal
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registrando el material.' });
    } finally { await materialConnection.rollback(); materialConnection.release(); }
});

app.put('/materiales-usados/:id/aprobar', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE ticket_material SET aprobado = 1, requiere_aprobacion = 0 WHERE ticket_material_id = ?', [id]);
        res.json({ success: true, message: 'Material aprobado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error aprobando el material.' });
    }
});

// ==========================================
// RF-25 — CONSOLIDANDO FINANCIERAMENTE EL INVENTARIO
// ==========================================
app.get('/reportes/materiales', async (req, res) => {
    const { desde, hasta } = req.query;

    try {
        let where = 'WHERE 1=1';
        const params = [];
        if (desde) { where += ' AND tm.fecha >= ?'; params.push(`${desde} 00:00:00`); }
        if (hasta) { where += ' AND tm.fecha <= ?'; params.push(`${hasta} 23:59:59`); }

        // El sistema consulta la tabla relacional de materiales
        const [movimientos] = await pool.query(`
            SELECT
                tm.ticket_material_id, t.ticket_code, m.nombre as insumo,
                tm.cantidad, tm.costo_unitario, tm.costo_total,
                DATE_FORMAT(tm.fecha, '%d/%m/%Y %H:%i') as fecha,
                u.first_name as tecnico
            FROM ticket_material tm
            JOIN insumo_catalogo m ON tm.material_id = m.material_id
            JOIN ticket t ON tm.ticket_id = t.ticket_id
            LEFT JOIN user u ON tm.user_id = u.user_id
            ${where}
            ORDER BY tm.fecha DESC
        `, params);

        // Excepción: Sin movimientos en el periodo → el sistema muestra un mensaje informativo
        if (movimientos.length === 0) {
            return res.json({ sinDatos: true, totalGastado: 0, totalMovimientos: 0, porInsumo: [], movimientos: [] });
        }

        // El sistema procesa el costo unitario promedio y acumulado por ítem (para el drill-down)
        res.json(new (require('./reports').ReporteFinanciero)().generar(movimientos));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el reporte de inventario' });
    }
});

app.post('/reportes/materiales/exportar', async (req, res) => {
    const { usuario, desde, hasta } = req.body;

    try {
        // Solo el Administrador del sistema puede exportar este reporte
        if (!req.security.admin) {
            return res.status(403).json({ error: 'Solo un administrador puede exportar este reporte.' });
        }

        let where = 'WHERE 1=1';
        const params = [];
        if (desde) { where += ' AND tm.fecha >= ?'; params.push(`${desde} 00:00:00`); }
        if (hasta) { where += ' AND tm.fecha <= ?'; params.push(`${hasta} 23:59:59`); }

        const [movimientos] = await pool.query(`
            SELECT t.ticket_code, m.nombre as insumo, tm.cantidad, tm.costo_unitario, tm.costo_total,
                   DATE_FORMAT(tm.fecha, '%d/%m/%Y %H:%i') as fecha, u.first_name as tecnico
            FROM ticket_material tm
            JOIN insumo_catalogo m ON tm.material_id = m.material_id
            JOIN ticket t ON tm.ticket_id = t.ticket_id
            LEFT JOIN user u ON tm.user_id = u.user_id
            ${where}
            ORDER BY tm.fecha DESC
        `, params);

        const filas = movimientos.length > 0 ? movimientos.map(m => ({
            Ticket: m.ticket_code, Insumo: m.insumo, Cantidad: m.cantidad,
            'Costo unitario': Number(m.costo_unitario), 'Costo total': Number(m.costo_total),
            Fecha: m.fecha, Técnico: m.tecnico || 'N/D'
        })) : [{ Ticket: 'Sin movimientos en el periodo' }];

        const hoja = XLSX.utils.json_to_sheet(filas);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Inventario Consolidado');
        const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="inventario_consolidado.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No fue posible compilar el archivo de exportación.' });
    }
});

// ==========================================
// RF-29 — MONITOREANDO AUTOMÁTICAMENTE EL VENCIMIENTO
// ==========================================
app.get('/tickets/riesgo-sla', async (req, res) => {
    try {
        const [tickets] = await pool.query(`
            SELECT t.ticket_code as id_ticket, s.status_name as estado, p.priority_name,
                   au.first_name as tecnico_asignado, t.creation_date, t.status_id, t.pausa_inicio, t.sla_paused_seconds,
                   COALESCE(t.sla_deadline, DATE_ADD(t.creation_date, INTERVAL p.sla_hours HOUR)) as sla_deadline_efectivo
            FROM ticket t
            JOIN priority p ON t.priority_id = p.priority_id
            JOIN status s ON t.status_id = s.status_id
            LEFT JOIN user au ON t.assigned_user_id = au.user_id
            WHERE t.is_archived=0 AND t.status_id IN (1, 2, 5) AND (? = 1 OR t.requester_user_id = ? OR t.assigned_user_id = ?)
        `, [req.security.soporte ? 1 : 0, req.security.user.user_id, req.security.user.user_id]);

        const ahora = Date.now();
        const resultado = tickets.map(t => {
            const pct = Math.round(require('./sla')(t, ahora));

            let indicador = 'verde';
            if (pct >= 100) indicador = 'rojo';
            else if (pct >= 80) indicador = 'amarillo';

            // El estado ya viene desde la tabla status; se normaliza por si el texto varía
            const estado = t.estado === 'Pendiente' ? 'Pendiente' : (t.estado === 'En espera' ? 'En espera' : 'En curso');

            return { id_ticket: t.id_ticket, estado, priority_name: t.priority_name, tecnico_asignado: t.tecnico_asignado, pctConsumido: pct, indicador };
        }).sort((a, b) => {
            const orden = { rojo: 0, amarillo: 1, verde: 2 };
            if (orden[a.indicador] !== orden[b.indicador]) return orden[a.indicador] - orden[b.indicador];
            return b.pctConsumido - a.pctConsumido;
        });

        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo tickets en riesgo de SLA' });
    }
});

// Motor de monitoreo periódico (cronjob asíncrono): compara tiempo transcurrido vs. SLA,
// envía alerta crítica al administrador cuando un ticket supera el 100% por primera vez,
// y avisa al técnico apenas se alcanza el 75% (RF-58).
async function monitorearVencimientosSLA() {
    const [tickets] = await pool.query(`
        SELECT t.ticket_id, t.ticket_code, t.creation_date, t.alerta_sla_nivel, t.alerta_75_enviada,
               t.status_id, t.pausa_inicio, t.sla_paused_seconds, t.assigned_user_id, p.priority_name,
               COALESCE(t.sla_deadline, DATE_ADD(t.creation_date, INTERVAL p.sla_hours HOUR)) as sla_deadline_efectivo
        FROM ticket t
        JOIN priority p ON t.priority_id = p.priority_id
        WHERE t.is_archived=0 AND t.status_id IN (1, 2, 5)
    `);

    const ahora = Date.now();
    for (const t of tickets) {
        const pct = require('./sla')(t, ahora);

        // ── RF-58: alerta preventiva al técnico al alcanzar el 75% ──
        if (pct >= 75 && !t.alerta_75_enviada && t.assigned_user_id) {
            await pool.query('UPDATE ticket SET alerta_75_enviada = 1 WHERE ticket_id = ?', [t.ticket_id]);
            const [tec] = await pool.query('SELECT institutional_email FROM user WHERE user_id = ?', [t.assigned_user_id]);
            if (tec.length > 0 && tec[0].institutional_email && !tec[0].institutional_email.includes('@temp.com')) {
                transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.MAIL_USER,
                    to: tec[0].institutional_email,
                    subject: `⏰ Poco tiempo restante — Ticket ${t.ticket_code}`,
                    html: `<p>El ticket <strong>${t.ticket_code}</strong> (prioridad ${t.priority_name}) ya consumió el 75% de su tiempo de SLA. Revísalo pronto para evitar incumplirlo.</p>`
                }, (error) => { if (error) console.error('Error enviando alerta 75% SLA:', error); });
            }
        }

        let nivel = 0;
        if (pct >= 100) nivel = 2;
        else if (pct >= 80) nivel = 1;

        // Solo se notifica la primera vez que se cruza cada umbral (evita spam de correos)
        if (nivel > t.alerta_sla_nivel) {
            await pool.query('UPDATE ticket SET alerta_sla_nivel = ? WHERE ticket_id = ?', [nivel, t.ticket_id]);

            if (nivel === 2) {
                const [admins] = await pool.query(`
                    SELECT u.institutional_email FROM user u
                    JOIN user_role ur ON u.user_id = ur.user_id
                    JOIN role r ON ur.role_id = r.role_id
                    WHERE r.role_name = 'Admin' AND ur.active = 1 AND u.institutional_email NOT LIKE '%@temp.com'
                `);
                admins.forEach(a => {
                    transporter.sendMail({
                        from: process.env.MAIL_FROM || process.env.MAIL_USER,
                        to: a.institutional_email,
                        subject: `🚨 SLA VENCIDO — Ticket ${t.ticket_code}`,
                        html: `<p>El ticket <strong>${t.ticket_code}</strong> (prioridad ${t.priority_name}) superó su tiempo límite de resolución (SLA).</p>`
                    }, (error) => { if (error) console.error('Error enviando alerta SLA:', error); });
                });
            }
        }
    }
}

// Excepción: Falla técnica del motor → política de reintento automático (1 reintento tras 30s)
function ejecutarMonitoreoConReintento() {
    monitorearVencimientosSLA().catch(err => {
        console.error('Falla en el motor de monitoreo SLA, reintentando en 30s:', err);
        setTimeout(() => {
            monitorearVencimientosSLA().catch(err2 => console.error('Reintento de monitoreo SLA también falló:', err2));
        }, 30000);
    });
}

// ==========================================
// RF-33 — AUTOMATIZANDO LAS MÉTRICAS GERENCIALES
// ==========================================
app.get('/reportes-programados', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM scheduled_report WHERE config_id = 1');
        const config = rows[0] || { destinatarios: '', periodicidad: 'Semanal', activo: 0, ultima_ejecucion: null };
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo la configuración de reportes programados' });
    }
});

app.put('/reportes-programados', async (req, res) => {
    const { destinatarios, periodicidad, activo } = req.body;

    // El sistema valida las direcciones de correo
    const correos = (destinatarios || '').split(',').map(c => c.trim()).filter(c => c);
    const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidos = correos.filter(c => !formatoEmail.test(c));
    if (correos.length === 0) {
        return res.status(400).json({ error: 'Debes indicar al menos un destinatario válido.' });
    }
    if (invalidos.length > 0) {
        return res.status(400).json({ error: `Correo(s) inválido(s): ${invalidos.join(', ')}` });
    }
    if (!['Diario', 'Semanal', 'Mensual'].includes(periodicidad)) {
        return res.status(400).json({ error: 'Periodicidad no válida.' });
    }

    try {
        await pool.query(
            'UPDATE scheduled_report SET destinatarios = ?, periodicidad = ?, activo = ? WHERE config_id = 1',
            [correos.join(', '), periodicidad, activo ? 1 : 0]
        );
        res.json({ success: true, message: 'Configuración de reportes automáticos guardada correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error guardando la configuración' });
    }
});

// El sistema ejecuta la generación del PDF y lo despacha con reintentos ante intermitencia del correo
async function generarYEnviarReporteGerencial() {
    const [rows] = await pool.query('SELECT * FROM scheduled_report WHERE config_id = 1');
    if (rows.length === 0) return { success: false, error: 'No hay configuración de reportes.' };
    const config = rows[0];

    const destinatarios = (config.destinatarios || '').split(',').map(c => c.trim()).filter(c => c);
    if (destinatarios.length === 0) return { success: false, error: 'No hay destinatarios configurados.' };

    const [filas] = await pool.query(`
        SELECT t.ticket_code, p.priority_name, TIMESTAMPDIFF(MINUTE, t.creation_date, t.resolution_date) as minutos
        FROM ticket t JOIN priority p ON t.priority_id = p.priority_id
        WHERE t.status_id IN (4,6) AND t.resolution_date IS NOT NULL
        ORDER BY t.resolution_date DESC LIMIT 200
    `);

    const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.fontSize(16).text('Reporte Gerencial — Clínica Aconcagua', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10);
        if (filas.length === 0) {
            doc.text('No hay tickets resueltos registrados.');
        } else {
            filas.forEach(f => doc.text(`${f.ticket_code} — ${f.priority_name} — ${(f.minutos/60).toFixed(1)} hrs de resolución`));
        }
        doc.end();
    });

    // Excepción: intermitencia del servidor de correo → hasta 3 reintentos
    let intentos = 0;
    let exito = false;
    let ultimoError = null;

    while (intentos < 3 && !exito) {
        intentos++;
        try {
            await new Promise((resolve, reject) => {
                transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.MAIL_USER,
                    to: destinatarios.join(', '),
                    subject: `📊 Reporte Gerencial — Clínica Aconcagua (${config.periodicidad})`,
                    html: '<p>Se adjunta el reporte gerencial automático de KPIs de soporte técnico.</p>',
                    attachments: [{ filename: 'reporte_gerencial.pdf', content: pdfBuffer }]
                }, (error) => error ? reject(error) : resolve());
            });
            exito = true;
        } catch (err) {
            ultimoError = err;
            console.error(`Intento ${intentos} de envío gerencial falló:`, err.message);
        }
    }

    await pool.query('UPDATE scheduled_report SET ultima_ejecucion = NOW() WHERE config_id = 1');
    // Poscondición: se registra el evento en auditoría
    await pool.query(
        'INSERT INTO report_dispatch_log (config_id, exito, intentos, detalle) VALUES (1, ?, ?, ?)',
        [exito ? 1 : 0, intentos, exito ? 'Enviado correctamente' : (ultimoError ? ultimoError.message : 'Error desconocido')]
    );

    return exito
        ? { success: true, message: `Reporte enviado correctamente (intento ${intentos}).` }
        : { success: false, error: 'No fue posible enviar el reporte tras 3 intentos.' };
}

app.post('/reportes-programados/enviar-ahora', async (req, res) => {
    try {
        const resultado = await generarYEnviarReporteGerencial();
        const [rows] = await pool.query('SELECT ultima_ejecucion FROM scheduled_report WHERE config_id = 1');
        if (resultado.success) {
            res.json({ success: true, message: resultado.message, ultima_ejecucion: rows[0].ultima_ejecucion });
        } else {
            res.status(500).json({ error: resultado.error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el reporte gerencial' });
    }
});

// Verifica cada hora si corresponde ejecutar el envío según la periodicidad configurada
async function verificarReportesProgramados() {
    try {
        const [rows] = await pool.query('SELECT * FROM scheduled_report WHERE config_id = 1');
        if (rows.length === 0 || !rows[0].activo) return;
        const config = rows[0];

        const horasPorPeriodo = { Diario: 24, Semanal: 24 * 7, Mensual: 24 * 30 };
        const horasRequeridas = horasPorPeriodo[config.periodicidad] || 24 * 7;

        const yaCorrespondeEjecutar = !config.ultima_ejecucion ||
            (Date.now() - new Date(config.ultima_ejecucion).getTime()) >= horasRequeridas * 60 * 60 * 1000;

        if (yaCorrespondeEjecutar) {
            await generarYEnviarReporteGerencial();
        }
    } catch (error) {
        console.error('Error verificando reportes programados:', error);
    }
}

// ==========================================
// RF-61 — FINALIZANDO AUTOMÁTICAMENTE CASOS SIN RESPUESTA
// ==========================================
async function cerrarTicketsInactivos() {
    try {
        // Precondición: ticket en estado "Resuelto" con marca de tiempo superior a 168 horas (7 días)
        const [tickets] = await pool.query(`
            SELECT t.ticket_id, t.ticket_code, t.reopen_count, u.first_name as creador, u.institutional_email as creador_email
            FROM ticket t
            LEFT JOIN user u ON t.requester_user_id = u.user_id
            WHERE t.is_archived=0 AND t.status_id = 4 AND t.auto_cerrado = 0
              AND t.resolution_date IS NOT NULL
              AND t.resolution_date <= DATE_SUB(NOW(), INTERVAL 168 HOUR)
        `);

        for (const t of tickets) {
            // Excepción: Ticket con reapertura pendiente → se omite el registro
            // (si ya fue reabierto, su status_id ya no sería 4, así que este chequeo es defensivo)
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [[current]] = await connection.query('SELECT status_id,is_archived FROM ticket WHERE ticket_id=? FOR UPDATE',[t.ticket_id]);
                if (!current || current.status_id!==4 || current.is_archived) { await connection.rollback(); continue; }
                await connection.query('UPDATE ticket SET auto_cerrado=1,status_id=6,close_date=NOW(),survey_version=IF(EXISTS(SELECT 1 FROM inc3_survey_answer WHERE ticket_id=ticket.ticket_id),survey_version,(SELECT MAX(id) FROM inc3_survey_version)),notify_creator=1 WHERE ticket_id=?',[t.ticket_id]);
                await connection.query('INSERT INTO comment(content,user_id,ticket_id) VALUES (?,NULL,?)',['Ticket cerrado automáticamente por inactividad (7 días sin respuesta del solicitante).',t.ticket_id]);
                await connection.query('INSERT INTO auto_close_log(ticket_id) VALUES (?)',[t.ticket_id]);
                await connection.commit();
            } catch (error) { await connection.rollback(); throw error; }
            finally { connection.release(); }

            if (t.creador_email && !t.creador_email.includes('@temp.com')) {
                transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.MAIL_USER,
                    to: t.creador_email,
                    subject: `🔒 Tu ticket ${t.ticket_code} fue cerrado automáticamente`,
                    html: `<p>Hola ${t.creador}, tu ticket <strong>${t.ticket_code}</strong> fue cerrado automáticamente por falta de respuesta durante 7 días. Si el problema persiste, puedes reabrirlo o generar uno nuevo.</p>`
                }, (error) => { if (error) console.error('Error notificando cierre automático:', error); });
            }
        }
    } catch (error) {
        console.error('Error en el proceso de cierre automático de tickets inactivos:', error);
    }
}

// ==========================================
// RF-45 — PARAMETRIZANDO EL CALENDARIO OPERATIVO
// ==========================================
app.get('/feriados', async (req, res) => {
    try {
        const [feriados] = await pool.query(
            "SELECT holiday_id, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, nombre FROM holiday_exception ORDER BY fecha ASC"
        );
        res.json(feriados);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el calendario de feriados' });
    }
});

app.post('/feriados', async (req, res) => {
    const { fecha, nombre } = req.body;
    if (!fecha || !nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'Debes indicar la fecha y el nombre del feriado.' });
    }

    try {
        // Excepción: Fecha ya registrada → el sistema impide el duplicado
        const [existente] = await pool.query('SELECT holiday_id FROM holiday_exception WHERE fecha = ?', [fecha]);
        if (existente.length > 0) {
            return res.status(400).json({ error: 'Esa fecha ya está registrada como feriado.' });
        }

        await pool.query('INSERT INTO holiday_exception (fecha, nombre) VALUES (?, ?)', [fecha, nombre.trim()]);
        res.json({ success: true, message: `Feriado "${nombre.trim()}" registrado correctamente.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registrando el feriado' });
    }
});

app.delete('/feriados/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM holiday_exception WHERE holiday_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error eliminando el feriado' });
    }
});

// ==========================================
// RF-47 — REGISTRANDO INTEGRACIONES CON EXTERNOS
// ==========================================
app.get('/configuracion-externa', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT external_endpoint_url FROM system_config WHERE config_id = 1');
        res.json({ external_endpoint_url: rows.length > 0 ? rows[0].external_endpoint_url : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo la configuración externa' });
    }
});

app.put('/configuracion-externa', async (req, res) => {
    const { external_endpoint_url } = req.body;
    if (external_endpoint_url && !/^https?:\/\/.+/.test(external_endpoint_url)) {
        return res.status(400).json({ error: 'La URL debe comenzar con http:// o https://' });
    }
    try {
        await pool.query('UPDATE system_config SET external_endpoint_url = ? WHERE config_id = 1', [external_endpoint_url || null]);
        res.json({ success: true, message: 'Endpoint externo actualizado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error guardando la configuración externa' });
    }
});

// El sistema detecta un intento de contacto externo y mide el tiempo de respuesta
function probarConexionExterna(url) {
    return new Promise((resolve) => {
        const inicio = Date.now();
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout: 5000 }, (resp) => {
            resp.resume();
            resolve({ exito: true, tiempoMs: Date.now() - inicio, statusCode: resp.statusCode });
        });
        req.on('timeout', () => { req.destroy(); resolve({ exito: false, tiempoMs: Date.now() - inicio, error: 'Timeout de conexión' }); });
        req.on('error', (err) => resolve({ exito: false, tiempoMs: Date.now() - inicio, error: err.message }));
    });
}

app.post('/incidente/verificar-externo', async (req, res) => {
    const { id_ticket } = req.body;
    try {
        const [tickets] = await pool.query('SELECT ticket_id, category_id FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        // Precondición: ticket de categoría externa (6) activo
        if (ticket.category_id !== 6) {
            return res.status(400).json({ error: 'Esta verificación solo aplica a tickets de categoría "Sistema Externo".' });
        }

        const [configRows] = await pool.query('SELECT external_endpoint_url FROM system_config WHERE config_id = 1');
        const endpoint = configRows.length > 0 ? configRows[0].external_endpoint_url : null;

        if (!endpoint) {
            return res.status(400).json({ error: 'No hay un endpoint externo configurado. Pídele al administrador que lo configure.' });
        }

        const resultado = await probarConexionExterna(endpoint);

        await pool.query(
            'INSERT INTO external_integration_log (ticket_id, endpoint, tiempo_respuesta_ms, exito) VALUES (?, ?, ?, ?)',
            [ticket.ticket_id, endpoint, resultado.tiempoMs, resultado.exito ? 1 : 0]
        );

        // El sistema adjunta el log técnico de la transacción al ticket
        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id, is_private) VALUES (?, ?, ?, 1)',
            [`🔌 LOG TÉCNICO — Endpoint: ${endpoint} | Tiempo de respuesta: ${resultado.tiempoMs}ms | Resultado: ${resultado.exito ? 'OK (' + resultado.statusCode + ')' : 'FALLÓ (' + resultado.error + ')'}`, null, ticket.ticket_id]
        );

        // Excepción: Timeout de conexión → aviso de error en la bitácora pública
        if (!resultado.exito) {
            await pool.query(
                'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
                [`⚠️ No fue posible contactar al sistema externo (${resultado.error}). Se registró evidencia técnica de la falla.`, null, ticket.ticket_id]
            );
        }

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, req.body.usuario, req.security.soporte);
        res.json({ success: true, resultado, comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error verificando la conexión externa' });
    }
});

// ==========================================
// RF-48 — IDENTIFICANDO FÍSICAMENTE EL HARDWARE (ETIQUETA QR)
// ==========================================
app.get('/incidente/:id_ticket/etiqueta-pdf', async (req, res) => {
    const { id_ticket } = req.params;
    const { usuario } = req.query;

    try {
        const [tickets] = await pool.query('SELECT ticket_id, status_id, equipment_id FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        if (ticket.status_id !== 1) {
            return res.status(400).json({ error: 'Solo se puede generar la etiqueta para tickets En Proceso.' });
        }
        if (!ticket.equipment_id) {
            return res.status(400).json({ error: 'Este ticket no tiene un equipo identificado.' });
        }

        // El sistema genera un código QR con el ID del ticket
        const qrDataUrl = await QRCode.toDataURL(id_ticket, { width: 200, margin: 1 });
        const qrBase64 = qrDataUrl.split(',')[1];

        const userId = req.security.user.user_id;

        // El sistema registra la generación de la etiqueta
        await pool.query('INSERT INTO label_print_log (ticket_id, user_id, formato) VALUES (?, ?, ?)', [ticket.ticket_id, userId, 'pdf']);

        res.setHeader('Content-Disposition', `attachment; filename="etiqueta_${id_ticket}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');

        const doc = new PDFDocument({ size: [227, 150], margin: 10 });
        doc.pipe(res);
        doc.fontSize(11).text(id_ticket, { align: 'center' });
        doc.image(Buffer.from(qrBase64, 'base64'), (227 - 90) / 2, 26, { width: 90, height: 90 });
        doc.fontSize(7).text('Clínica Aconcagua — Soporte Técnico', 10, 120, { align: 'center', width: 207 });
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando la etiqueta' });
    }
});

app.get('/incidente/:id_ticket/qr', async (req, res) => {
    try {
        const qrDataUrl = await QRCode.toDataURL(req.params.id_ticket, { width: 200, margin: 1 });
        res.json({ qr: qrDataUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el código QR' });
    }
});

app.post('/incidente/etiqueta/registrar', async (req, res) => {
    const { id_ticket, usuario } = req.body;
    try {
        const [tickets] = await pool.query('SELECT ticket_id FROM ticket WHERE ticket_code = ?', [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const userId = req.actor.user_id;
        await pool.query('INSERT INTO label_print_log (ticket_id, user_id, formato) VALUES (?, ?, ?)', [tickets[0].ticket_id, userId, 'print']);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registrando la impresión' });
    }
});

// ==========================================
// RF-52 — CONTROLANDO EXISTENCIAS DE REPUESTOS TÉCNICOS
// ==========================================
app.get('/insumos/stock', async (req, res) => {
    try {
        const [insumos] = await pool.query(
            'SELECT material_id, nombre, costo_unitario_referencia, stock_actual, stock_minimo FROM insumo_catalogo ORDER BY nombre ASC'
        );
        res.json(insumos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el stock de insumos' });
    }
});

app.post('/insumos/entrada', async (req, res) => {
    const { material_id, cantidad, usuario } = req.body;
    if (!material_id || !Number.isSafeInteger(Number(cantidad)) || Number(cantidad) <= 0) {
        return res.status(400).json({ error: 'Debes indicar un insumo y una cantidad válida.' });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const userId = req.security.user.user_id;

        // El sistema actualiza el stock disponible en la base de datos
        const [updated] = await connection.query('UPDATE insumo_catalogo SET stock_actual = stock_actual + ? WHERE material_id = ?', [cantidad, material_id]);
        if (!updated.affectedRows) return res.status(404).json({error:'El insumo seleccionado no existe.'});
        await connection.query('INSERT INTO insumo_entrada (material_id, cantidad, user_id) VALUES (?, ?, ?)', [material_id, cantidad, userId]);
        await connection.commit();

        res.json({ success: true, message: `Entrada de ${cantidad} unidad(es) registrada correctamente.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registrando la entrada de stock' });
    } finally {
        if (connection) { await connection.rollback(); connection.release(); }
    }
});

// ==========================================
// RF-53 — REASIGNANDO FORZADAMENTE POR JEFATURA
// ==========================================
app.post('/incidente/reasignar', async (req, res) => {
    const { id_ticket, usuario, nuevo_tecnico_id, motivo, confirmar } = req.body;
    if (!req.security.admin) return res.status(403).json({ error: 'Solo un administrador puede reasignar por jefatura.' });

    if (!nuevo_tecnico_id) return res.status(400).json({ error: 'Debes seleccionar un técnico.' });
    if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'Debes indicar el motivo del cambio.' });

    try {
        const [tickets] = await pool.query(`
            SELECT t.ticket_id, t.status_id, t.assigned_user_id, ua.first_name as tecnico_actual, ua.institutional_email as tecnico_actual_email
            FROM ticket t LEFT JOIN user ua ON t.assigned_user_id = ua.user_id
            WHERE t.ticket_code = ?
        `, [id_ticket]);
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        if (![1, 5].includes(ticket.status_id)) {
            return res.status(400).json({ error: 'Solo se pueden reasignar tickets Pendientes o En Proceso.' });
        }

        // El sistema verifica que el técnico esté activo
        const [nuevoTec] = await pool.query(`
            SELECT DISTINCT u.user_id, u.first_name, u.institutional_email, u.en_vacaciones
            FROM user u JOIN user_role ur ON u.user_id = ur.user_id
            WHERE u.user_id = ? AND ur.active = 1 AND u.user_status = 1
              AND (ur.role_id = 1 OR u.is_critical_tech = 1 OR u.tipo_usuario = 'TECNICO')
        `, [nuevo_tecnico_id]);
        if (nuevoTec.length === 0) return res.status(400).json({ error: 'El técnico seleccionado no está activo.' });
        const tecnico = nuevoTec[0];

        // Excepción: Técnico no disponible (vacaciones) → advertencia antes de confirmar
        if (tecnico.en_vacaciones && !confirmar) {
            return res.status(409).json({ advertencia: true, error: `${tecnico.first_name} está marcado como en vacaciones/licencia. ¿Deseas continuar de todas formas?` });
        }

        const adminId = req.actor.user_id;

        await pool.query('UPDATE ticket SET assigned_user_id = ? WHERE ticket_id = ?', [tecnico.user_id, ticket.ticket_id]);

        // Poscondición: se registra el motivo del cambio en el historial
        await pool.query(
            'INSERT INTO comment (content, user_id, ticket_id) VALUES (?, ?, ?)',
            [`🔀 REASIGNACIÓN FORZADA por jefatura.\nDe: ${ticket.tecnico_actual || 'Sin asignar'} → A: ${tecnico.first_name}.\nMotivo: ${motivo.trim()}`, adminId, ticket.ticket_id]
        );

        // Se notifica a ambas partes
        [ticket.tecnico_actual_email, tecnico.institutional_email].forEach(email => {
            if (email && !email.includes('@temp.com')) {
                transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.MAIL_USER,
                    to: email,
                    subject: `🔀 Reasignación de ticket ${id_ticket}`,
                    html: `<p>El ticket <strong>${id_ticket}</strong> fue reasignado por jefatura de <strong>${ticket.tecnico_actual || 'Sin asignar'}</strong> a <strong>${tecnico.first_name}</strong>.</p><p>Motivo: ${motivo.trim()}</p>`
                }, (error) => { if (error) console.error('Error notificando reasignación:', error); });
            }
        });

        const comments = await obtenerComentariosParaViewer(ticket.ticket_id, usuario, req.security.soporte);
        res.json({ success: true, message: `Ticket reasignado a ${tecnico.first_name} correctamente.`, comentarios: comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error reasignando el ticket' });
    }
});

app.put('/tecnicos/:id/vacaciones', async (req, res) => {
    const { id } = req.params;
    const { en_vacaciones } = req.body;
    try {
        await pool.query('UPDATE user SET en_vacaciones = ? WHERE user_id = ?', [en_vacaciones ? 1 : 0, id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando disponibilidad del técnico' });
    }
});

// ==========================================
// RF-55 — ANALIZANDO GEOGRÁFICAMENTE LAS INCIDENCIAS
// ==========================================
app.get('/reportes/mapa-calor', async (req, res) => {
    const { category_id } = req.query;
    try {
        let where = "WHERE (t.piso_ticket IS NOT NULL AND t.piso_ticket <> '')";
        const params = [];
        if (category_id) { where += ' AND t.category_id = ?'; params.push(category_id); }

        // Excepción: falta de datos de ubicación → esos registros se omiten (WHERE ya los excluye)
        const [filas] = await pool.query(`
            SELECT t.piso_ticket as piso, COUNT(*) as total
            FROM ticket t
            ${where}
            GROUP BY t.piso_ticket
            ORDER BY total DESC
        `, params);

        res.json(filas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el mapa de calor' });
    }
});

// ==========================================
// RF-57 — DESCARGANDO MASIVAMENTE ADJUNTOS DE UN TICKET
// ==========================================
app.get('/incidente/:id_ticket/adjuntos-zip', async (req, res) => {
    const { id_ticket } = req.params;
    try {
        const [tickets] = await pool.query(
            'SELECT ticket_id, description, creation_date FROM ticket WHERE ticket_code = ?', [id_ticket]
        );
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        const ticket = tickets[0];

        const [adjuntos] = await pool.query(
            'SELECT file_name, file_path FROM attachment WHERE is_deleted=0 AND ticket_id = ?', [ticket.ticket_id]
        );

        if (adjuntos.length === 0) {
            return res.status(400).json({ error: 'Este ticket no tiene archivos adjuntos.' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="adjuntos_${id_ticket}.zip"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => { console.error('Error de compresión:', err); if (!res.headersSent) res.status(500).end(); });
        archive.pipe(res);

        // El sistema añade un archivo de texto con la descripción del caso
        archive.append(
            `Ticket: ${id_ticket}\nFecha de creación: ${ticket.creation_date}\n\nDescripción:\n${ticket.description}`,
            { name: 'descripcion_caso.txt' }
        );

        const erroresLectura = [];
        for (const adj of adjuntos) {
            const rutaAbsoluta = path.join(uploadDir,path.basename(adj.file_path));
            try {
                if (fs.existsSync(rutaAbsoluta)) {
                    archive.file(rutaAbsoluta, { name: adj.file_name });
                } else {
                    erroresLectura.push(adj.file_name);
                }
            } catch (e) {
                erroresLectura.push(adj.file_name);
            }
        }

        // Excepción: Archivos dañados → se informa el error de lectura y se descarga el resto
        if (erroresLectura.length > 0) {
            archive.append(`No fue posible leer los siguientes archivos:\n${erroresLectura.join('\n')}`, { name: 'errores_lectura.txt' });
        }

        await archive.finalize();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: 'Error compilando los adjuntos' });
    }
});

// ==========================================
// RF-60 — INFORME DE DESEMPEÑO POR ESPECIALISTA
// ==========================================
app.get('/reportes/desempeno-tecnico', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Debes indicar un técnico.' });

    try {
        const [tecRows] = await pool.query('SELECT first_name FROM user WHERE user_id = ?', [user_id]);
        if (tecRows.length === 0) return res.status(404).json({ error: 'Técnico no encontrado' });

        const [resueltos] = await pool.query(`
            SELECT COUNT(*) as total, AVG(TIMESTAMPDIFF(MINUTE, creation_date, resolution_date)) as promedio_min
            FROM ticket WHERE assigned_user_id = ? AND status_id IN (4,6) AND resolution_date IS NOT NULL
        `, [user_id]);

        const [reabiertos] = await pool.query(`
            SELECT COUNT(*) as total FROM ticket WHERE assigned_user_id = ? AND reopen_count > 0
        `, [user_id]);

        // Excepción: Técnico sin tickets asignados → el reporte se muestra en cero
        const totalResueltos = resueltos[0].total || 0;
        const promedioHoras = resueltos[0].promedio_min ? Number((resueltos[0].promedio_min / 60).toFixed(1)) : 0;

        const [promedioEquipo] = await pool.query(`
            SELECT AVG(TIMESTAMPDIFF(MINUTE, t.creation_date, t.resolution_date)) as promedio_min
            FROM ticket t
            JOIN user u ON t.assigned_user_id = u.user_id
            JOIN user_role ur ON u.user_id = ur.user_id
            WHERE ur.active = 1 AND u.user_status = 1
              AND (ur.role_id = 1 OR u.is_critical_tech = 1 OR u.tipo_usuario = 'TECNICO')
              AND t.status_id IN (4,6) AND t.resolution_date IS NOT NULL
        `);
        const promedioEquipoHoras = promedioEquipo[0].promedio_min ? Number((promedioEquipo[0].promedio_min / 60).toFixed(1)) : 0;

        const [[traslados]]=await pool.query('SELECT COUNT(*) total,SUM(observed=1) observados,AVG(CASE WHEN observed=0 THEN seconds END)/60 promedio FROM inc3_travel WHERE user_id=? AND arrived_at IS NOT NULL',[user_id]);
        res.json(new (require('./reports').ReporteDesempeno)().generar({
            tecnico: tecRows[0].first_name,
            totalResueltos,
            totalReabiertos: reabiertos[0].total || 0,
            promedioHoras,
            promedioEquipoHoras,
            traslados:traslados.total,marcacionesObservadas:Number(traslados.observados||0),promedioMinutosTraslado:Number(Number(traslados.promedio||0).toFixed(1))
        }));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el informe de desempeño' });
    }
});

// ==========================================
// RF-64 — REPORTANDO RÁPIDAMENTE MEDIANTE CÓDIGO DE ACTIVO
// ==========================================
app.get('/equipos/:id/qr', async (req, res) => {
    try {
        const [equipos] = await pool.query('SELECT equipment_id, equipment_name FROM equipment WHERE equipment_id = ?', [req.params.id]);
        if (equipos.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });

        const url = `${req.protocol}://${req.get('host')}/?equipo=${equipos[0].equipment_id}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        res.json({ qr: qrDataUrl, nombre: equipos[0].equipment_name, url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando el QR del equipo' });
    }
});

app.get('/equipos/:id', async (req, res) => {
    try {
        // El sistema identifica el ID del activo y su categoría
        const [equipos] = await pool.query(
            'SELECT equipment_id, equipment_name, location, equipment_type FROM equipment WHERE equipment_id = ?',
            [req.params.id]
        );
        if (equipos.length === 0) return res.status(404).json({ error: 'Equipo no reconocido' });
        res.json(equipos[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el equipo' });
    }
});

// ── Alta de equipos desde la interfaz (para no depender de SQL manual) ──
const TIPOS_EQUIPO_VALIDOS = ['Computador/Hardware', 'Impresora', 'Teléfono IP', 'Sistema/Software', 'Red/Internet', 'Sistema Externo (ej. IMER)'];

app.get('/equipos', async (req, res) => {
    try {
        const [equipos] = await pool.query(
            'SELECT equipment_id, equipment_name, location, equipment_type FROM equipment ORDER BY equipment_id DESC'
        );
        res.json(equipos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo el listado de equipos' });
    }
});

app.post('/equipos', async (req, res) => {
    const { equipment_name, piso, habitacion, equipment_type } = req.body;

    if (!equipment_name || !equipment_name.trim()) {
        return res.status(400).json({ error: 'El nombre del equipo es obligatorio.' });
    }
    if (!piso || !habitacion || !habitacion.trim()) {
        return res.status(400).json({ error: 'Debes indicar el piso y la habitación/área del equipo.' });
    }
    if (!TIPOS_EQUIPO_VALIDOS.includes(equipment_type)) {
        return res.status(400).json({ error: 'Selecciona un tipo de equipo válido.' });
    }

    try {
        const [existente] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_name = ?', [equipment_name.trim()]);
        if (existente.length > 0) {
            return res.status(400).json({ error: `Ya existe un equipo registrado con el nombre "${equipment_name.trim()}".` });
        }

        const location = `${piso} - ${habitacion.trim()}`;
        const [resultado] = await pool.query(
            'INSERT INTO equipment (equipment_name, location, equipment_type) VALUES (?, ?, ?)',
            [equipment_name.trim(), location, equipment_type]
        );

        res.json({ success: true, message: `Equipo "${equipment_name.trim()}" agregado correctamente.`, equipment_id: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error agregando el equipo' });
    }
});

app.delete('/equipos/:id', async (req, res) => {
    try {
        const [usados] = await pool.query('SELECT ticket_id FROM ticket WHERE equipment_id = ? LIMIT 1', [req.params.id]);
        if (usados.length > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: este equipo ya tiene tickets asociados.' });
        }
        await pool.query('DELETE FROM equipment WHERE equipment_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error eliminando el equipo' });
    }
});

// ==========================================
// RUTAS — MANUALES PDF
// ==========================================
app.get('/manuales', async (req, res) => {
    try {
        const archivos = fs.readdirSync(manualesDir);
        const manuales = archivos
            .filter(f => /\.pdf$/i.test(f))
            .map(f => {
                const stat = fs.statSync(path.join(manualesDir, f));
                const nombreOriginal = f.replace(/^\d+-/, '');
                return {
                    filename: f,
                    nombre: nombreOriginal,
                    url: '/manuales/' + f,
                    tamañoMb: (stat.size / (1024 * 1024)).toFixed(2),
                    fecha: stat.birthtime.toLocaleDateString('es-CL')
                };
            })
            .sort((a, b) => b.fecha.localeCompare(a.fecha));

        res.json(manuales);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error listando manuales' });
    }
});

app.post('/manuales/subir', (req, res) => {
    multer({storage:storageManual,limits:{fileSize:inc3.config.manual_mb*1024*1024},fileFilter:(req,file,cb)=>cb(file.mimetype==='application/pdf'?null:new Error('Solo se permiten PDF'),file.mimetype==='application/pdf')}).single('manual')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo excede el límite de '+inc3.config.manual_mb+' MB.' });
            }
            return res.status(500).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const nombreOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
        const tamañoMb = (req.file.size / (1024 * 1024)).toFixed(2);

        res.json({
            success: true,
            message: `Manual "${nombreOriginal}" subido correctamente.`,
            url: '/manuales/' + req.file.filename,
            filename: req.file.filename,
            nombre: nombreOriginal,
            tamañoMb: tamañoMb
        });
    });
});

app.delete('/manuales/:filename', (req, res) => {
    const filename = req.params.filename;

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nombre de archivo inválido.' });
    }

    const filePath = path.join(manualesDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Manual no encontrado.' });
    }

    try {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Manual eliminado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error eliminando manual.' });
    }
});

app.use('/manuales', express.static(manualesDir));

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
require('./acceptance')(app, { pool, validarRutModulo11, enviarCorreoOperativo });

inc3.captureErrors();
inc3.ready.then(()=>{const server=app.listen(PORT, () => {
    inc3.startJobs();
    console.log(`Servidor corriendo en http://localhost:${PORT}`);

    setInterval(procesarColaCorreos, 60 * 1000);

    // ── RF-29: motor de monitoreo de SLA — se ejecuta cada 5 minutos ──
    const {T_MonitoreoSLA,T_CierreAutomatico}=require('./domain');
    const slaTask=new T_MonitoreoSLA(ejecutarMonitoreoConReintento);
    slaTask.ejecutar();
    setInterval(()=>slaTask.ejecutar(), 5 * 60 * 1000);

    // ── RF-33: verifica cada hora si corresponde despachar el reporte gerencial ──
    setInterval(verificarReportesProgramados, 60 * 60 * 1000);

    // ── RF-61: revisa diariamente si hay tickets Resueltos sin respuesta hace 7+ días ──
    const closeTask=new T_CierreAutomatico(cerrarTicketsInactivos);
    closeTask.ejecutar();
    setInterval(()=>closeTask.ejecutar(), 24 * 60 * 60 * 1000);
});inc3.attachServer(server);return server;}).catch(error=>{console.error('No se pudo iniciar el incremento 3:',error.message);process.exitCode=1;});
