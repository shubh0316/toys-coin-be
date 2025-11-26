const nodemailer = require("nodemailer");

let transporterPromise = null;

function resetTransporter() {
    transporterPromise = null;
}

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
            connectionTimeout: 120000, // 60 seconds to establish connection
            greetingTimeout: 30000, // 30 seconds to receive greeting
            socketTimeout: 60000, // 60 seconds for socket inactivity
            // Keep connection alive for better reliability
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
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

async function sendMail(options, retries = 2) {
    let transporter = await createTransporter();
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[mailer] Retry attempt ${attempt} for email to ${options.to}`);
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }

            const info = await Promise.race([
                transporter.sendMail({
                    from: process.env.SMTP_FROM_EMAIL || '"Toys Coin" <support@toyscoin.org>',
                    ...options,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Email send timeout after 60 seconds')), 60000)
                )
            ]);

            const previewUrl = nodemailer.getTestMessageUrl(info);
            return {
                ...info,
                previewUrl,
            };
        } catch (error) {
            const isLastAttempt = attempt === retries;
            const isTimeoutError = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
            const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.command === 'CONN';
            
            console.error(`[mailer] Error sending email (attempt ${attempt + 1}/${retries + 1}):`, {
                error: error.message,
                code: error.code,
                command: error.command,
                to: options.to,
                subject: options.subject,
            });

            // Reset transporter on connection errors to force a new connection
            if (isConnectionError && attempt < retries) {
                console.log('[mailer] Resetting transporter due to connection error');
                resetTransporter();
                transporter = await createTransporter();
            }

            // If it's the last attempt or not a timeout/connection error, throw immediately
            if (isLastAttempt || (!isTimeoutError && !isConnectionError)) {
                throw error;
            }
            
            // Otherwise, continue to retry
        }
    }
}

module.exports = {
    sendMail,
};

