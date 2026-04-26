import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderGuestConfirmation, renderVenueNotification } from "@/emails/templates";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = stripe();
  if (!s) return NextResponse.json({ error: "stripe_disabled" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad_sig";
    return NextResponse.json({ error: "invalid_signature", message: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await onCheckoutFailed(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe:webhook] handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind;
  if (kind === "TICKET") {
    await onTicketPaid(session);
    return;
  }

  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  await db.payment.updateMany({
    where: { stripePaymentId: session.id },
    data: { status: "SUCCEEDED" },
  });

  const booking = await db.booking.update({
    where: { id: bookingId },
    data: { depositStatus: "HELD", status: "CONFIRMED" },
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      venue: { select: { name: true, email: true, city: true, address: true, phone: true } },
    },
  });

  if (booking.guest && booking.venue) {
    const tasks: Promise<unknown>[] = [];
    if (booking.guest.email) {
      const tpl = renderGuestConfirmation({
        guest: booking.guest,
        venue: booking.venue,
        booking: {
          reference: booking.reference,
          partySize: booking.partySize,
          startsAt: booking.startsAt,
          occasion: booking.occasion,
          notes: booking.notes,
        },
      });
      tasks.push(
        sendEmail({
          to: { email: booking.guest.email, name: booking.guest.firstName },
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          replyTo: booking.venue.email ?? undefined,
        }),
      );
    }
    if (booking.venue.email) {
      const tpl = renderVenueNotification({
        guest: booking.guest,
        venue: booking.venue,
        booking: {
          reference: booking.reference,
          partySize: booking.partySize,
          startsAt: booking.startsAt,
          occasion: booking.occasion,
          notes: booking.notes,
        },
      });
      tasks.push(
        sendEmail({
          to: { email: booking.venue.email, name: booking.venue.name },
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        }),
      );
    }
    await Promise.allSettled(tasks);
  }
}

async function onCheckoutFailed(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind === "TICKET") {
    await db.payment.updateMany({
      where: { stripePaymentId: session.id },
      data: { status: "FAILED" },
    });
    if (session.metadata?.ticketId) {
      await db.ticket.update({
        where: { id: session.metadata.ticketId },
        data: { status: "CANCELLED" },
      }).catch(() => undefined);
    }
    return;
  }
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;
  await db.payment.updateMany({
    where: { stripePaymentId: session.id },
    data: { status: "FAILED" },
  });
  await db.booking.update({
    where: { id: bookingId },
    data: { depositStatus: "FAILED" },
  });
}

async function onTicketPaid(session: Stripe.Checkout.Session) {
  const ticketId = session.metadata?.ticketId;
  if (!ticketId) return;

  await db.payment.updateMany({
    where: { stripePaymentId: session.id },
    data: { status: "SUCCEEDED" },
  });

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { status: "PAID" },
    include: {
      experience: {
        include: {
          venue: { select: { name: true, currency: true, slug: true, email: true } },
        },
      },
    },
  });

  const tpl = renderGuestConfirmation({
    guest: { firstName: ticket.buyerName.split(" ")[0] || ticket.buyerName, lastName: null },
    venue: {
      name: ticket.experience.venue.name,
      city: null,
      address: null,
      phone: null,
      email: ticket.experience.venue.email,
    },
    booking: {
      reference: ticket.id,
      partySize: ticket.quantity,
      startsAt: ticket.experience.startsAt,
      occasion: null,
      notes: `${ticket.experience.title}\n\nApri il ticket con QR: ${
        process.env.NEXTAUTH_URL ||
        `https://${process.env.VERCEL_URL || "localhost:3000"}`
      }/t/${ticket.id}`,
    },
  });

  await sendEmail({
    to: { email: ticket.buyerEmail, name: ticket.buyerName },
    subject: `🎟️ ${ticket.experience.title}`,
    html: tpl.html,
    text: tpl.text,
    replyTo: ticket.experience.venue.email ?? undefined,
  });
}
