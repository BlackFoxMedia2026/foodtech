import { notFound } from "next/navigation";
import { getBookingByReference } from "@/server/booking-self-service";
import { BookingManageForm } from "@/components/booking/manage-form";

export const dynamic = "force-dynamic";

export default async function BookingManagePage({
  params,
}: {
  params: { ref: string };
}) {
  const booking = await getBookingByReference(params.ref);
  if (!booking) notFound();

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
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        Tavolo · gestisci la prenotazione
      </header>
      <BookingManageForm booking={plain} />
    </div>
  );
}
