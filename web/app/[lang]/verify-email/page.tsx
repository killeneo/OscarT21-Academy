import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokenPage } from "@/components/recovery-pages";
import { hasLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params, searchParams }: PageProps<"/[lang]/verify-email">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TokenPage lang={lang} searchParams={searchParams} kind="verify" />;
}
