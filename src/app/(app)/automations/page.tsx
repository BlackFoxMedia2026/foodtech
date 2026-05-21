import {
  Activity,
  ArrowRight,
  Cake,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Coffee,
  Mail,
  MessageSquare,
  Pause,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
  UserMinus,
  Wifi,
  Workflow as WorkflowIcon,
  type LucideIcon,
  ClipboardList,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue, can } from "@/lib/tenant";
import { listWorkflows } from "@/server/automations";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkflowDialog } from "@/components/automations/workflow-dialog";
import { ExportButton } from "@/components/ui/export-button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TRIGGER: Record<
  string,
  { label: string; icon: LucideIcon }
> = {
  BOOKING_CREATED: { label: "Prenotazione creata", icon: Calendar },
  BOOKING_COMPLETED: { label: "Prenotazione completata", icon: CalendarCheck },
  GUEST_BIRTHDAY: { label: "Compleanno ospite", icon: Cake },
  GUEST_INACTIVE: { label: "Ospite inattivo", icon: UserMinus },
  COUPON_NOT_USED: { label: "Coupon non usato", icon: Ticket },
  NPS_DETRACTOR: { label: "NPS detrattore", icon: Star },
  WIFI_LEAD_CREATED: { label: "Lead Wi-Fi", icon: Wifi },
  ORDER_COMPLETED: { label: "Ordine completato", icon: ShoppingBag },
  CUSTOM: { label: "Custom", icon: Sparkles },
};

const ACTION: Record<string, { label: string; icon: LucideIcon }> = {
  SEND_EMAIL: { label: "Email", icon: Mail },
  SEND_SMS: { label: "SMS", icon: MessageSquare },
  SEND_WHATSAPP: { label: "WhatsApp", icon: MessageSquare },
  CREATE_COUPON: { label: "Coupon", icon: Ticket },
  ADD_GUEST_TAG: { label: "Tag", icon: Tag },
  CREATE_STAFF_TASK: { label: "Task staff", icon: ClipboardList },
};

const RUN_TONE: Record<string, string> = {
  SUCCEEDED: "text-status-confirmed bg-status-confirmed-soft",
  PARTIAL: "text-status-pending bg-status-pending-soft",
  FAILED: "text-status-no-show bg-status-no-show-soft",
  RUNNING: "text-foreground bg-secondary",
  QUEUED: "text-secondary bg-secondary",
};

const RUN_LABEL: Record<string, string> = {
  SUCCEEDED: "Riuscita",
  PARTIAL: "Parziale",
  FAILED: "Fallita",
  RUNNING: "In corso",
  QUEUED: "In coda",
};

