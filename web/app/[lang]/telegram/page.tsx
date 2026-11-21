import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TelegramPage } from "@/components/telegram-page";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/telegram">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["auth"]["telegramTitle"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TelegramPage lang={lang} searchParams={searchParams} />;
}
