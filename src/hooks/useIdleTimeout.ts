// =============================================================================
// useIdleTimeout
// Signs the user out and redirects to /login after a period of inactivity.
// Track: mousemove, keydown, click, touchstart.
//
// Usage (in a component inside <Router>):
//   useIdleTimeout();            // default 30 min
//   useIdleTimeout(15 * 60000);  // 15 min
// =============================================================================

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "touchstart",
  "scroll",
];

export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS): void {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(async () => {
    await logout();
    navigate("/login?reason=session_expired", { replace: true });
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs]);

  useEffect(() => {
    // Only track idle when a user is logged in
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Start the timer
    resetTimer();

    // Add listeners
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [user, resetTimer]);
}
