"use client";

import { useTransition } from "react";

// Drop-in replacement for React's useTransition.
// Fires the global NavigationLoader spinner while the transition is pending.
export function usePageTransition() {
  const [isPending, startTransition] = useTransition();

  function startPageTransition(action: () => void | Promise<void>) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pageloader:start"));
    }
    startTransition(async () => {
      try {
        await action();
      } finally {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("pageloader:stop"));
        }
      }
    });
  }

  return [isPending, startPageTransition] as const;
}
