import { CheckoutPageContent } from "@/components/checkout/checkout-page";
import { SiteHeader } from "@/components/site-header";
import { loadPublicCatalog } from "@/lib/storefront/catalog";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const catalog = await loadPublicCatalog();
  return (
    <>
      <SiteHeader supportUrl={catalog.settings.supportUrl} />
      <CheckoutPageContent />
    </>
  );
}
