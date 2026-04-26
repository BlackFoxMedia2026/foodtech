import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { getSurveyByToken } from "@/server/surveys";
import { SurveyForm } from "@/components/surveys/survey-form";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: { token: string } }) {
  const survey = await getSurveyByToken(params.token);
  if (!survey) notFound();
  const submitted = Boolean(survey.respondedAt && survey.response);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span>Tavolo · feedback</span>
      </header>

      {submitted ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="text-display text-3xl">Grazie!</h1>
          <p className="text-sm text-muted-foreground">
            Il tuo feedback è arrivato a {survey.venue.name}. Ci aiuta tantissimo.
          </p>
        </section>
      ) : (
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">{survey.venue.name}</p>
            <h1 className="text-display text-3xl leading-tight md:text-4xl">
              <MessageCircle className="mb-1 mr-2 inline h-7 w-7 text-gilt-dark" />
              Com&apos;è andata?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Bastano 30 secondi. Le tue parole ci aiutano a migliorare.
            </p>
          </div>
          <SurveyForm token={params.token} reviewLinks={survey.venue.reviewLinks} />
        </section>
      )}

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Tavolo</span>
      </footer>
    </div>
  );
}
