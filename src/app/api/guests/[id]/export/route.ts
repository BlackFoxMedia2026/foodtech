import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { logAudit } from "@/server/audit";
import {
  exportGuestData,
  exportRecordCounts,
} from "@/server/gdpr-export";

/**
 * POST /api/guests/[id]/export
 * GDPR Art. 20 — Right to data portability. Solo Manager (manage_venue).
 *
 * Body opzionale: { includePrivateNotes?: boolean } — solo Manager può
 * scegliere di includere le note interne, e l'opzione viene comunque
 * gating-ata dal check `manage_venue` di sopra. Risposta = JSON con
 * Content-Disposition attachment per trigger download lato client.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let includePrivateNotes = false;
  try {
    const body = (await req.json().catch(() => null)) as
      | { includePrivateNotes?: boolean }
      | null;
    if (body && typeof body.includePrivateNotes === "boolean") {
      includePrivateNotes = body.includePrivateNotes;
    }
  } catch {
    // body opzionale — ignora
  }

  try {
    const data = await exportGuestData(ctx.venueId, params.id, {
      includePrivateNotes,
    });

    const counts = exportRecordCounts(data);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `tavolo-guest-${params.id}-${dateStamp}.json`;

    // Audit log: nessun PII dumpato nel diff. Solo metadata.
    await logAudit({
      orgId: ctx.orgId,
      venueId: ctx.venueId,
      actorId: ctx.userId,
      actorEmail:
        (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
      action: "guest.export",
      entityType: "Guest",
      entityId: params.id,
      diff: {
        format: data.format,
        includePrivateNotes,
        recordCounts: counts,
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    const json = JSON.stringify(data, null, 2);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        // Custom headers per consentire al client di leggere i counts senza
        // riparsare il JSON intero (utile per feedback toast).
        "x-record-counts": JSON.stringify(counts),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    const status = msg === "not_found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
