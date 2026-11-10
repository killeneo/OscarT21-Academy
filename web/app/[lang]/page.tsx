import { notFound } from "next/navigation";
import {
  AudienceBar,
  Categories,
  Courses,
  CtaBand,
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
        <Hero m={m.hero} />
        <AudienceBar m={m.audience} />
        <Categories m={m.categories} />
        <ValueProp m={m.value} />
        <SpecialistCatalog m={m.catalog} />
        <Courses m={m.courses} />
        <Stats m={m.stats} />
        <Roles m={m.roles} />
        <CtaBand m={m.cta} />
      </main>
      <SiteFooter m={m.footer} brand={m.common.brand} lang={lang} langLabel={m.nav.langLabel} />
    </>
  );
}
