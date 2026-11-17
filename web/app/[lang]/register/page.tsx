import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { hasLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <AuthPage mode="register" lang={lang} searchParams={searchParams} />;
}
