import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForgotPasswordPage } from "@/components/recovery-pages";
import { hasLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <ForgotPasswordPage lang={lang} />;
}
