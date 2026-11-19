import { localeNames, locales, type Locale, type Messages } from "@/lib/i18n";
import { buildQuery, SORTS, type SearchFilters } from "@/lib/search/params";
import type { Category, SearchResult, SpecialistCard } from "@/lib/search/specialists";
import { AvatarFace, ShieldIcon } from "./icons";
import { ResponsiveDetails } from "./responsive-details";
import styles from "./search.module.css";

type M = Messages["search"];
type Props = { lang: Locale; m: M; filters: SearchFilters; categories: Category[]; result: SearchResult; base?: string };

const NUMBER_LOCALE: Record<Locale, string> = Object.fromEntries(locales.map((l) => [l, localeNames[l].numbers])) as Record<Locale, string>;
const TONES = ["gold", "teal", "emerald", "sand"] as const;

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

function catName(name: Record<string, string>, lang: Locale) {
  return name[lang] ?? name.ru ?? "";
}

function priceText(c: SpecialistCard, m: M, lang: Locale) {
  const nf = new Intl.NumberFormat(NUMBER_LOCALE[lang], { maximumFractionDigits: 0 });
  const from = nf.format(c.priceFrom);
  const text =
    c.priceTo > c.priceFrom
      ? fill(m.priceRange, { from, to: nf.format(c.priceTo) })
      : fill(m.priceFromOnly, { from });
  return `${text} ${m.currency}`;
}

function Card({ c, m, lang, back }: { c: SpecialistCard; m: M; lang: Locale; back: string }) {
  const tone = TONES[c.displayName.length % TONES.length];
  const href = `/${lang}/specialists/${c.id}?${new URLSearchParams({ back })}`;
  return (
    <li className={styles.card}>
      <div className={styles.cardTop}>
        <AvatarFace tone={tone} className={styles.avatar} />
        <div>
          {/* The name is the card's one link; CSS stretches its hit area over the whole card. */}
          <h3 className={styles.name}>
            <a href={href} className={styles.cardLink}>
              {c.displayName}
            </a>
          </h3>
          <p className={styles.cat}>{catName(c.categoryName, lang)}</p>
        </div>
      </div>

      <p className={c.verified ? styles.badgeOk : styles.badgeWait}>
        {c.verified ? <ShieldIcon /> : null}
        {c.verified ? m.verified : m.notVerified}
      </p>

      {c.headline ? <p className={styles.headline}>{c.headline}</p> : null}

      <ul className={styles.chips}>
        <li>{m.cities[c.city as keyof typeof m.cities] ?? c.city}</li>
        {c.formats.map((f) => (
          <li key={f}>{m.formats[f as keyof typeof m.formats] ?? f}</li>
        ))}
      </ul>

      <p className={styles.meta}>
        {fill(m.experience, { n: c.experienceYears })} · {fill(m.children, { from: c.ageMin, to: c.ageMax })}
      </p>

      <div className={styles.cardBottom}>
        <p className={styles.price}>{priceText(c, m, lang)}</p>
        <p className={styles.rating}>
          {c.reviewsCount > 0 ? (
            <>
              <span aria-hidden="true">★</span>
              <span className="sr-only">{m.rating}: </span>
              {c.ratingAvg.toLocaleString(NUMBER_LOCALE[lang], { minimumFractionDigits: 1 })}
              <span className={styles.reviews}> · {fill(m.reviews, { n: c.reviewsCount })}</span>
            </>
          ) : (
            <span className={styles.reviews}>{m.noReviews}</span>
          )}
        </p>
      </div>
      {c.isDemo ? <p className={styles.demo}>{m.demo}</p> : null}
    </li>
  );
}

