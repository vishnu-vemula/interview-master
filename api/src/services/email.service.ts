import logger from '../config/logger';

type Email = { to: string; subject: string; text: string; html?: string };

/**
 * Transactional email.
 *  - RESEND_API_KEY + EMAIL_FROM set → delivered through the Resend HTTP API.
 *  - Otherwise, outside production, the message is written to the server log so
 *    flows such as password reset can be completed locally.
 */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail({ to, subject, text, html }: Email): Promise<{ delivered: boolean }> {
  if (emailConfigured()) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status})`);
    return { delivered: true };
  }
  if (process.env.NODE_ENV === 'production') {
    logger.error(`Email not sent (no provider configured): "${subject}"`);
    return { delivered: false };
  }
  logger.info(`[dev email] to=${to} subject="${subject}"\n${text}`);
  return { delivered: false };
}
