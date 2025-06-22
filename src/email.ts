import nodemailer from 'nodemailer';
import { ADMIN_EMAIL } from './constants';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendAdminEmail(subject: string, text: string, attachments?: any[]) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: ADMIN_EMAIL,
    subject,
    text,
    attachments,
  });
}

export async function sendClientEmail(to: string, subject: string, text: string, attachments?: any[]) {
  console.log(`[EMAIL] Попытка отправить письмо клиенту: to=${to}, subject=${subject}, attachments=${attachments?.length}`);
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments,
    });
    console.log(`[EMAIL] Письмо клиенту отправлено: to=${to}, messageId=${info.messageId}`);
  } catch (e) {
    console.error(`[EMAIL ERROR] Ошибка при отправке письма клиенту: to=${to}`, e);
    throw e;
  }
} 
