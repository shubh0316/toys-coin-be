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
