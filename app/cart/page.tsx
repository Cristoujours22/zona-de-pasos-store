import { CartPageContent } from "@/components/cart/cart-page";
import { SiteHeader } from "@/components/site-header";
import { loadPublicCatalog } from "@/lib/storefront/catalog";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const catalog = await loadPublicCatalog();
  return (
    <>
      <SiteHeader supportUrl={catalog.settings.supportUrl} />
      <CartPageContent />
    </>
  );
}
