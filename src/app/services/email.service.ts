import nodemailer from "nodemailer";
import { mailConfig } from "../../config/mail.config";
import { SendEmailDTO } from "../../shared/types/email.types";

export class EmailService {

  private static transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass
    }
  });

  static async sendEmail(data: SendEmailDTO) {

    await this.transporter.sendMail({
      from: `"WorkHub" <${mailConfig.user}>`,
      to: data.to,
      subject: data.subject,
      html: data.html
    });

  }
}