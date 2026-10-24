import { OrderTracking } from "@/components/tracking/order-tracking";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <><SiteHeader /><main className="shell py-12 sm:py-16" id="contenido"><div className="mx-auto max-w-3xl"><OrderTracking token={token} /></div></main></>;
}
