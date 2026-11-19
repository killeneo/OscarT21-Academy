import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding-page";
import { getMessages, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/onboarding">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["onboarding"]["stepLabel"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <OnboardingPage lang={lang} />;
}
