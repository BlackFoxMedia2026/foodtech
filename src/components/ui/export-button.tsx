import Link from "next/link";
import { Download } from "lucide-react";

export function ExportButton({
  kind,
  label,
}: {
  kind: "guests" | "bookings" | "payments";
  label?: string;
}) {
  return (
    <Link
      href={`/api/export/${kind}`}
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
      prefetch={false}
      download
    >
      <Download className="h-3.5 w-3.5" /> {label ?? "Esporta CSV"}
    </Link>
  );
}
