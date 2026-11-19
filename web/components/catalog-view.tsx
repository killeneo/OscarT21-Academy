import { AppHeader } from "@/components/app-header";
import { SpecialistSearch } from "@/components/specialist-search";
import type { SessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { parseSearchParams, type SearchFilters } from "@/lib/search/params";
import { listCategories, searchSpecialists, type Category, type SearchResult } from "@/lib/search/specialists";
import styles from "@/components/search.module.css";

type Query = Record<string, string | string[] | undefined>;

/**
 * The signed-in home screen: header + specialist catalog. Used for `/[lang]` (the home page once signed in)
 * and for `/[lang]/specialists`. The caller has already verified the session.
 */
export async function CatalogView({ lang, user, query, base }: { lang: Locale; user: SessionUser; query: Query; base: string }) {
  const m = getMessages(lang);
  const filters = parseSearchParams(query);

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
      <a className="skip-link" href="#main">
        {m.common.skipToContent}
      </a>
      <AppHeader lang={lang} brand={m.common.brand} displayName={user.displayName} m={m} current="search" />
      <main id="main" className={styles.page}>
        <h1 className={styles.title}>{m.search.pageTitle}</h1>
        <p className={styles.subtitle}>{m.search.subtitle}</p>
        {data ? (
          <SpecialistSearch lang={lang} m={m.search} filters={data.filters} categories={data.categories} result={data.result} base={base} />
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
