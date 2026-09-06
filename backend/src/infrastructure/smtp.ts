import * as nodemailer from 'nodemailer';
import { settings } from '../config';

export async function sendSmtpEmail(opts: {
  toEmail: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; detail: string }> {
  try {
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
    await transport.sendMail({
      from: settings.smtpFrom,
      to: opts.toEmail,
      subject: opts.subject,
      text: opts.body,
    });
    return { ok: true, detail: `smtp://${settings.smtpHost}:${settings.smtpPort}` };
  } catch (ex: any) {
    return { ok: false, detail: `${ex?.name || 'Error'}: ${ex?.message || ex}` };
  }
}
