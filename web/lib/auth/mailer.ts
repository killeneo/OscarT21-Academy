import { siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { consoleMailAllowed } from "./mail-policy";

/**
 * Mail transport. No external provider is wired in yet (needs an approved SMTP/API service):
 *  - development (or a local production check, see consoleMailAllowed): the message is printed to the console;
 *  - production: nothing is sent and an error is logged until a provider is configured.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (consoleMailAllowed()) {
    console.info(`[mail:dev] to=${to}\nsubject=${subject}\n${text}\n`);
    return true;
  }
  console.error(
    process.env.MAIL_TRANSPORT === "console"
      ? "MAIL_TRANSPORT=console is refused on a non-local production host: e-mail was not sent"
      : "mail provider is not configured: e-mail was not sent",
  );
  return false;
}

const TEXT = {
  ru: {
    existsSubject: "Попытка регистрации",
    existsBody: "Кто-то пытался зарегистрироваться с этим адресом, но аккаунт уже существует. Если это были вы, просто войдите или восстановите пароль. Если нет, ничего делать не нужно.",
    verifySubject: "Подтвердите почту",
    verifyBody: (link: string) => `Чтобы подтвердить адрес почты, откройте ссылку (действует 24 часа):\n${link}\n\nЕсли вы не регистрировались, просто проигнорируйте письмо.`,
    resetSubject: "Сброс пароля",
    resetBody: (link: string) => `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${link}\n\nЕсли вы не запрашивали сброс, проигнорируйте письмо: пароль не изменится.`,
    signupSubject: "Завершите регистрацию",
    signupBody: (link: string) => `Чтобы завершить регистрацию, откройте ссылку и задайте пароль (действует 24 часа):\n${link}\n\nЕсли вы не регистрировались, просто проигнорируйте письмо: аккаунт не будет создан.`,
    linkedSubject: "К аккаунту добавлен вход через Google",
    linkedBody: (link: string) => `К вашему аккаунту добавлен вход через Google, а все устройства, где вы входили, отключены. Если это были не вы, сразу смените пароль:\n${link}`,
  },
  en: {
    existsSubject: "Sign-up attempt",
    existsBody: "Someone tried to sign up with this address, but an account already exists. If it was you, log in or reset your password. If not, no action is needed.",
    verifySubject: "Confirm your email",
    verifyBody: (link: string) => `To confirm your email address, open this link (valid for 24 hours):\n${link}\n\nIf you did not sign up, just ignore this message.`,
    resetSubject: "Password reset",
    resetBody: (link: string) => `To set a new password, open this link (valid for 1 hour):\n${link}\n\nIf you did not request a reset, ignore this message: your password will not change.`,
    signupSubject: "Finish signing up",
    signupBody: (link: string) => `To finish signing up, open this link and set a password (valid for 24 hours):\n${link}\n\nIf you did not sign up, just ignore this message: no account will be created.`,
    linkedSubject: "Google sign-in added to your account",
    linkedBody: (link: string) => `Google sign-in was added to your account, and every device where you were signed in has been signed out. If this was not you, change your password now:\n${link}`,
  },
  uz: {
    existsSubject: "Róyxatdan ótiş urinişi",
    existsBody: "Kimdir bu manzil bilan róyxatdan ótmoqchi bo‘ldi, lekin akkaunt allaqaçon mavjud. Agar bu siz bo‘lsangiz, kiriń yoki parolni tiklań. Aks holda hech narsa qilmaslik kifoya.",
    verifySubject: "Poçtani tasdiqlań",
    verifyBody: (link: string) => `Pochta manzilini tasdiqlash uchun havolani oching (24 soat amal qiladi):\n${link}\n\nAgar ro‘yxatdan o‘tmagan bo‘lsangiz, xatni e’tiborsiz qoldiring.`,
    resetSubject: "Parolni tiklaş",
    resetBody: (link: string) => `Yangi parol o‘rnatish uchun havolani oching (1 soat amal qiladi):\n${link}\n\nAgar tiklashni so‘ramagan bo‘lsangiz, xatni e’tiborsiz qoldiring: parol o‘zgarmaydi.`,
    signupSubject: "Róyxatdan ótişni yakunlań",
    signupBody: (link: string) => `Róyxatdan ótişni yakunlaş uçun havolani oçiń va parol óylab topiń (24 soat amal qiladi):\n${link}\n\nAgar róyxatdan ótmagan bólsańiz, xatni e’tiborsiz qoldiriń: akkaunt yaratilmaydi.`,
    linkedSubject: "Akkauntińizga Google orqali kiriş qóşildi",
    linkedBody: (link: string) => `Akkauntińizga Google orqali kiriş qóşildi va siz kirgan barça qurilmalardan çiqarildińiz. Agar bu siz bólmasańiz, darhol parolni ózgartiriń:\n${link}`,
  },
  "uz-cyrl": {
    existsSubject: "Рўйхатдан ўтиш уриниши",
    existsBody: "Кимдир бу манзил билан рўйхатдан ўтмоқчи бўлди, лекин аккаунт аллақачон мавжуд. Агар бу сиз бўлсангиз, киринг ёки паролни тикланг. Акс ҳолда ҳеч нарса қилмаслик кифоя.",
    verifySubject: "Почтани тасдиқланг",
    verifyBody: (link: string) => `Почта манзилини тасдиқлаш учун ҳаволани очинг (24 соат амал қилади):\n${link}\n\nАгар рўйхатдан ўтмаган бўлсангиз, хатни эътиборсиз қолдиринг.`,
    resetSubject: "Паролни тиклаш",
    resetBody: (link: string) => `Янги парол ўрнатиш учун ҳаволани очинг (1 соат амал қилади):\n${link}\n\nАгар тиклашни сўрамаган бўлсангиз, хатни эътиборсиз қолдиринг: парол ўзгармайди.`,
    signupSubject: "Рўйхатдан ўтишни якунланг",
    signupBody: (link: string) => `Рўйхатдан ўтишни якунлаш учун ҳаволани очинг ва парол ўйлаб топинг (24 соат амал қилади):\n${link}\n\nАгар рўйхатдан ўтмаган бўлсангиз, хатни эътиборсиз қолдиринг: аккаунт яратилмайди.`,
    linkedSubject: "Аккаунтингизга Google орқали кириш қўшилди",
    linkedBody: (link: string) => `Аккаунтингизга Google орқали кириш қўшилди ва сиз кирган барча қурилмалардан чиқарилдингиз. Агар бу сиз бўлмасангиз, дарҳол паролни ўзгартиринг:\n${link}`,
  },
  kaa: {
    existsSubject: "Dizimnen ótiw urınısı",
    existsBody: "Kimdur usı mánzil menen dizimnen ótpekshi boldı, biraq akkaunt aldın bar. Eger bul siz bolsańız, kiriń yamasa paroldı tiklań. Bolmasa hesh nárse islew shárt emes.",
    verifySubject: "Pochtanı tastıyıqlań",
    verifyBody: (link: string) => `Pochta mánzilin tastıyıqlaw ushın siltewdi ashıń (24 saat isleydi):\n${link}\n\nEger dizimnen ótpegen bolsańız, xattı itibarsız qaldırıń.`,
    resetSubject: "Paroldı tiklew",
    resetBody: (link: string) => `Jańa parol ornatıw ushın siltewdi ashıń (1 saat isleydi):\n${link}\n\nEger tiklewdi sorımaǵan bolsańız, xattı itibarsız qaldırıń: parol ózgermeydi.`,
    signupSubject: "Dizimnen ótiwdi juwmaqlań",
    signupBody: (link: string) => `Dizimnen ótiwdi juwmaqlaw ushın siltewdi ashıń hám parol oylap tabıń (24 saat isleydi):\n${link}\n\nEger dizimnen ótpegen bolsańız, xattı itibarsız qaldırıń: akkaunt jaratılmaydı.`,
    linkedSubject: "Akkauntıńızǵa Google arqalı kiriw qosıldı",
    linkedBody: (link: string) => `Akkauntıńızǵa Google arqalı kiriw qosıldı hám siz kirgen barlıq qurılmalardan shıǵarıldıńız. Eger bul siz bolmasańız, dárhal paroldı ózgertiń:\n${link}`,
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

/** Step 1 of sign-up: the link to set a password. The account is created only when the link is used. */
export function sendSignupEmail(to: string, lang: Locale, token: string, role: string) {
  const t = TEXT[lang];
  const query = new URLSearchParams({ token, role }).toString();
  return sendMail(to, t.signupSubject, t.signupBody(`${siteUrl}/${lang}/register/complete?${query}`));
}

/** Google sign-in was just attached to an account that has a password. */
export function sendGoogleLinkedEmail(to: string, lang: Locale) {
  const t = TEXT[lang];
  return sendMail(to, t.linkedSubject, t.linkedBody(`${siteUrl}/${lang}/forgot-password`));
}

/** Sent instead of a sign-up link when someone signs up with an address that already has an account. */
export function sendAccountExistsEmail(to: string, lang: Locale) {
  const t = TEXT[lang];
  return sendMail(to, t.existsSubject, `${t.existsBody}\n\n${siteUrl}/${lang}/login`);
}
