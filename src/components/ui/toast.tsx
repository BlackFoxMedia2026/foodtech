"use client";

import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Toast system minimal: zero dependenze esterne (Radix Toast non usato per
// mantenere bundle leggero). Auto-dismiss 4s, slide-in da bottom-right.

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
};

type ToastContextValue = {
  toast: {
    success: (message: string, description?: string) => void;
    error: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
  };
  dismiss: (id: string) => void;
  items: ToastItem[];
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timeouts = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const push = React.useCallback(
    (variant: ToastVariant, message: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev, { id, variant, message, description }]);
      const handle = setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
        timeouts.current.delete(id);
      }, AUTO_DISMISS_MS);
      timeouts.current.set(id, handle);
    },
    [],
  );

  React.useEffect(() => {
    const map = timeouts.current;
    return () => {
      map.forEach((handle) => clearTimeout(handle));
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      items,
      dismiss,
      toast: {
        success: (m, d) => push("success", m, d),
        error: (m, d) => push("error", m, d),
        info: (m, d) => push("info", m, d),
      },
    }),
    [items, dismiss, push],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider />");
  }
  return ctx;
}

const variantStyles: Record<ToastVariant, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: "ring-1 ring-emerald-500/30 shadow-[0_8px_32px_-12px_rgba(16,185,129,0.4)]",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
  error: {
    ring: "ring-1 ring-red-500/30 shadow-[0_8px_32px_-12px_rgba(239,68,68,0.45)]",
    icon: <XCircle className="h-4 w-4 text-red-400" />,
  },
  info: {
    ring: "ring-1 ring-sky-500/25 shadow-[0_8px_32px_-12px_rgba(56,189,248,0.35)]",
    icon: <Info className="h-4 w-4 text-sky-400" />,
  },
};

export function ToastViewport() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;
  const { items, dismiss } = ctx;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const v = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card/95 p-3 pr-8 backdrop-blur",
              "animate-slide-up",
              v.ring,
            )}
          >
            <span className="mt-0.5 shrink-0">{v.icon}</span>
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground leading-snug">{t.message}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground/70 opacity-70 transition hover:bg-secondary hover:opacity-100"
              aria-label="Chiudi notifica"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
