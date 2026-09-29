"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MobileDateNavProps {
  label: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  prevLabel: string;
  nextLabel: string;
}

export default function MobileDateNav({
  label,
  onPrev,
  onNext,
  onReset,
  prevLabel,
  nextLabel,
}: MobileDateNavProps) {
  return (
    <div className="mobile-date-nav">
      <button
        type="button"
        onClick={onPrev}
        className="mobile-date-nav__arrow"
        aria-label={prevLabel}
      >
        <ChevronLeft size={18} strokeWidth={2.2} />
      </button>

      <button type="button" onClick={onReset} className="mobile-date-nav__label">
        {label}
      </button>

      <button
        type="button"
        onClick={onNext}
        className="mobile-date-nav__arrow"
        aria-label={nextLabel}
      >
        <ChevronRight size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
