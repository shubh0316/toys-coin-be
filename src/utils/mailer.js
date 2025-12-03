const sgMail = require("@sendgrid/mail");

/**
 * Email Service with SendGrid Only
 * 
 * Usage:
 *   await sendMail({
 *     to: "user@example.com",
 *     subject: "Welcome",
 *     html: "<h1>Hello</h1>",
 *     text: "Hello",
 *   });
 *
 * Supported options:
 * - to: string | string[]
 * - subject: string
 * - html?: string
 * - text?: string
 * - templateId?: string (SendGrid Dynamic Template)
 * - dynamicTemplateData?: object (for Dynamic Templates)
 *
 * Required environment variables:
 * - SENDGRID_API_KEY: SendGrid API key
 * - SENDGRID_FROM_EMAIL: Default "from" email (verified in SendGrid)
 *
 * Notes:
 * - This service only uses SendGrid. No AWS SES, Gmail, or other SMTP.
 * - If SendGrid fails, an Error is thrown with a helpful message.
 */

let isInitialized = false;

function initSendGrid() {
  if (isInitialized) return;

  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SENDGRID_API_KEY is required. Please set the SENDGRID_API_KEY environment variable."
    );
  }

  sgMail.setApiKey(apiKey);
  isInitialized = true;

  console.log("[mailer] SendGrid initialized");
}

/**
 * Send an email using SendGrid
 */
async function sendMail(options) {
  initSendGrid();

  const fromEmail =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    "support@fostertoys.org";

  if (!fromEmail) {
    throw new Error(
      "From email is required. Please set SENDGRID_FROM_EMAIL or SMTP_FROM_EMAIL environment variable."
    );
  }

  if (!options || typeof options !== "object") {
    throw new Error("sendMail options must be an object.");
  }

  const { to, subject, html, text, templateId, dynamicTemplateData } = options;

  if (!to) {
    throw new Error("Recipient email address (to) is required.");
  }

  if (!subject && !templateId) {
    throw new Error(
      "Email subject is required unless you are using a SendGrid Dynamic Template (templateId)."
    );
  }

  if (!html && !text && !templateId) {
    throw new Error(
      "Either html, text, or templateId must be provided to send an email."
    );
  }

  try {
    const msg = {
      to,
      from: fromEmail,
      subject,
    };

    // If using a dynamic template
    if (templateId) {
      msg.templateId = templateId;
      if (dynamicTemplateData) {
        msg.dynamicTemplateData = dynamicTemplateData;
      }
      console.log(
        `[mailer] Sending SendGrid Dynamic Template email to ${Array.isArray(to) ? to.join(
          ", "
        ) : to} (templateId: ${templateId})`
      );
    } else {
      // Inline content
      if (html) {
        msg.html = html;
      }
      if (text) {
        msg.text = text;
      }
      console.log(
        `[mailer] Sending SendGrid email to ${Array.isArray(to) ? to.join(
          ", "
        ) : to} with subject "${subject}"`
      );
    }

    const response = await sgMail.send(msg);

    const messageId =
      response?.[0]?.headers?.["x-message-id"] ||
      response?.[0]?.headers?.["X-Message-Id"] ||
      "sent";

    console.log(
      `[mailer] ✅ Email sent successfully via SendGrid to ${
        Array.isArray(to) ? to.join(", ") : to
      }`
    );

    return {
      messageId,
      response,
    };
  } catch (error) {
    // SendGrid error format
    const sgErrorBody = error?.response?.body;
    console.error("[mailer] ❌ SendGrid error:", {
      message: error.message,
      code: error.code,
      response: sgErrorBody,
      to,
      subject,
    });

    if (sgErrorBody && sgErrorBody.errors && Array.isArray(sgErrorBody.errors)) {
      const messages = sgErrorBody.errors.map((e) => e.message).join("; ");

      // Handle common SendGrid errors more clearly
      if (messages.toLowerCase().includes("permission") ||
          messages.toLowerCase().includes("api key")) {
        throw new Error(
          `SendGrid error: API key or permissions issue. Please verify SENDGRID_API_KEY. Details: ${messages}`
        );
      }

      if (messages.toLowerCase().includes("not authorized")) {
        throw new Error(
          `SendGrid error: Not authorized. Please check your SendGrid account and API key permissions. Details: ${messages}`
        );
      }

      if (messages.toLowerCase().includes("maximum credits exceeded")) {
        throw new Error(
          "SendGrid error: Maximum credits exceeded. Your SendGrid account has reached its email sending limit."
        );
      }

      throw new Error(`SendGrid error: ${messages}`);
    }

    // Generic SendGrid / network error
    throw new Error(
      `SendGrid error: ${error.message || "Unknown error occurred while sending email"}`
    );
  }
}

