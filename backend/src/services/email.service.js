const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@eventhorizon.local';
const EMAIL_RETRY_ATTEMPTS = Number(process.env.EMAIL_RETRY_ATTEMPTS || 3);
const EMAIL_RETRY_BASE_MS = Number(process.env.EMAIL_RETRY_BASE_MS || 1000);

let smtpTransporter;

const templateRegistry = {
    'event-notification': ({ eventName, contractId, payload }) => {
        const safeEventName = escapeHtml(eventName || 'UnknownEvent');
        const safeContractId = escapeHtml(contractId || 'UnknownContract');
        const safePayload = escapeHtml(JSON.stringify(payload || {}, null, 2));

        return {
            subject: `[EventHorizon] ${safeEventName} detected`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
                    <h2 style="margin: 0 0 12px;">Event Triggered</h2>
                    <p style="margin: 0 0 8px;"><strong>Event:</strong> ${safeEventName}</p>
                    <p style="margin: 0 0 16px;"><strong>Contract:</strong> ${safeContractId}</p>
                    <p style="margin: 0 0 8px;"><strong>Payload</strong></p>
                    <pre style="background: #f3f4f6; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; overflow-x: auto;">${safePayload}</pre>
                </div>
            `,
            text: `Event Triggered\nEvent: ${eventName || 'UnknownEvent'}\nContract: ${contractId || 'UnknownContract'}\nPayload: ${JSON.stringify(payload || {})}`,
        };
    },
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSmtpTransporter() {
    if (smtpTransporter) return smtpTransporter;

    const port = Number(process.env.SMTP_PORT || 587);
    const useSecure = process.env.SMTP_SECURE === 'true' || port === 465;

    smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: useSecure,
        auth: process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
            : undefined,
    });

    return smtpTransporter;
}

function isTransientError(error) {
    const statusCode = error?.response?.statusCode || error?.code;
    const smtpCode = error?.responseCode;

    if (typeof statusCode === 'number') {
        return statusCode === 429 || statusCode >= 500;
    }

    if (typeof smtpCode === 'number') {
        return smtpCode >= 500 || [421, 450, 451, 452].includes(smtpCode);
    }

    const transientCodes = new Set([
        'ETIMEDOUT',
        'ECONNECTION',
        'ECONNRESET',
        'EAI_AGAIN',
        'ESOCKET',
    ]);

    return transientCodes.has(String(statusCode));
}

async function sendWithRetry(sendFn, context = {}) {
    let lastError;

    for (let attempt = 1; attempt <= EMAIL_RETRY_ATTEMPTS; attempt += 1) {
        try {
            return await sendFn();
        } catch (error) {
            lastError = error;

            if (!isTransientError(error) || attempt === EMAIL_RETRY_ATTEMPTS) {
                throw error;
            }

            const waitMs = EMAIL_RETRY_BASE_MS * (2 ** (attempt - 1));
            console.warn(
                `[EmailService] Transient failure on attempt ${attempt}/${EMAIL_RETRY_ATTEMPTS}. Retrying in ${waitMs}ms`,
                {
                    provider: EMAIL_PROVIDER,
                    to: context.to,
                    reason: error.message,
                }
            );
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }

    throw lastError;
}

function renderTemplate(templateName, templateData) {
    const template = templateRegistry[templateName];
    if (!template) {
        throw new Error(`Unknown email template: ${templateName}`);
    }

    return template(templateData || {});
}

async function sendEmail({ to, subject, html, text, templateName, templateData }) {
    if (!to) {
        throw new Error('Email recipient is required');
    }

    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    if (templateName) {
        const rendered = renderTemplate(templateName, templateData);
        finalSubject = finalSubject || rendered.subject;
        finalHtml = finalHtml || rendered.html;
        finalText = finalText || rendered.text;
    }

    if (!finalSubject || (!finalHtml && !finalText)) {
        throw new Error('Email content is incomplete. Provide subject and html/text or a valid template.');
    }

    return sendWithRetry(async () => {
        if (EMAIL_PROVIDER === 'sendgrid') {
            if (!process.env.SENDGRID_API_KEY) {
                throw new Error('SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid');
            }

            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const [response] = await sgMail.send({
                to,
                from: EMAIL_FROM,
                subject: finalSubject,
                html: finalHtml,
                text: finalText,
            });

            return {
                provider: 'sendgrid',
                statusCode: response?.statusCode,
                headers: response?.headers,
            };
        }

        const transporter = getSmtpTransporter();
        const info = await transporter.sendMail({
            to,
            from: EMAIL_FROM,
            subject: finalSubject,
            html: finalHtml,
            text: finalText,
        });

        return {
            provider: 'smtp',
            messageId: info?.messageId,
            accepted: info?.accepted,
            rejected: info?.rejected,
            response: info?.response,
        };
    }, { to });
}

async function sendEventNotification({ recipient, trigger, payload }) {
    const to = recipient || trigger?.actionUrl;

    return sendEmail({
        to,
        templateName: 'event-notification',
        templateData: {
            eventName: trigger?.eventName,
            contractId: trigger?.contractId,
            payload,
        },
    });
}

module.exports = {
    sendEmail,
    sendEventNotification,
    renderTemplate,
};
