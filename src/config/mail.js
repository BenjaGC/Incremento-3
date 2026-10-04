const nodemailer = require('nodemailer');

module.exports = nodemailer.createTransport({
    ...(process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: process.env.SMTP_SECURE !== 'true'
    } : { service: 'gmail' }),
    connectionTimeout: 15000,
    socketTimeout: 30000,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});
