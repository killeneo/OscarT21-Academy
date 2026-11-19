import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AudienceBar,
  Categories,
  CtaBand,
  Faq,
  Hero,
  Roles,
  SpecialistCatalog,
  Stats,
  ValueProp,
} from "@/components/home-sections";
import { CatalogView } from "@/components/catalog-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, hasLocale, type Locale } from "@/lib/i18n";

function Landing({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  return (
    <>
      <a className="skip-link" href="#main">
        {m.common.skipToContent}
      </a>
      <SiteHeader m={m.nav} brand={m.common.brand} lang={lang} />
      <main id="main">
        <Hero m={m.hero} lang={lang} />
        <AudienceBar m={m.audience} />
        <Categories m={m.categories} lang={lang} />
        <ValueProp m={m.value} />
        <SpecialistCatalog m={m.catalog} />
        <Stats m={m.stats} />
        <Faq m={m.faq} />
        <Roles m={m.roles} lang={lang} />
        <CtaBand m={m.cta} lang={lang} />
      </main>
      <SiteFooter m={m.footer} brand={m.common.brand} lang={lang} langLabel={m.nav.langLabel} />
    </>
  );
}

/**
 * Home page: signed-in users land on the specialist catalog, visitors (and signed-out users) see the landing.
 * The session is read per request, so this lives behind Suspense.
 */
async function Home({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return <Landing lang={lang} />;
  return <CatalogView lang={lang} user={user} query={await searchParams} base={`/${lang}`} />;
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={null}>
      <Home lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
