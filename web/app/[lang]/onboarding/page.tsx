import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding-page";
import { hasLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <OnboardingPage lang={lang} />;
}
