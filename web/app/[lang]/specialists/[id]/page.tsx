import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecialistProfilePage } from "@/components/specialist-profile";
import { getMessages, hasLocale } from "@/lib/i18n";

// Profiles are for signed-in users only for now: no indexing, no names in the title before the session check.
export async function generateMetadata({ params }: PageProps<"/[lang]/specialists/[id]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["profile"]["title"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

/**
 * The id segment is runtime data and the locale layout reads the pathname on the client, so this route cannot have a
 * prerendered shell for every id: it is allowed to block. The session check and the lookup still run in the page's
 * Suspense part after the layout has started streaming, so a hidden or unknown profile gets Next.js' not-found page
 * (noindex) with status 200 in production (404 in `next dev`), identical for every hidden case.
 */
export const instant = false;

export default async function Page({ params, searchParams }: PageProps<"/[lang]/specialists/[id]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <SpecialistProfilePage lang={lang} id={params.then((p) => p.id)} searchParams={searchParams} />;
}
