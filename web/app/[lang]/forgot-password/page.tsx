import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForgotPasswordPage } from "@/components/recovery-pages";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/forgot-password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["recovery"]["forgotTitle"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <ForgotPasswordPage lang={lang} />;
}
