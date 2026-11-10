import type { Messages } from "./ru";

// Uzbek (Latin script) UI strings. DRAFT: must be reviewed by a native speaker before launch.
// Brand name and sample cards are PLACEHOLDERS until real content is approved.
export const uz: Messages = {
  meta: {
    title: "Mozaika — tyutorlar va ijtimoiy xodimlarni o‘qitish, qidirish va sertifikatlash",
    description:
      "Inklyuziya bo‘yicha onlayn kurslar, tekshirilgan tyutorlar va ijtimoiy xodimlar katalogi hamda malakani tasdiqlovchi sertifikatlar.",
  },
  common: {
    brand: "Mozaika",
    skipToContent: "Asosiy mazmunga o‘tish",
  },
  nav: {
    label: "Asosiy navigatsiya",
    langLabel: "Tilni tanlash",
    about: "Platforma haqida",
    courses: "Kurslar",
    specialists: "Mutaxassislar",
    roles: "Kimlar uchun",
    login: "Kirish",
    signup: "Ro‘yxatdan o‘tish",
  },
  hero: {
    titleA: "O‘qitish va qidirish:",
    titleB: "tekshirilgan",
    titleC: "tyutorlar!",
    subtitle:
      "Inklyuziya bo‘yicha kurslar, malakasi tekshirilgan mutaxassislar katalogi va onlayn tasdiqlanadigan sertifikatlar. Ota-onalar, mutaxassislar va tashkilotlar uchun.",
    primary: "Mutaxassis topish",
    secondary: "Kurslarni ko‘rish",
    imageLabel: "Tasvir: mutaxassis mashg‘ulotda bolaga yordam bermoqda.",
    badges: {
      verify: { title: "Hujjatlar tekshiruvi", text: "moderator qo‘lda tekshiradi" },
      certs: { title: "Sertifikatlar", text: "QR-kod orqali tekshiriladi" },
      format: { title: "Onlayn va oflayn", text: "qulay formatni tanlang" },
    },
  },
  audience: {
    label: "Platforma kimlar uchun",
    items: [
      "Tyutorlar",
      "Ijtimoiy xodimlar",
      "Psixologlar",
      "Pedagoglar",
      "Nogiron bolalar yordamchilari",
      "Ota-onalar",
      "Maktab va markazlar",
      "NNT va jamg‘armalar",
    ],
  },
  categories: {
    kicker: "O‘qish",
    title: "Amaliyot uchun dasturlar",
    subtitle: "Seminar, trening va kurslar: inklyuziya asoslaridan ota-onalar bilan ishlashgacha.",
    items: [
      { title: "Inklyuziv ta’lim", text: "Asoslar, yondashuvlar va amaliyot" },
      { title: "Sensor integratsiya", text: "Sensor ehtiyojlarni tushunish" },
      { title: "Bolalarni kuzatib borish", text: "Tyutorlik ishi bosqichma-bosqich" },
      { title: "Ota-onalar bilan ishlash", text: "Muloqot, ishonch va soft skills" },
    ],
  },
  value: {
    kicker: "Sifat",
    title: "Ishonch tekshiruvdan boshlanadi",
    text: "O‘qish va mutaxassis qidirishni bitta tizimda birlashtiramiz: ota-onalar ishonch bilan tanlaydi, mutaxassislar malakasini tasdiqlaydi.",
    points: [
      "Moderator hujjat va sertifikatlarni tekshiradi",
      "Profilda «Tekshirilgan mutaxassis» belgisi",
      "Sifat reytingi va sharhlar",
      "Shahar, tajriba va ish formati bo‘yicha filtrlar",
      "Mutaxassisga tezkor so‘rovlar",
    ],
    cta: "Platforma haqida",
    imageLabel: "Tasvir: mutaxassis noutbukda kurs o‘qimoqda.",
    badgeA: "Tekshirilgan mutaxassis",
    badgeB: "O‘qish jarayoni",
  },
  catalog: {
    kicker: "Katalog",
    title: "Mutaxassis toping",
    subtitle: "Profil hujjatlar tekshirilgandan keyin e’lon qilinadi. Kerakli filtrlarni tanlang.",
    filtersLabel: "Katalog filtrlari",
    filters: ["Shahar", "Mutaxassislik", "Tajriba", "Reyting", "Sertifikatlar", "Onlayn / oflayn"],
    sampleNote: "Karta namunasi",
    verified: "Tekshirilgan mutaxassis",
    cta: "Katalogni ochish",
    items: [
      { role: "Tyutor", format: "Onlayn va oflayn", tags: ["Kuzatib borish", "Maktab"] },
      { role: "Ijtimoiy xodim", format: "Oflayn", tags: ["Oila", "Maslahatlar"] },
      { role: "Psixolog", format: "Onlayn", tags: ["Alohida ehtiyojli bolalar", "Ota-onalar"] },
    ],
  },
  courses: {
    kicker: "Kurslar",
    title: "O‘z sur’atingizda o‘qing",
    subtitle: "Video darslar, testlar va uy vazifalari. Kursdan so‘ng sertifikat beriladi.",
    badgeSoon: "Tez orada",
    cta: "Batafsil",
    items: [
      {
        type: "Kurs",
        title: "Inklyuziv ta’lim asoslari",
        text: "Inklyuziya nima va bolani kuzatib borishni qanday tashkil qilish kerak.",
        meta: "Video darslar · Test · Sertifikat",
      },
      {
        type: "Trening",
        title: "Sensor integratsiya amaliyoti",
        text: "Kuzatuv, mashqlar va mashg‘ulotlar uchun tavsiyalar.",
        meta: "Amaliyot · Uy vazifalari",
      },
      {
        type: "Vebinar",
        title: "Tyutorning soft skills ko‘nikmalari",
        text: "Ota-onalar va maktab jamoasi bilan nizosiz muloqot.",
        meta: "Vebinar · Yozuv · Test",
      },
    ],
  },
  stats: {
    kicker: "Platforma",
    title: "Ichkarida nimalar bor",
    items: [
      { value: "4", label: "turdagi akkaunt", text: "Mutaxassis, ota-ona, tashkilot va administrator" },
      { value: "7", label: "o‘quv yo‘nalishi", text: "Inklyuziyadan soft skills gacha" },
      { value: "6", label: "katalog filtri", text: "Shahar, tajriba, reyting, format va boshqalar" },
    ],
  },
  roles: {
    kicker: "Ro‘yxatdan o‘tish",
    title: "Rolingizni tanlang",
    subtitle: "Har bir rol uchun kabinetning faqat kerakli bo‘limlari ochiladi.",
    items: [
      { title: "Mutaxassis", text: "Profil, sertifikatlar, o‘qish va oilalardan so‘rovlar.", cta: "Men mutaxassisman" },
      { title: "Ota-ona", text: "Mutaxassis qidirish, sharhlar va tezkor so‘rovlar.", cta: "Men ota-onaman" },
      { title: "Tashkilot", text: "Maktab, markaz yoki NNT: vakansiyalar va jamoani o‘qitish.", cta: "Men tashkilotman" },
    ],
  },
  cta: {
    title: "Birgalikda boshlaymizmi?",
    subtitle: "Akkaunt yarating va nimadan boshlashni tanlang: kurs yoki mutaxassis qidirish.",
    button: "Akkaunt yaratish",
  },
  footer: {
    navLabel: "Pastki navigatsiya",
    about: "Tyutorlar va ijtimoiy xodimlarni o‘qitish, qidirish va sertifikatlash platformasi.",
    columns: {
      platform: {
        title: "Platforma",
        links: [
          { label: "Platforma haqida", href: "#about" },
          { label: "Kurslar", href: "#courses" },
          { label: "Mutaxassislar katalogi", href: "#specialists" },
        ],
      },
      help: {
        title: "Yordam",
        links: [
          { label: "Ro‘yxatdan o‘tish", href: "#roles" },
          { label: "Savol-javoblar", href: "#" },
          { label: "Aloqa", href: "#" },
        ],
      },
      legal: {
        title: "Hujjatlar",
        links: [
          { label: "Maxfiylik", href: "#" },
          { label: "Foydalanish shartlari", href: "#" },
          { label: "Qulaylik", href: "#" },
        ],
      },
    },
    rights: "Barcha huquqlar himoyalangan.",
  },
};
