import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Mail = { to: string; subject: string; text: string };

/**
 * Sends transactional email through Resend when RESEND_API_KEY is set.
 * Otherwise the message is written to storage/outbox/ so flows stay testable locally.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Halden <orders@example.com>',
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!res.ok) console.error('[mailer] Resend rejected the message', res.status, await res.text());
    return;
  }
  try {
    const dir = join(process.cwd(), 'storage', 'outbox');
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9]+/gi, '_')}.txt`;
    await writeFile(join(dir, name), `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
  } catch (err) {
    console.error('[mailer] could not write to the outbox', err);
  }
}
