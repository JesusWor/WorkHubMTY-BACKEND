export const smtpConfig = {
    smtp_host: process.env.SMTP_HOST || "",
    smtp_port: Number(process.env.SMTP_PORT || 587),
    smtp_user: process.env.SMTP_USER || "",
    smtp_pass: process.env.SMTP_PASS || ""
}