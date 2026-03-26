import nodemailer from "nodemailer";
import { config } from "../../config/env";
import { SendEmailDTO } from "../../shared/types/email.types";

export class EmailService {

  private static transporter = nodemailer.createTransport({
    host: config.smtpConfig.smtp_host,
    port: config.smtpConfig.smtp_port,
    auth: {
      user: config.smtpConfig.smtp_user,
      pass: config.smtpConfig.smtp_pass
    }
  });

  static async sendEmail(data: SendEmailDTO) {

    await this.transporter.sendMail({
      from: `"WorkHub" <${config.smtpConfig.smtp_user}>`,
      to: data.to,
      subject: data.subject,
      html: data.html
    });

  }
}