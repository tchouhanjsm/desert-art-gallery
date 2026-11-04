import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontInformationPage, storefrontInformationPages } from "@/lib/storefront-information";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(storefrontInformationPages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getStorefrontInformationPage(slug);

  if (!page) {
    return {
      title: "ページが見つかりません",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: page.title,
    description: page.intro,
    robots: { index: false, follow: true },
  };
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getStorefrontInformationPage(slug);
  if (!page) notFound();

  return (
    <section className="page-shell" aria-labelledby="information-page-title">
      <header className="page-heading">
        <div className="section-kicker">ご利用案内</div>
        <h1 id="information-page-title">{page.title}</h1>
        <p>{page.intro}</p>
      </header>
      <div className="info-copy">
        {page.draftNotice && <p className="info-draft-notice" role="note">{page.draftNotice}</p>}
        {page.body.map((paragraph, index) => (
          <p key={index} className="info-copy-paragraph">{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
