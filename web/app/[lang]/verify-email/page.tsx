import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokenPage } from "@/components/recovery-pages";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/verify-email">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["recovery"]["verifyTitle"]} — ${m.common.brand}`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/verify-email">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TokenPage lang={lang} searchParams={searchParams} kind="verify" />;
}
