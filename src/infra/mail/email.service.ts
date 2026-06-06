import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { SendEmailDTO } from './email.types.js';

const resend = new Resend(env.mail.resendApiKey);

export class EmailService {
  static async sendEmail(data: SendEmailDTO): Promise<void> {
    const { error } = await resend.emails.send({
      from: env.mail.fromAddress,
      to: data.to,
      subject: data.subject,
      html: data.html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}