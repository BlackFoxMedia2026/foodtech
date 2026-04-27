"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Code2, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Kind = "url" | "embed" | "hub";

export function WidgetLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState<Kind | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/b/${slug}`;
  const hubUrl = `${origin}/v/${slug}`;
  const embed = `<iframe src="${url}" width="100%" height="780" style="border:0;border-radius:12px" title="Prenota online"></iframe>`;

  async function copy(value: string, kind: Kind) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link pubblici del locale</CardTitle>
        <CardDescription>
          Hub pubblico, widget di prenotazione e snippet embed da incollare sul sito.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Hub pubblico (Instagram, Google Business, biglietti da visita)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border bg-secondary px-3 py-2 text-xs">
              {hubUrl}
            </code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(hubUrl, "hub")}>
                {copied === "hub" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "hub" ? "Copiato" : "Copia"}
              </Button>
              <Button size="sm" variant="gold" asChild>
                <a href={hubUrl} target="_blank" rel="noreferrer">
                  Apri <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-md border bg-secondary px-3 py-2 text-xs">
            {url}
          </code>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(url, "url")}>
              {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "url" ? "Copiato" : "Copia"}
            </Button>
            <Button size="sm" variant="gold" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Apri <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Code2 className="h-3.5 w-3.5" /> Embed iframe
          </p>
          <pre className="overflow-x-auto rounded-md border bg-secondary px-3 py-2 text-xs">
            {embed}
          </pre>
          <Button size="sm" variant="outline" onClick={() => copy(embed, "embed")}>
            {copied === "embed" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "embed" ? "Copiato" : "Copia codice"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
