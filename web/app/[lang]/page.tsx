import { notFound } from "next/navigation";
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
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMessages, hasLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
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
