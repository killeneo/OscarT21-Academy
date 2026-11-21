import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["auth"]["submitLogin"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <AuthPage mode="login" lang={lang} searchParams={searchParams} />;
}
