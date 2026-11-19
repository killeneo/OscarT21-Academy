import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/settings-page";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/settings">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["settings"]["title"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/settings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <SettingsPage lang={lang} />;
}
