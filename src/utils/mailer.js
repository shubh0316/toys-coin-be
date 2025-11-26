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
            connectionTimeout: 60000, // 60 seconds to establish connection
            greetingTimeout: 30000, // 30 seconds to receive greeting
            socketTimeout: 60000, // 60 seconds for socket inactivity
            // Enable debug logging in development
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
        };

        let transporter;

        if (GMAIL_USER && GMAIL_APP_PASSWORD) {
            console.log('[mailer] Using Gmail SMTP configuration');
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_APP_PASSWORD,
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

        // Verify connection
        try {
            await transporter.verify();
            console.log('[mailer] ✅ SMTP connection verified successfully');
        } catch (verifyError) {
            console.error('[mailer] ❌ SMTP connection verification failed:', verifyError.message);
            // Don't throw here - let it fail on actual send so we can retry
        }

        return transporter;
    })();

    return transporterPromise;
}

async function sendMail(options, retries = 2) {
    // Check if SMTP credentials are configured
    const hasGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
    const hasSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    
    if (!hasGmail && !hasSMTP) {
        const error = new Error('SMTP credentials not configured. Please set GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST + SMTP_USER + SMTP_PASS environment variables.');
        console.error('[mailer] ❌', error.message);
        throw error;
    }

    let transporter = await createTransporter();
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[mailer] Retry attempt ${attempt} for email to ${options.to}`);
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }

            console.log(`[mailer] Sending email to ${options.to} (attempt ${attempt + 1}/${retries + 1})`);

            const info = await Promise.race([
                transporter.sendMail({
                    from: process.env.SMTP_FROM_EMAIL || '"Foster Toys" <support@fostertoys.org>',
                    ...options,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Email send timeout after 60 seconds')), 60000)
                )
            ]);

            console.log(`[mailer] ✅ Email sent successfully to ${options.to}`);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            return {
                ...info,
                previewUrl,
            };
        } catch (error) {
            const isLastAttempt = attempt === retries;
            const isTimeoutError = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
            const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.command === 'CONN';
            
            console.error(`[mailer] ❌ Error sending email (attempt ${attempt + 1}/${retries + 1}):`, {
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
            
            // Otherwise, continue to retry
        }
    }
}

module.exports = {
    sendMail,
};

