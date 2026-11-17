import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { SpecialistSearch } from "@/components/specialist-search";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, hasLocale, type Locale } from "@/lib/i18n";
import { buildQuery, parseSearchParams, type SearchFilters } from "@/lib/search/params";
import { listCategories, searchSpecialists, type Category, type SearchResult } from "@/lib/search/specialists";
import styles from "@/components/search.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

/** Everything request-specific (session, query string, database) is behind Suspense. */
async function Body({ lang, searchParams }: { lang: Locale; searchParams: SearchParamsPromise }) {
  const m = getMessages(lang);
  const query = await searchParams;

  // Server-side gate: no catalog data is queried or rendered without a valid session.
  const user = await getSessionUser().catch(() => null);
  const filters = parseSearchParams(query);
  if (!user) {
    // Rebuilt from parsed filters, so only validated values travel through the login redirect.
    const here = `/${lang}/specialists${buildQuery(filters)}`;
    redirect(`/${lang}/login?next=${encodeURIComponent(here)}`);
  }

  let data: { categories: Category[]; result: SearchResult; filters: SearchFilters } | null = null;
  try {
    const [categories, first] = await Promise.all([listCategories(), searchSpecialists(filters)]);
    // A page beyond the last one falls back to the first page instead of an empty list.
    const result = first.page > first.pageCount ? await searchSpecialists({ ...filters, page: 1 }) : first;
    data = { categories, result, filters: { ...filters, page: result.page } };
  } catch (err) {
    console.error("specialist search failed:", err instanceof Error ? err.message : "unknown error");
  }

  return (
    <>
      <AppHeader lang={lang} brand={m.common.brand} displayName={user.displayName} m={m} current="search" />
      <main id="main" className={styles.page}>
        <h1 className={styles.title}>{m.search.pageTitle}</h1>
        <p className={styles.subtitle}>{m.search.subtitle}</p>
        {data ? (
          <SpecialistSearch lang={lang} m={m.search} filters={data.filters} categories={data.categories} result={data.result} />
        ) : (
          <div className={styles.error} role="alert">
            <h2>{m.search.errorTitle}</h2>
            <p>{m.search.errorText}</p>
          </div>
        )}
      </main>
    </>
  );
}

export default async function SpecialistsPage({ params, searchParams }: PageProps<"/[lang]/specialists">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <>
      <a className="skip-link" href="#main">
        {getMessages(lang).common.skipToContent}
      </a>
      <Suspense fallback={null}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
