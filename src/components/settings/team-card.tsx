"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initials } from "@/lib/utils";

type Role = "MANAGER" | "RECEPTION" | "WAITER" | "MARKETING" | "READ_ONLY";

const LABEL: Record<Role, string> = {
  MANAGER: "Manager",
  RECEPTION: "Reception",
  WAITER: "Cameriere",
  MARKETING: "Marketing",
  READ_ONLY: "Sola lettura",
};

const HINT: Record<Role, string> = {
  MANAGER: "Pieno accesso, vede note riservate, gestisce pagamenti, team",
  RECEPTION: "Gestisce prenotazioni e ospiti",
  WAITER: "Operatore di sala",
  MARKETING: "Campagne, segmenti, ricavi",
  READ_ONLY: "Sola visualizzazione",
};

type Member = {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string };
};

export function TeamCard({
  initial,
  selfUserId,
  canEdit,
}: {
  initial: Member[];
  selfUserId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState<Member[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function changeRole(id: string, role: Role) {
    setBusy(id);
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(null);
    if (res.ok) {
      setList((l) => l.map((m) => (m.id === id ? { ...m, role } : m)));
      startTransition(() => router.refresh());
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error === "cant_edit_self" ? "Non puoi modificare il tuo ruolo." : "Operazione non riuscita.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Rimuovere il membro dal locale?")) return;
    setBusy(id);
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setList((l) => l.filter((m) => m.id !== id));
      startTransition(() => router.refresh());
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error === "cant_remove_self" ? "Non puoi rimuovere te stesso." : "Operazione non riuscita.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Team & permessi</CardTitle>
            <CardDescription>
              Ruoli per il locale corrente. Solo il Manager può modificarli.
            </CardDescription>
          </div>
          {canEdit && <AddDialog onCreated={(m) => setList((l) => [...l, m])} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.map((m) => {
          const me = m.userId === selfUserId;
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials(m.user.name ?? m.user.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {m.user.name ?? m.user.email}
                    {me && <Badge tone="gold" className="ml-2">tu</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !me ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as Role)}
                    disabled={busy === m.id}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    title={HINT[m.role]}
                  >
                    {(Object.keys(LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone="neutral" title={HINT[m.role]}>{LABEL[m.role]}</Badge>
                )}
                {canEdit && !me && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === m.id}
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AddDialog({ onCreated }: { onCreated: (m: Member) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="subtle" size="sm">
          <UserPlus className="h-4 w-4" /> Aggiungi membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi membro</DialogTitle>
          <DialogDescription>
            Se l&apos;email esiste già, il ruolo viene aggiunto al locale corrente. Altrimenti
            l&apos;utente viene creato con la password iniziale.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            const body = {
              email: String(fd.get("email") ?? "").trim(),
              name: String(fd.get("name") ?? "").trim() || null,
              role: fd.get("role") as Role,
              initialPassword: String(fd.get("initialPassword") ?? "") || undefined,
            };
            const res = await fetch("/api/team", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            setBusy(false);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              setError(
                j?.error === "already_member"
                  ? "Questo utente è già membro del locale."
                  : "Salvataggio non riuscito.",
              );
              return;
            }
            const m = await res.json();
            onCreated({
              id: m.id,
              userId: m.userId,
              role: m.role,
              user: { name: m.user?.name ?? null, email: m.user?.email ?? body.email },
            });
            setOpen(false);
            router.refresh();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-email">Email</Label>
              <Input id="t-email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Nome (opzionale)</Label>
              <Input id="t-name" name="name" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-role">Ruolo</Label>
              <select
                id="t-role"
                name="role"
                defaultValue="RECEPTION"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-pwd">Password iniziale (se nuovo)</Label>
              <Input id="t-pwd" name="initialPassword" type="password" minLength={8} placeholder="≥ 8 caratteri" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              <Plus className="h-4 w-4" /> {busy ? "Aggiunta…" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
