import { formatCop } from "@/lib/storefront/presentation";

export function Price({ value }: { value: number }) {
  return <span aria-label={`Precio ${formatCop(value)}`}>{formatCop(value)}</span>;
}
