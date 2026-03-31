import { useMemo } from "react";

/**
 * Returns true for iOS (iPhone/iPad), Android, and other touch-first devices
 * that support navigator.share — regardless of screen width.
 *
 * Desktop Chromium builds that happen to expose navigator.share are NOT
 * treated as mobile because they lack iOS/Android user-agent tokens and
 * typically report maxTouchPoints === 0.
 */
export function useIsMobileOrTablet(): boolean {
  return useMemo(() => {
    const ua = navigator.userAgent;

    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    // iPadOS 13+ reports as "Macintosh" but always has maxTouchPoints > 1
    const isIPadOS =
      /Macintosh/i.test(ua) &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1;

    // Generic touch-first check: has touch points and is not a desktop UA
    const isDesktopUA = /Windows NT|Macintosh|Linux x86_64/i.test(ua);
    const hasTouchPoints =
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 0;
    const isTouchFirst = !isDesktopUA && hasTouchPoints;

    return isIOS || isAndroid || isIPadOS || isTouchFirst;
  }, []);
}
