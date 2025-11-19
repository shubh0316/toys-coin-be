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
            connectionTimeout: 10000, // 10 seconds to establish connection
            greetingTimeout: 10000, // 10 seconds to receive greeting
            socketTimeout: 10000, // 10 seconds for socket inactivity
            // Enable debug logging in development
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
        };

        if (GMAIL_USER && GMAIL_APP_PASSWORD) {
            return nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_APP_PASSWORD,
                },
                ...connectionOptions,
            });
        }

        if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
            return nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT) || 587,
                secure: String(SMTP_SECURE).toLowerCase() === "true",
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS,
                },
                ...connectionOptions,
            });
        }

        const testAccount = await nodemailer.createTestAccount();
        console.warn(
            "[mailer] SMTP credentials missing. Using temporary Ethereal account for testing:",
            {
                user: testAccount.user,
                pass: testAccount.pass,
            }
        );

        return nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
            ...connectionOptions,
        });
    })();

    return transporterPromise;
}

async function sendMail(options) {
    try {
        const transporter = await createTransporter();
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || '"Toys Coin" <support@toyscoin.org>',
            ...options,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        return {
            ...info,
            previewUrl,
        };
    } catch (error) {
        console.error('[mailer] Error sending email:', {
            error: error.message,
            code: error.code,
            command: error.command,
            to: options.to,
            subject: options.subject,
        });
        throw error;
    }
}

module.exports = {
    sendMail,
};

