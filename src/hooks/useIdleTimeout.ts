// =============================================================================
// useIdleTimeout
// Signs the user out and redirects to /login after a period of inactivity.
// Track: mousemove, keydown, click, touchstart.
//
// Usage (in a component inside <Router>):
//   useIdleTimeout();            // default 30 min
//   useIdleTimeout(15 * 60000);  // 15 min
// =============================================================================

import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "touchstart",
  "scroll",
];

export function useIdleTimeout(initialTimeoutMs: number = DEFAULT_TIMEOUT_MS): void {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeoutMs, setTimeoutMs] = useState(initialTimeoutMs);

  useEffect(() => {
    if (user?.companyId) {
      const fetchSettings = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'companies', user.companyId, 'settings', 'security'));
          if (docSnap.exists() && docSnap.data().idleTimeoutMinutes !== undefined) {
             const minutes = docSnap.data().idleTimeoutMinutes;
             if (minutes === 0) {
                 setTimeoutMs(0); // Never
             } else {
                 setTimeoutMs(minutes * 60 * 1000);
             }
          }
        } catch (e) {
            console.error("Error fetching security settings for idle timeout:", e);
        }
      };
      fetchSettings();
    }
  }, [user]);

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
    if (!user || timeoutMs === 0) {
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
