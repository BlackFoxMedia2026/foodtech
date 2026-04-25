import { z } from "zod";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { renderGuestConfirmation } from "@/emails/templates";

export const TicketInput = z.object({
  buyerName: z.string().min(2).max(80),
  buyerEmail: z.string().email(),
  quantity: z.coerce.number().int().min(1).max(20),
});

export async function getPublishedExperience(venueSlug: string, experienceSlug: string) {
  const venue = await db.venue.findFirst({
    where: { slug: venueSlug, active: true },
    select: { id: true, name: true, slug: true, city: true, address: true, phone: true, email: true, currency: true },
  });
  if (!venue) return null;
  const experience = await db.experience.findFirst({
    where: { venueId: venue.id, slug: experienceSlug, published: true },
  });
  if (!experience) return null;
  const sold = await db.ticket.aggregate({
    where: { experienceId: experience.id, status: "PAID" },
    _sum: { quantity: true },
  });
  return { venue, experience, soldQuantity: sold._sum.quantity ?? 0 };
}

export async function createTicket(opts: {
  venueSlug: string;
  experienceSlug: string;
  payload: unknown;
}) {
  const data = TicketInput.parse(opts.payload);
  const ctx = await getPublishedExperience(opts.venueSlug, opts.experienceSlug);
  if (!ctx) throw new Error("not_found");
  const { venue, experience, soldQuantity } = ctx;
  if (new Date(experience.endsAt) < new Date()) throw new Error("event_past");
  if (soldQuantity + data.quantity > experience.capacity) throw new Error("sold_out");

  const totalCents = experience.priceCents * data.quantity;

  const ticket = await db.ticket.create({
    data: {
      experienceId: experience.id,
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      quantity: data.quantity,
      totalCents,
      status: experience.priceCents === 0 ? "PAID" : "PAID",
    },
  });

  if (experience.priceCents === 0) {
    void notifyTicketBuyer({
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      experienceTitle: experience.title,
      startsAt: experience.startsAt,
      quantity: data.quantity,
      totalCents,
      venueName: venue.name,
      venueEmail: venue.email,
    });
    return { ticketId: ticket.id, checkoutUrl: null as string | null, free: true };
  }

  const s = stripe();
  if (!s) {
    return { ticketId: ticket.id, checkoutUrl: null as string | null, free: false };
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;

  try {
    const session = await s.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: data.buyerEmail,
      line_items: [
        {
          quantity: data.quantity,
          price_data: {
            currency: venue.currency.toLowerCase(),
            unit_amount: experience.priceCents,
            product_data: {
              name: `${experience.title} · ${venue.name}`,
              description: experience.description ?? undefined,
            },
          },
        },
      ],
      metadata: {
        ticketId: ticket.id,
        experienceId: experience.id,
        venueId: venue.id,
        kind: "TICKET",
      },
      success_url: `${baseUrl}/e/${venue.slug}/${experience.slug}/done?t=${ticket.id}`,
      cancel_url: `${baseUrl}/e/${venue.slug}/${experience.slug}?canceled=1`,
    });

    await db.payment.create({
      data: {
        venueId: venue.id,
        amountCents: totalCents,
        currency: venue.currency,
        kind: "TICKET",
        status: "PENDING",
        stripePaymentId: session.id,
      },
    });

    return { ticketId: ticket.id, checkoutUrl: session.url ?? null, free: false };
  } catch (err) {
    console.error("[stripe:ticket-checkout] failed", err);
    return { ticketId: ticket.id, checkoutUrl: null, free: false };
  }
}

export async function getTicket(id: string) {
  return db.ticket.findUnique({
    where: { id },
    include: {
      experience: {
        include: {
          venue: { select: { name: true, currency: true, slug: true, email: true } },
        },
      },
    },
  });
}

async function notifyTicketBuyer(opts: {
  buyerName: string;
  buyerEmail: string;
  experienceTitle: string;
  startsAt: Date;
  quantity: number;
  totalCents: number;
  venueName: string;
  venueEmail: string | null;
}) {
  const tpl = renderGuestConfirmation({
    guest: { firstName: opts.buyerName.split(" ")[0] || opts.buyerName, lastName: null },
    venue: { name: opts.venueName, city: null, address: null, phone: null, email: opts.venueEmail },
    booking: {
      reference: `tk-${Date.now()}`,
      partySize: opts.quantity,
      startsAt: opts.startsAt,
      occasion: null,
      notes: opts.experienceTitle,
    },
  });
  await sendEmail({
    to: { email: opts.buyerEmail, name: opts.buyerName },
    subject: `🎟️ ${opts.experienceTitle}`,
    html: tpl.html,
    text: tpl.text,
    replyTo: opts.venueEmail ?? undefined,
  });
}
