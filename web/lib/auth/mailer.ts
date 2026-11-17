import { siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

/**
 * Mail transport. No external provider is wired in yet (needs an approved SMTP/API service):
 *  - development (or MAIL_TRANSPORT=console): the message is printed to the server console so links can be followed by hand;
 *  - production: nothing is sent and an error is logged until a provider is configured.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  // MAIL_TRANSPORT=console lets a production-mode build (next start) print mails too, for local checks.
  if (process.env.NODE_ENV !== "production" || process.env.MAIL_TRANSPORT === "console") {
    console.info(`[mail:dev] to=${to}\nsubject=${subject}\n${text}\n`);
    return true;
  }
  console.error("mail provider is not configured: e-mail was not sent");
  return false;
}

const TEXT = {
  ru: {
    verifySubject: "Подтвердите почту",
    verifyBody: (link: string) => `Чтобы подтвердить адрес почты, откройте ссылку (действует 24 часа):\n${link}\n\nЕсли вы не регистрировались, просто проигнорируйте письмо.`,
    resetSubject: "Сброс пароля",
    resetBody: (link: string) => `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${link}\n\nЕсли вы не запрашивали сброс, проигнорируйте письмо: пароль не изменится.`,
  },
  en: {
    verifySubject: "Confirm your email",
    verifyBody: (link: string) => `To confirm your email address, open this link (valid for 24 hours):\n${link}\n\nIf you did not sign up, just ignore this message.`,
    resetSubject: "Password reset",
    resetBody: (link: string) => `To set a new password, open this link (valid for 1 hour):\n${link}\n\nIf you did not request a reset, ignore this message: your password will not change.`,
  },
  uz: {
    verifySubject: "Pochtani tasdiqlang",
    verifyBody: (link: string) => `Pochta manzilini tasdiqlash uchun havolani oching (24 soat amal qiladi):\n${link}\n\nAgar ro‘yxatdan o‘tmagan bo‘lsangiz, xatni e’tiborsiz qoldiring.`,
    resetSubject: "Parolni tiklash",
    resetBody: (link: string) => `Yangi parol o‘rnatish uchun havolani oching (1 soat amal qiladi):\n${link}\n\nAgar tiklashni so‘ramagan bo‘lsangiz, xatni e’tiborsiz qoldiring: parol o‘zgarmaydi.`,
  },
} as const;

export function sendVerificationEmail(to: string, lang: Locale, token: string) {
  const t = TEXT[lang];
  return sendMail(to, t.verifySubject, t.verifyBody(`${siteUrl}/${lang}/verify-email?token=${encodeURIComponent(token)}`));
}

export function sendPasswordResetEmail(to: string, lang: Locale, token: string) {
  const t = TEXT[lang];
  return sendMail(to, t.resetSubject, t.resetBody(`${siteUrl}/${lang}/reset-password?token=${encodeURIComponent(token)}`));
}
