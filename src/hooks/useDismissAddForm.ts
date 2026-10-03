"use client";

import { useEffect, useRef } from "react";

/**
 * Closes an open add form when the user taps or clicks anywhere outside it.
 * The "add" buttons (.planning-quick-add) are left out because they open and
 * toggle the form themselves.
 */
export function useDismissAddForm(open: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".planning-add-form, .planning-quick-add")) return;
      onDismissRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);
}
