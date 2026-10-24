import { OrdersAdmin } from "@/components/admin/orders/orders-admin";

export default function AdminOrdersPage() {
  return <main className="shell py-12 sm:py-16" id="contenido"><div className="mb-10"><p className="eyebrow">Operaciones</p><h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Pedidos y envíos</h1><p className="mt-5 max-w-2xl text-muted">Confirma disponibilidad y pagos de forma humana, registra envíos y conserva un historial auditado de cada cambio.</p></div><OrdersAdmin /></main>;
}
