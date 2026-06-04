import { useEffect } from 'react';

/**
 * Font-size reorder — cosmetic. BBB renders the Settings "font size" stepper as
 * [- value +] across separate sibling cells; the prototype puts the value BETWEEN
 * the - and + buttons. CSS can't reorder it (hashed classes), so this nudges the DOM.
 *
 * Best-effort + defensive: anchored on the stable [data-test] button hooks (never
 * hashed classes), re-applied on DOM mutations, and fully wrapped in try/catch so a
 * BBB markup change can never throw into the room.
 */
function FontSizeReorder(): null {
  useEffect(() => {
    const apply = () => {
      try {
        const dec = document.querySelector('[data-test="decreaseFontSize"]');
        const inc = document.querySelector('[data-test="increaseFontSize"]');
        if (!dec || !inc) return;
        const row = dec.parentElement;
        if (!row || dec.parentElement !== inc.parentElement) return;

        // Find the value cell: a sibling that isn't the two buttons and shows "%".
        const valueCell = Array.from(row.children).find(
          (el) => el !== dec && el !== inc && /%/.test(el.textContent ?? ''),
        );
        if (!valueCell) return;

        // Desired order: decrease, value, increase. Only move if not already there.
        if (dec.nextElementSibling !== valueCell) {
          row.insertBefore(valueCell, inc);
        }
      } catch {
        // BBB markup changed shape — never throw into the room.
      }
    };

    let rafId: number | null = null;
    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => { rafId = null; apply(); });
    };

    apply(); // initial attempt (in case the settings DOM is already present)
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return null;
}

export default FontSizeReorder;
