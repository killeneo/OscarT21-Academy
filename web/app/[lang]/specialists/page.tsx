import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogView } from "@/components/catalog-view";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, hasLocale, type Locale } from "@/lib/i18n";
import { buildQuery, parseSearchParams } from "@/lib/search/params";

export async function generateMetadata({ params }: PageProps<"/[lang]/specialists">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["search"]["pageTitle"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

/** Everything request-specific (session, query string, database) is behind Suspense. */
async function Body({ lang, searchParams }: { lang: Locale; searchParams: SearchParamsPromise }) {
  const query = await searchParams;
  // Server-side gate: no catalog data is queried or rendered without a valid session.
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    // Rebuilt from parsed filters, so only validated values travel through the login redirect.
    const here = `/${lang}/specialists${buildQuery(parseSearchParams(query))}`;
    redirect(`/${lang}/login?next=${encodeURIComponent(here)}`);
  }
  return <CatalogView lang={lang} user={user} query={query} base={`/${lang}/specialists`} />;
}

export default async function SpecialistsPage({ params, searchParams }: PageProps<"/[lang]/specialists">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={null}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
