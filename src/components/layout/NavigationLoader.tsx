"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const R = 38;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * 0.78;
const GAP = CIRC - ARC;

export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationPending = useRef(false);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      mutationPending.current = false;
      setLoading(false);
    }, 200);
  };

  // ── Intercept history.pushState / replaceState
  // Covers: <Link>, router.push(), router.replace(), EntitySwitcher
  useEffect(() => {
    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    function handleNav(url: string | URL | null | undefined) {
      if (!url) return;
      const next = typeof url === "string" ? url : url.toString();
      const current = window.location.pathname + window.location.search;
      if (next !== current && next !== "") setLoading(true);
    }

    window.history.pushState = (state, title, url) => { handleNav(url); return origPush(state, title, url); };
    window.history.replaceState = (state, title, url) => { handleNav(url); return origReplace(state, title, url); };

    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  // ── Hide when React finishes rendering the new route
  // useSearchParams() updates when Next.js re-renders with new search params,
  // so this catches both pathname changes AND entity-switch (search param only changes)
  useEffect(() => {
    if (!mutationPending.current) scheduleHide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // ── Listen to usePageTransition events (mutations: add, delete, edit)
  useEffect(() => {
    const onStart = () => { mutationPending.current = true; setLoading(true); };
    const onStop  = () => { mutationPending.current = false; scheduleHide(); };
    window.addEventListener("pageloader:start", onStart);
    window.addEventListener("pageloader:stop", onStop);
    return () => {
      window.removeEventListener("pageloader:start", onStart);
      window.removeEventListener("pageloader:stop", onStop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Safety auto-hide after 15s
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 15_000);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="nav-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden"
        >
          <div className="w-[100px] h-[100px] animate-spin" style={{ animationDuration: "1.1s" }}>
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r={R} stroke="white" strokeWidth="5.5" opacity={0.15} />
              <circle
                cx="50" cy="50" r={R}
                stroke="white"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={`${ARC} ${GAP}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
