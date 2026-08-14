import { notFound } from "next/navigation";
import { getSite } from "@/lib/site";

// Everything under /s/[slug] belongs to one title.
//
// This layout's job is narrow but load-bearing: confirm the slug names a real
// title and 404 if not, so no page underneath ever has to defend against a
// missing site. The pages themselves resolve their own context with
// getSiteContext(), because they need the decrypted credentials and a scoped
// db handle that a layout cannot pass to a server component beneath it.

export default async function SiteLayout({ children, params }) {
  const { slug } = await params;

  let site = null;
  try {
    site = await getSite(slug);
  } catch {
    // Database unreachable or not yet migrated. Fall through to notFound()
    // rather than surfacing a stack trace over a title that may well exist.
    site = null;
  }

  if (!site) notFound();

  return (
    <div
      className="site-scope"
      data-site={site.slug}
      // A title's own accent tints its pages without forking a stylesheet:
      // every component already reads --brand, so overriding it here is enough
      // to make Finance Weekly feel like Finance Weekly while every control,
      // panel and chart stays identical across the fleet.
      style={{ "--brand": site.accentHex, "--brand-2": site.accent2Hex || site.accentHex }}
    >
      {children}
    </div>
  );
}
