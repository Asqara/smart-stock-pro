import nodemailer from "nodemailer";

import { EmailDeliveryError } from "@/lib/errors";

type EmailRecipient = {
  email: string;
  name: string;
};

type LowStockEmailInput = {
  currentStock: number;
  minimumStock: number;
  productName: string;
  recipients: EmailRecipient[];
  unit: string;
  warehouseName: string;
};

type SystemErrorEmailInput = {
  message: string;
  module: string;
  recipients: EmailRecipient[];
  severity: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { from, host, pass, port, user };
}

/**
 * Email notification sender for optional SMTP configuration.
 */
export class EmailNotifications {
  /**
   * Send low-stock email to configured recipients.
   */
  static async sendLowStockEmail(input: LowStockEmailInput) {
    const config = getSmtpConfig();

    if (!config || input.recipients.length === 0) {
      return { skipped: true, sent: false };
    }

    try {
      const transporter = nodemailer.createTransport({
        auth: {
          pass: config.pass,
          user: config.user,
        },
        host: config.host,
        port: config.port,
        secure: config.port === 465,
      });
      await transporter.sendMail({
        from: config.from,
        subject: `Alert stok ${input.productName}`,
        text: `Stok ${input.productName} di ${input.warehouseName} tersisa ${input.currentStock} ${input.unit}. Batas minimum ${input.minimumStock} ${input.unit}.`,
        to: input.recipients.map((recipient) => recipient.email).join(","),
      });

      return { skipped: false, sent: true };
    } catch {
      throw new EmailDeliveryError();
    }
  }

  /**
   * Send system error email to configured recipients.
   */
  static async sendSystemErrorEmail(input: SystemErrorEmailInput) {
    const config = getSmtpConfig();

    if (!config || input.recipients.length === 0) {
      return { skipped: true, sent: false };
    }

    try {
      const transporter = nodemailer.createTransport({
        auth: {
          pass: config.pass,
          user: config.user,
        },
        host: config.host,
        port: config.port,
        secure: config.port === 465,
      });
      await transporter.sendMail({
        from: config.from,
        subject: `SmartStock Pro error ${input.severity}`,
        text: `Module: ${input.module}\nSeverity: ${input.severity}\nPesan: ${input.message}`,
        to: input.recipients.map((recipient) => recipient.email).join(","),
      });

      return { skipped: false, sent: true };
    } catch {
      throw new EmailDeliveryError();
    }
  }
}
