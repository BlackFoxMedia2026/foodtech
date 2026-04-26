import { notFound } from "next/navigation";
import { ChefHat } from "lucide-react";
import { getBookingByReference } from "@/server/booking-self-service";
import { BookingManageForm } from "@/components/booking/manage-form";
import { LocaleSwitch } from "@/components/widget/locale-switch";
import { PreorderEditor } from "@/components/preorders/preorder-editor";
import {
  getPreorderForReference,
  venueMenuForPreorder,
} from "@/server/preorders";
import { pickLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function BookingManagePage({
  params,
  searchParams,
}: {
  params: { ref: string };
  searchParams: { lang?: string };
}) {
  const booking = await getBookingByReference(params.ref);
  if (!booking) notFound();
  const locale = pickLocale(searchParams.lang);
  const [preorder, menu] = await Promise.all([
    getPreorderForReference(params.ref),
    venueMenuForPreorder(booking.venue.id),
  ]);
  const closed =
    booking.status === "COMPLETED" ||
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW";
  const tooClose = booking.startsAt.getTime() - Date.now() < 2 * 60 * 60 * 1000;
  const preorderLocked = closed || tooClose;

  // Pass plain JSON to the client component (Date → ISO string)
  const plain = {
    reference: booking.reference,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    partySize: booking.partySize,
    notes: booking.notes,
    guest: booking.guest
      ? {
          firstName: booking.guest.firstName,
          lastName: booking.guest.lastName,
          email: booking.guest.email,
        }
      : null,
    venue: booking.venue,
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
            T
          </span>
          Tavolo
        </div>
        <LocaleSwitch locale={locale} />
      </header>
      <BookingManageForm booking={plain} locale={locale} />

      {menu.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-background p-5">
          <header className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-gilt-dark" />
            <h2 className="text-display text-xl">Pre-order menu</h2>
          </header>
          <p className="text-sm text-muted-foreground">
            Anticipa la tua scelta: la cucina si organizza meglio e tu inizi prima a goderti la
            serata. Modifiche possibili fino a 2 ore prima.
          </p>
          <PreorderEditor
            scope="guest"
            reference={params.ref}
            initial={
              preorder
                ? {
                    notes: preorder.notes,
                    items: preorder.items.map((i) => ({
                      menuItemId: i.menuItemId,
                      name: i.name,
                      priceCents: i.priceCents,
                      quantity: i.quantity,
                      notes: i.notes,
                    })),
                  }
                : null
            }
            menu={menu.map((c) => ({
              id: c.id,
              name: c.name,
              items: c.items.map((it) => ({
                id: it.id,
                name: it.name,
                description: it.description,
                priceCents: it.priceCents,
                currency: it.currency,
              })),
            }))}
            currency={booking.venue.currency ?? "EUR"}
            locked={preorderLocked}
          />
        </section>
      )}
    </div>
  );
}
