// =============================================================================
// Shared SMTP mailer — nodemailer with SpaceMail (port 465 / implicit TLS)
// =============================================================================
// Required environment variables (set in functions/.env or Firebase config):
//   SMTP_HOST  — outgoing server (default: mail.spacemail.com)
//   SMTP_PORT  — outgoing port   (default: 465)
//   SMTP_USER  — login / from address
//   SMTP_PASS  — password
// =============================================================================

const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.spacemail.com",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: true, // port 465 = implicit SSL/TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Drop-in replacement for the previous transactional email API.
 *
 * @param {{
 *   subject: string,
 *   htmlContent: string,
 *   sender?: { name: string, email?: string },
 *   to: Array<{ email: string, name?: string }>
 * }} opts
 */
async function sendEmail({ subject, htmlContent, sender, to }) {
  // The FROM address must be the authenticated SMTP account.
  // Use the caller-supplied display name (e.g. company name) but always
  // send through the configured mailbox.
  const fromName = sender?.name || "MeritCyc";
  const fromAddress = process.env.SMTP_USER;

  const toAddresses = Array.isArray(to)
    ? to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(", ")
    : to;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: toAddresses,
      subject,
      html: htmlContent,
    });
  } catch (err) {
    logger.error("SMTP sendEmail failed:", err.message || err);
    throw err;
  }
}

module.exports = { sendEmail };
