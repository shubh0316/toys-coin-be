const nodemailer = require("nodemailer");

let transporterPromise = null;

async function createTransporter() {
    if (transporterPromise) {
        return transporterPromise;
    }

    transporterPromise = (async () => {
        const {
            SMTP_HOST,
            SMTP_PORT,
            SMTP_SECURE,
            SMTP_USER,
            SMTP_PASS,
            GMAIL_USER,
            GMAIL_APP_PASSWORD,
        } = process.env;

        // Common connection options for all transports
        const connectionOptions = {
            connectionTimeout: 30000, // 30 seconds to establish connection
            greetingTimeout: 15000, // 15 seconds to receive greeting
            socketTimeout: 30000, // 30 seconds for socket inactivity
            // Enable debug logging in development
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
        };

        let transporter;

        if (GMAIL_USER && GMAIL_APP_PASSWORD) {
            console.log('[mailer] Using Gmail SMTP configuration');
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true for 465, false for other ports
                requireTLS: true,
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_APP_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false
                },
                ...connectionOptions,
            });
        } else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
            console.log('[mailer] Using custom SMTP configuration:', {
                host: SMTP_HOST,
                port: SMTP_PORT || 587,
                secure: SMTP_SECURE,
                user: SMTP_USER,
            });
            transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT) || 587,
                secure: String(SMTP_SECURE).toLowerCase() === "true",
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS,
                },
                ...connectionOptions,
            });
        } else {
            console.warn('[mailer] ⚠️  SMTP credentials missing! Emails will not be sent in production.');
            console.warn('[mailer] Please set either GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST + SMTP_USER + SMTP_PASS');
            
            const testAccount = await nodemailer.createTestAccount();
            console.warn(
                "[mailer] Using temporary Ethereal account for testing:",
                {
                    user: testAccount.user,
                    pass: testAccount.pass,
                }
            );

            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
                ...connectionOptions,
            });
        }

        // Skip verification - it can timeout, but actual sends might work
        console.log('[mailer] Transporter created (skipping verification to avoid timeouts)');

        return transporter;
    })();

    return transporterPromise;
}

async function sendMail(options) {
    // Check if SMTP credentials are configured
    const hasGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
    const hasSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    
    if (!hasGmail && !hasSMTP) {
        const error = new Error('SMTP credentials not configured. Please set GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST + SMTP_USER + SMTP_PASS environment variables.');
        console.error('[mailer] ❌', error.message);
        throw error;
    }

    const transporter = await createTransporter();
    
    try {
        console.log(`[mailer] Sending email to ${options.to}`);

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || '"Foster Toys" <support@fostertoys.org>',
            ...options,
        });

        console.log(`[mailer] ✅ Email sent successfully to ${options.to}`);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        return {
            ...info,
            previewUrl,
        };
    } catch (error) {
        console.error(`[mailer] ❌ Error sending email:`, {
            error: error.message,
            code: error.code,
            command: error.command,
            to: options.to,
            subject: options.subject,
        });

        // Provide helpful error message
        if (error.code === 'EAUTH') {
            throw new Error('SMTP authentication failed. Please check your email credentials.');
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error('SMTP connection timeout. Please check your network connection and SMTP server settings.');
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error('SMTP connection refused. Please check your SMTP host and port settings.');
        }
        throw error;
    }
}

module.exports = {
    sendMail,
};

