import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Manrope } from "next/font/google";
import { A11yPanel } from "@/components/a11y-panel";
import { getMessages, hasLocale, localeNames, locales } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";
import "../globals.css";

// Manrope is a modern geometric sans with Cyrillic; latin-ext covers Uzbek Latin letters.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "cyrillic-ext", "latin", "latin-ext"],
  display: "swap",
});

// Only /ru, /uz, /en are generated; any other segment fails hasLocale() and returns 404.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return {
    metadataBase: new URL(siteUrl),
    title: m.meta.title,
    description: m.meta.description,
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [localeNames[l].html, `/${l}`])),
        "x-default": "/ru",
      },
    },
    openGraph: {
      title: m.meta.title,
      description: m.meta.description,
      url: `/${lang}`,
      locale: localeNames[lang].og,
      alternateLocale: locales.filter((l) => l !== lang).map((l) => localeNames[l].og),
      type: "website",
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={localeNames[lang].html} className={`${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the visitor's saved display settings before first paint (no flash). Reads only localStorage. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var s=JSON.parse(localStorage.getItem("a11y")||"{}"),d=document.documentElement;if(s.text==="large"||s.text==="xlarge")d.setAttribute("data-text",s.text);if(s.contrast==="high"||s.contrast==="dark")d.setAttribute("data-contrast",s.contrast);if(s.motion===true)d.setAttribute("data-motion","reduce");if(s.links===true)d.setAttribute("data-links","underline")}catch(e){}',
          }}
        />
      </head>
      <body>
        {children}
        <A11yPanel m={getMessages(lang).a11y} speechLang={localeNames[lang].html} />
      </body>
    </html>
  );
}
