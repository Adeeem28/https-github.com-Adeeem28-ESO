"use client";
import { useEffect, useRef } from "react";

/** Keep phone Back inside the authenticated shell; never put user data in history. */
export function usePhoneBack(view: string, enabled: boolean, navigate: (view: string) => void, closeOverlay: () => boolean) {
  const current = useRef({ view, navigate, closeOverlay });
  current.current = { view, navigate, closeOverlay };
  const pages = useRef<string[]>([]);
  const restoring = useRef(false);
  useEffect(() => {
    if (!enabled) { pages.current = []; return; }
    if (restoring.current) { restoring.current = false; return; }
    if (pages.current.at(-1) !== view) pages.current.push(view);
  }, [view, enabled]);
  useEffect(() => {
    if (!enabled || !(matchMedia('(max-width:1300px)').matches || matchMedia('(display-mode: standalone)').matches)) return;
    const arm = () => history.pushState({ ...history.state, esoPhoneBack: true }, "", location.href);
    if (!history.state?.esoPhoneBack) arm();
    const back = () => {
      arm();
      const dismiss = new Event('eso-phone-back', { cancelable: true });
      if (!window.dispatchEvent(dismiss)) return;
      // Prefer the topmost dialog's close control before an underlying report.
      const dialogs = document.querySelectorAll('.modal-backdrop');
      if (dialogs.length) {
        const top = dialogs[dialogs.length - 1];
        const close = top.querySelector<SVGElement>('.modal-head .lucide-x, .notifications-head .lucide-x, .reclassify-modal-head .lucide-x');
        const button = close?.closest<HTMLButtonElement>('button');
        if (button && !button.disabled) { button.click(); return; }
        if (current.current.closeOverlay()) return;
        return; // Keep mandatory or unsaved dialogs open rather than leaving the app.
      }
      if (current.current.closeOverlay()) return;
      if (pages.current.length > 1) pages.current.pop();
      const target = pages.current.at(-1) || 'dashboard';
      if (target !== current.current.view) {
        restoring.current = true;
        current.current.navigate(target);
      }
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [enabled]);
}