export function SpecialistSearch({ lang, m, filters, categories, result, base: basePath }: Props) {
  const base = basePath ?? `/${lang}/specialists`;
  const href = (o: Partial<SearchFilters>) => `${base}${buildQuery(filters, { page: 1, ...o })}`;
  const pageHref = (page: number) => `${base}${buildQuery(filters, { page })}`;

  return (
    <form method="get" action={base} className={styles.layout}>
      <div className={styles.searchRow} role="search">
        <label htmlFor="q" className="sr-only">
          {m.searchLabel}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder={m.searchPlaceholder}
          maxLength={80}
          className={styles.searchInput}
          autoComplete="off"
        />
        <button type="submit" className={styles.searchBtn}>
          {m.searchButton}
        </button>
      </div>

      <nav aria-label={m.categoriesLabel} className={styles.catRow}>
        <a href={href({ category: null })} aria-current={filters.category === null ? "true" : undefined}>
          {m.allCategories}
        </a>
        {categories.map((c) => (
          <a key={c.slug} href={href({ category: c.slug })} aria-current={filters.category === c.slug ? "true" : undefined}>
            {catName(c.name, lang)}
          </a>
        ))}
      </nav>

      <ResponsiveDetails summary={m.filtersToggle} className={styles.filters} summaryClassName={styles.filtersSummary}>
        <div className={styles.filtersBody}>
          <h2 className={styles.filtersTitle}>{m.filtersTitle}</h2>
          {/* Carried through so applying filters keeps the current sort. */}
          <input type="hidden" name="sort" value={filters.sort} />

          <div className={styles.field}>
            <label htmlFor="category">{m.category}</label>
            <select id="category" name="category" defaultValue={filters.category ?? ""} className={styles.control}>
              <option value="">{m.allCategories}</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {catName(c.name, lang)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="age">{m.age}</label>
            <input
              id="age"
              name="age"
              type="number"
              inputMode="numeric"
              min={0}
              max={18}
              defaultValue={filters.age ?? ""}
              className={styles.control}
              aria-describedby="age-hint"
            />
            <p id="age-hint" className={styles.hint}>
              {m.ageHint}
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="city">{m.city}</label>
            <select id="city" name="city" defaultValue={filters.city ?? ""} className={styles.control}>
              <option value="">{m.allCities}</option>
              {Object.entries(m.cities).map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="format">{m.format}</label>
            <select id="format" name="format" defaultValue={filters.format ?? ""} className={styles.control}>
              <option value="">{m.anyFormat}</option>
              <option value="online">{m.formats.online}</option>
              <option value="offline">{m.formats.offline}</option>
            </select>
          </div>

          <fieldset className={styles.field}>
            <legend>{m.price}</legend>
            <div className={styles.pair}>
              <label className="sr-only" htmlFor="priceMin">
                {m.priceFrom}
              </label>
              <input
                id="priceMin"
                name="priceMin"
                type="number"
                inputMode="numeric"
                min={0}
                step={10000}
                placeholder={m.priceFrom}
                defaultValue={filters.priceMin ?? ""}
                className={styles.control}
              />
              <label className="sr-only" htmlFor="priceMax">
                {m.priceTo}
              </label>
              <input
                id="priceMax"
                name="priceMax"
                type="number"
                inputMode="numeric"
                min={0}
                step={10000}
                placeholder={m.priceTo}
                defaultValue={filters.priceMax ?? ""}
                className={styles.control}
              />
            </div>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="rating">{m.rating}</label>
            <select id="rating" name="rating" defaultValue={filters.minRating === null ? "" : String(filters.minRating)} className={styles.control}>
              <option value="">{m.anyRating}</option>
              <option value="3">{m.rating3}</option>
              <option value="4">{m.rating4}</option>
              <option value="4.5">{m.rating45}</option>
            </select>
          </div>

          <div className={styles.check}>
            <input type="hidden" name="verified" value="0" />
            <input id="verified" type="checkbox" name="verified" value="1" defaultChecked={filters.verifiedOnly} />
            <label htmlFor="verified">{m.verifiedOnly}</label>
          </div>

          <div className={styles.filterActions}>
            <button type="submit" className={styles.apply}>
              {m.apply}
            </button>
            <a href={base} className={styles.reset}>
              {m.reset}
            </a>
          </div>
        </div>
      </ResponsiveDetails>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultsHead}>
          <h2 id="results-title" className={styles.found} aria-live="polite">
            {fill(m.found, { n: result.total })}
          </h2>
          <nav aria-label={m.sortNav} className={styles.sorts}>
            <span>{m.sortLabel}:</span>
            {SORTS.map((s) => (
              <a key={s} href={href({ sort: s })} aria-current={filters.sort === s ? "true" : undefined}>
                {m.sorts[s]}
              </a>
            ))}
          </nav>
        </div>

        {result.items.length === 0 ? (
          <div className={styles.empty}>
            <h3>{m.emptyTitle}</h3>
            <p>{m.emptyText}</p>
            <a href={base} className={styles.reset}>
              {m.reset}
            </a>
          </div>
        ) : (
          <ul className={styles.grid}>
            {result.items.map((c) => (
              <Card key={c.id} c={c} m={m} lang={lang} back={pageHref(result.page)} />
            ))}
          </ul>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label={m.pagination} className={styles.pager}>
            {result.page > 1 ? <a href={pageHref(result.page - 1)}>{m.prev}</a> : <span aria-hidden="true" />}
            <span>{fill(m.pageOf, { page: result.page, total: result.pageCount })}</span>
            {result.page < result.pageCount ? <a href={pageHref(result.page + 1)}>{m.next}</a> : <span aria-hidden="true" />}
          </nav>
        ) : null}
      </section>
    </form>
  );
}