module.exports = {
  sendMail,
};

const nodemailer = require('nodemailer');

/**
 * Email Service with AWS SES SMTP (via Nodemailer)
 * 
 * Uses AWS Simple Email Service (SES) SMTP interface to send emails via Nodemailer.
 * 
 * Example usage:
 *    await sendMail({
 *      to: 'user@example.com',
 *      subject: 'Welcome',
 *      html: '<h1>Hello</h1>',
 *      text: 'Hello'
 *    });
 * 
 * Environment Variables (Required):
 * - USER_NAME_SES: AWS SES SMTP Username
 * - USER_PASSWORD_SES: AWS SES SMTP Password
 * - AWS_REGION: AWS region (e.g., us-east-1, us-west-2)
 * - AWS_SES_FROM_EMAIL: Verified sender email address in SES (optional, falls back to SMTP_FROM_EMAIL or default)
 * 
 * Note: The sender email must be verified in AWS SES before sending emails.
 */

let transporter = null;

function getTransporter() {
    if (!transporter) {
        const {
            USER_NAME_SES,
            USER_PASSWORD_SES,
            AWS_REGION,
        } = process.env;

        if (!USER_NAME_SES || !USER_PASSWORD_SES) {
            throw new Error(
                'AWS SES SMTP credentials are required. Please set USER_NAME_SES and USER_PASSWORD_SES environment variables.'
            );
        }

        if (!AWS_REGION) {
            throw new Error(
                'AWS_REGION is required. Please set the AWS_REGION environment variable (e.g., us-east-1).'
            );
        }

        // Clean credentials: trim whitespace, newlines, carriage returns, and remove quotes
        const smtpUsername = USER_NAME_SES.trim().replace(/^["']|["']$/g, '').replace(/\r?\n/g, '');
        const smtpPassword = USER_PASSWORD_SES.trim().replace(/^["']|["']$/g, '').replace(/\r?\n/g, '');
        const region = AWS_REGION.trim().replace(/^["']|["']$/g, '').replace(/\r?\n/g, '');

        // AWS SES SMTP endpoint format: email-smtp.{region}.amazonaws.com
        const smtpHost = `email-smtp.${region}.amazonaws.com`;
        const smtpPort = 587; // Port 587 for TLS, or 465 for SSL

        // Debug: Log configuration (for security, don't log full credentials)
        console.log(`[mailer] AWS SES SMTP configuration:`);
        console.log(`[mailer]   Host: ${smtpHost}`);
        console.log(`[mailer]   Port: ${smtpPort}`);
        console.log(`[mailer]   Username: ${smtpUsername.substring(0, 8)}...${smtpUsername.substring(smtpUsername.length - 4)} (length: ${smtpUsername.length})`);
        console.log(`[mailer]   Region: ${region}`);

            transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: false, // true for 465, false for other ports (587 uses TLS)
                auth: {
                user: smtpUsername,
                pass: smtpPassword,
            },
            tls: {
                // Do not fail on invalid certificates
                rejectUnauthorized: false,
            },
            // Connection timeout settings
            connectionTimeout: 30000, // 30 seconds
            greetingTimeout: 15000, // 15 seconds
            socketTimeout: 30000, // 30 seconds
        });

        console.log(`[mailer] AWS SES SMTP transporter initialized`);
    }

        return transporter;
}

async function sendMail(options) {
    const {
        USER_NAME_SES,
        USER_PASSWORD_SES,
        AWS_REGION,
    } = process.env;

    // Validate required environment variables
    if (!USER_NAME_SES || !USER_PASSWORD_SES) {
        throw new Error(
            'AWS SES SMTP credentials are required. Please set USER_NAME_SES and USER_PASSWORD_SES environment variables.'
        );
    }

    if (!AWS_REGION) {
        throw new Error(
            'AWS_REGION is required. Please set the AWS_REGION environment variable (e.g., us-east-1).'
        );
    }

    const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@fostertoys.org';

    if (!fromEmail) {
        throw new Error(
            'From email is required. Please set AWS_SES_FROM_EMAIL or SMTP_FROM_EMAIL environment variable.'
        );
    }

    // Validate required options
    if (!options.to) {
        throw new Error('Recipient email address (to) is required.');
    }

    if (!options.subject) {
        throw new Error('Email subject is required.');
    }

    if (!options.html && !options.text) {
        throw new Error('Either HTML or text content is required.');
    }

    try {
        const mailTransporter = getTransporter();

        console.log(`[mailer] Sending email via AWS SES SMTP to ${options.to}`);

        // Prepare email options for Nodemailer
        const mailOptions = {
            from: fromEmail,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
        };
        
        // Add HTML content if provided
            if (options.html) {
            mailOptions.html = options.html;
            }

        // Add text content if provided
            if (options.text) {
            mailOptions.text = options.text;
        } else if (options.html) {
            // If only HTML is provided, create a basic text version
            const textContent = options.html
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
            mailOptions.text = textContent || 'Please view this email in an HTML-enabled email client.';
        }

        // Send email using Nodemailer
        const info = await mailTransporter.sendMail(mailOptions);

        console.log(`[mailer] ✅ Email sent successfully via AWS SES SMTP to ${options.to}`);
        console.log(`[mailer] Message ID: ${info.messageId}`);

        return {
            messageId: info.messageId || 'sent',
            response: info,
        };
    } catch (error) {
        console.error(`[mailer] ❌ AWS SES SMTP error:`, {
            error: error.message,
            code: error.code,
            command: error.command,
            to: options.to,
            subject: options.subject,
        });
        
        // Provide helpful error messages
        if (error.code === 'EAUTH' || error.message.includes('authentication')) {
            throw new Error(
                `AWS SES SMTP error: Authentication failed. Please verify your USER_NAME_SES and USER_PASSWORD_SES credentials are correct. ` +
                `Details: ${error.message}`
            );
        }

        if (error.code === 'ECONNECTION' || error.message.includes('connection')) {
                throw new Error(
                `AWS SES SMTP error: Connection failed. Please check your network connection and AWS_REGION setting. ` +
                `Details: ${error.message}`
            );
        }

        // Check for email verification errors (AWS SES sandbox mode)
        if (error.message && (error.message.includes('Email address is not verified') || error.message.includes('not verified'))) {
            const emailMatch = error.message.match(/failed the check in region [^:]+: ([^\s]+)/);
            const unverifiedEmail = emailMatch ? emailMatch[1] : 'recipient email';
            
                throw new Error(
                `AWS SES Sandbox Mode: The email address "${unverifiedEmail}" is not verified in AWS SES. ` +
                `In sandbox mode, you can only send emails to verified addresses. ` +
                `Please verify this email address in AWS SES Console, or request production access to send to any email address. ` +
                `Details: ${error.message}`
            );
        }

        if (error.message && error.message.includes('MessageRejected')) {
            throw new Error(
                `AWS SES SMTP error: Message rejected. The email address may not be verified in SES, or there may be content issues. ` +
                `Details: ${error.message}`
            );
        }

        // Generic AWS SES SMTP error
        throw new Error(
            `AWS SES SMTP error: ${error.message || 'Unknown error occurred while sending email'}`
        );
    }
}

module.exports = {
    sendMail,
};
