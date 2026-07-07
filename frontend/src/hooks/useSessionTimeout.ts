import { useEffect, useRef } from "react";
import {
  getIdleMinutes,
  isSessionExpired,
  touchActivity,
} from "../lib/sessionAuth";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * Auto-logout after idle time or when the tab returns after session expiry.
 */
export function useSessionTimeout(
  isLoggedIn: boolean,
  onExpired: () => void | Promise<void>
) {
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (!isLoggedIn) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function expireSession() {
      void onExpiredRef.current();
    }

    function checkExpiry() {
      if (isSessionExpired()) {
        expireSession();
        return true;
      }
      return false;
    }

    function scheduleIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      const idleMs = getIdleMinutes() * 60 * 1000;
      idleTimer = setTimeout(() => {
        if (isSessionExpired()) expireSession();
      }, idleMs);
    }

    function onActivity() {
      if (checkExpiry()) return;
      touchActivity();
      scheduleIdleTimer();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkExpiry();
      }
    }

    if (checkExpiry()) return;

    scheduleIdleTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isLoggedIn]);
}
