import { can, getActiveVenue } from "@/lib/tenant";
import { listAuditLogs } from "@/server/audit";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function jsonPreview(value: unknown) {
  if (value == null) return "—";
  try {
    const s = JSON.stringify(value);
    return s.length > 140 ? s.slice(0, 137) + "…" : s;
  } catch {
    return "[diff]";
  }
}

export default async function AuditPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) redirect("/settings");

  const logs = await listAuditLogs(ctx.orgId, { take: 100 });
  const since24h = logs.filter(
    (l) => l.createdAt.getTime() > Date.now() - 24 * 3600 * 1000,
  ).length;
  const gdprActions = logs.filter(
    (l) => l.action === "guest.anonymize" || l.action === "payment.refund",
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Sicurezza
        </p>
        <h1 className="text-display text-3xl">Audit log</h1>
        <p className="mt-1 text-sm text-secondary">
          Tracciamento append-only delle azioni sensibili (GDPR, accountability).
          Ultimi 100 eventi dell&apos;organizzazione.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Eventi (ultimi 100)" value={logs.length} />
        <Stat label="Ultime 24h" value={since24h} />
        <Stat
          label="Azioni GDPR-critical"
          value={gdprActions}
          hint="anonymize + refund"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Registro"
          description="Ordinato dal più recente. Diff troncato a 140 char."
        />
        <PanelBody className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-tertiary">
                <th className="py-2 pr-3 font-medium">Timestamp</th>
                <th className="py-2 pr-3 font-medium">Actor</th>
                <th className="py-2 pr-3 font-medium">Action</th>
                <th className="py-2 pr-3 font-medium">Entity</th>
                <th className="py-2 pr-3 font-medium">Entity ID</th>
                <th className="py-2 pr-3 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody className="text-numeric">
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-tertiary"
                  >
                    Nessun evento registrato.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/40 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-secondary">
                    {fmtDate(l.createdAt)}
                  </td>
                  <td className="py-2 pr-3 text-secondary">
                    {l.actorEmail ?? (l.actorId ? l.actorId : "system")}
                  </td>
                  <td className="py-2 pr-3 font-medium">{l.action}</td>
                  <td className="py-2 pr-3 text-tertiary">{l.entityType}</td>
                  <td className="py-2 pr-3 text-xs text-tertiary">
                    {l.entityId ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-tertiary">
                    <code className="break-all">{jsonPreview(l.diff)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelBody>
      </Panel>
    </div>
  );
}
