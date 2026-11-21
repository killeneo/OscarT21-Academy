import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignupCompletePage } from "@/components/signup-complete-page";
import { getMessages, hasLocale } from "@/lib/i18n";

// The sign-up token travels in the URL: keep it out of search engines and out of Referer headers.
export async function generateMetadata({ params }: PageProps<"/[lang]/register/complete">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["signup"]["title"]} — ${m.common.brand}`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/register/complete">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <SignupCompletePage lang={lang} searchParams={searchParams} />;
}
