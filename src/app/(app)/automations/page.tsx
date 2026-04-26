import { Workflow } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue, can } from "@/lib/tenant";
import { listWorkflows } from "@/server/automations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { WorkflowDialog } from "@/components/automations/workflow-dialog";
import { ExportButton } from "@/components/ui/export-button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  BOOKING_CREATED: "Prenotazione creata",
  BOOKING_COMPLETED: "Prenotazione completata",
  GUEST_BIRTHDAY: "Compleanno",
  GUEST_INACTIVE: "Ospite inattivo",
  COUPON_NOT_USED: "Coupon non usato",
  NPS_DETRACTOR: "NPS detrattore",
  WIFI_LEAD_CREATED: "Lead Wi-Fi",
  ORDER_COMPLETED: "Ordine completato",
  CUSTOM: "Custom",
};

const ACTION_LABEL: Record<string, string> = {
  SEND_EMAIL: "Email",
  SEND_SMS: "SMS",
  SEND_WHATSAPP: "WhatsApp",
  CREATE_COUPON: "Coupon",
  ADD_GUEST_TAG: "Tag",
  CREATE_STAFF_TASK: "Task staff",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  SUCCEEDED: "success",
  PARTIAL: "warning",
  FAILED: "danger",
  RUNNING: "neutral",
  QUEUED: "neutral",
};

export default async function AutomationsPage() {
  const ctx = await getActiveVenue();
  const canEdit = can(ctx.role, "edit_marketing");

  const [items, runs, runStats] = await Promise.all([
    listWorkflows(ctx.venueId),
    db.automationRun.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { workflow: { select: { name: true } } },
    }),
    db.automationRun.groupBy({
      by: ["status"],
      where: {
        venueId: ctx.venueId,
        createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
      _count: { _all: true },
    }),
  ]);

  const totals = runStats.reduce(
    (acc, r) => {
      acc.total += r._count._all;
      if (r.status === "SUCCEEDED") acc.ok += r._count._all;
      if (r.status === "FAILED") acc.failed += r._count._all;
      return acc;
    },
    { total: 0, ok: 0, failed: 0 },
  );
  const activeCount = items.filter((i) => i.active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketing</p>
          <h1 className="text-display text-3xl">Automazioni</h1>
          <p className="text-sm text-muted-foreground">
            Reagisci a eventi (prenotazioni, recensioni, lead Wi-Fi) con flussi automatici di
            messaggi, coupon e task.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <ExportButton kind="automations" label="Esecuzioni CSV" />}
          {canEdit && <WorkflowDialog />}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Flussi attivi" value={String(activeCount)} emphasize />
        <StatCard label="Esecuzioni 30gg" value={String(totals.total)} />
        <StatCard label="Riuscite" value={String(totals.ok)} />
        <StatCard label="Fallite" value={String(totals.failed)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>I tuoi flussi</CardTitle>
            <CardDescription>
              Disattiva un flusso per metterlo in pausa senza perderne la configurazione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
                Nessun flusso. Crea il primo per automatizzare follow-up e win-back.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {items.map((w) => {
                  const actions = (w.actions as unknown as { kind: string }[]) ?? [];
                  return (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-gilt/10 text-gilt-dark">
                          <Workflow className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {w.name}
                            {!w.active && (
                              <span className="ml-2 text-xs text-muted-foreground">(in pausa)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {TRIGGER_LABEL[w.trigger] ?? w.trigger}
                            {" · "}
                            {actions
                              .map((a) => ACTION_LABEL[a.kind] ?? a.kind)
                              .join(" → ")}
                            {w.delayMinutes ? ` · ritardo ${w.delayMinutes}m` : ""}
                          </p>
                          {w.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={w.active ? "success" : "neutral"}>
                          {w.active ? "Attivo" : "Pausa"}
                        </Badge>
                        {canEdit && (
                          <WorkflowDialog
                            initial={{
                              id: w.id,
                              name: w.name,
                              description: w.description,
                              trigger: w.trigger as never,
                              active: w.active,
                              delayMinutes: w.delayMinutes,
                              conditions: (w.conditions ?? null) as never,
                              actions: (w.actions ?? []) as never,
                            }}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Esecuzioni recenti</CardTitle>
            <CardDescription>Ultime 25 corse, dalla più recente.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
                Ancora nessuna esecuzione.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {runs.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-md border px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.workflow?.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {TRIGGER_LABEL[r.trigger] ?? r.trigger} · {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