export default async function AutomationsPage() {
  const ctx = await getActiveVenue();
  const canEdit = can(ctx.role, "edit_marketing");

  const [items, runs, runStats] = await Promise.all([
    listWorkflows(ctx.venueId),
    db.automationRun.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 15,
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
  const successRate = totals.total > 0 ? Math.round((totals.ok / totals.total) * 100) : 0;

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-tertiary">
            Growth
          </p>
          <h1 className="text-display mt-1 text-[32px] font-medium leading-tight tracking-tight">
            Automazioni
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Reagisci a eventi del locale con flussi di messaggi, coupon e task. Ogni flusso
            ha un trigger e una catena di azioni.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <ExportButton kind="automations" label="Esporta esecuzioni" />}
          {canEdit && <WorkflowDialog />}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Flussi attivi"
          value={activeCount}
          hint={`${items.length} configurati`}
          icon={WorkflowIcon}
          emphasized
        />
        <Stat
          label="Esecuzioni 30gg"
          value={totals.total}
          icon={Activity}
        />
        <Stat
          label="Tasso di successo"
          value={`${successRate}%`}
          delta={
            successRate >= 90
              ? { value: "ottimo", tone: "positive" }
              : successRate >= 70
                ? { value: "stabile", tone: "neutral" }
                : { value: "rivedi", tone: "negative" }
          }
        />
        <Stat
          label="Fallite 30gg"
          value={totals.failed}
          hint={totals.failed > 0 ? "controlla configurazione" : "tutto in regola"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Panel>
          <PanelHeader
            title="I tuoi flussi"
            description="Disattiva un flusso per metterlo in pausa senza perderne la configurazione."
          />
          <PanelBody className="pt-0">
            {items.length === 0 ? (
              <EmptyState
                icon={WorkflowIcon}
                title="Nessun flusso attivo"
                description="Crea il primo flusso per automatizzare follow-up, win-back e ringraziamenti."
                action={canEdit ? <WorkflowDialog /> : undefined}
              />
            ) : (
              <ul className="space-y-3">
                {items.map((w) => {
                  const actions = (w.actions as unknown as { kind: string }[]) ?? [];
                  const trigger = TRIGGER[w.trigger] ?? { label: w.trigger, icon: Sparkles };
                  const TriggerIcon = trigger.icon;
                  return (
                    <li
                      key={w.id}
                      className={cn(
                        "rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong",
                        !w.active && "opacity-70",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[15px] font-medium">{w.name}</p>
                            <ActiveBadge active={w.active} />
                          </div>
                          {w.description && (
                            <p className="mt-0.5 text-sm text-secondary">{w.description}</p>
                          )}
                        </div>
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

                      {/* Visual workflow chain: trigger -> action -> action */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ChainNode
                          icon={<TriggerIcon className="h-3.5 w-3.5" />}
                          label={trigger.label}
                          tone="trigger"
                        />
                        {w.delayMinutes ? (
                          <>
                            <ChainArrow />
                            <ChainNode
                              icon={<Coffee className="h-3.5 w-3.5" />}
                              label={`Attendi ${formatDelay(w.delayMinutes)}`}
                              tone="delay"
                            />
                          </>
                        ) : null}
                        {actions.length === 0 ? (
                          <span className="text-xs text-tertiary">Nessuna azione</span>
                        ) : (
                          actions.map((a, i) => {
                            const meta = ACTION[a.kind] ?? { label: a.kind, icon: Sparkles };
                            const Icon = meta.icon;
                            return (
                              <span key={i} className="flex items-center gap-2">
                                <ChainArrow />
                                <ChainNode
                                  icon={<Icon className="h-3.5 w-3.5" />}
                                  label={meta.label}
                                  tone="action"
                                />
                              </span>
                            );
                          })
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Esecuzioni recenti"
            description="Ultime 15 corse"
          />
          <PanelBody className="pt-0">
            {runs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Ancora nessuna esecuzione"
                description="Le corse appariranno qui appena un trigger viene attivato."
              />
            ) : (
              <ul className="divide-y divide-border">
                {runs.map((r) => {
                  const trigger = TRIGGER[r.trigger] ?? { label: r.trigger, icon: Sparkles };
                  const TriggerIcon = trigger.icon;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2.5 text-xs">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[hsl(var(--surface-sunken))] text-tertiary">
                        <TriggerIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {r.workflow?.name ?? "—"}
                        </p>
                        <p className="text-[11px] text-tertiary">
                          {trigger.label} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                          RUN_TONE[r.status] ?? "bg-secondary text-secondary",
                        )}
                      >
                        {RUN_LABEL[r.status] ?? r.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        active
          ? "bg-status-confirmed-soft text-status-confirmed"
          : "bg-secondary text-secondary",
      )}
    >
      {active ? (
        <>
          <CheckCircle2 className="h-3 w-3" /> Attivo
        </>
      ) : (
        <>
          <Pause className="h-3 w-3" /> In pausa
        </>
      )}
    </span>
  );
}

function ChainArrow() {
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-tertiary" />;
}

function ChainNode({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "trigger" | "delay" | "action";
}) {
  const toneClass =
    tone === "trigger"
      ? "border-gilt/30 bg-gilt/10 text-gilt-dark"
      : tone === "delay"
        ? "border-border bg-[hsl(var(--surface-sunken))] text-secondary"
        : "border-border bg-card text-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
        toneClass,
      )}
    >
      {icon} {label}
    </span>
  );
}

function formatDelay(min: number) {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} g`;
}
