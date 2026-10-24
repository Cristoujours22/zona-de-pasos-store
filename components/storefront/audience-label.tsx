import { audienceLabel } from "@/lib/catalog/presentation";
import type { ProductAudience } from "@/types/catalog";

export function AudienceLabel({ audience }: { audience: ProductAudience }) {
  return <span>{audienceLabel(audience)}</span>;
}
