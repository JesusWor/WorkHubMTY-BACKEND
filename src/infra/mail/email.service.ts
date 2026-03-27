import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { SendEmailDTO } from "./email.types";

export class EmailService {

  private static transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    auth: {
      user: env.mail.user,
      pass: env.mail.pass
    }
  });

  static async sendEmail(data: SendEmailDTO) {

    await this.transporter.sendMail({
      from: `"WorkHub" <${env.mail.user}>`,
      to: data.to,
      subject: data.subject,
      html: data.html
    });

  }
}