"use client";

import * as React from "react";
import { ConfirmProvider } from "@/components/ui/alert-dialog";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ToastProvider>
        {children}
        <ToastViewport />
      </ToastProvider>
    </ConfirmProvider>
  );
}
