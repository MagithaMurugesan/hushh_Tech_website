/**
 * HushhTechCta — Reusable CTA button component
 * Two variants: BLACK (filled) and WHITE (outlined)
 * Rounded, tall buttons matching the premium Hushh design.
 *
 * Usage:
 *   <HushhTechCta variant={HushhTechCtaVariant.BLACK} onClick={handleClick}>
 *     Complete Your Profile <span className="material-symbols-outlined">arrow_forward</span>
 *   </HushhTechCta>
 */
import React from "react";

/** Enum for CTA button variants */
export enum HushhTechCtaVariant {
  BLACK = "black",
  WHITE = "white",
}

interface HushhTechCtaProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant — BLACK (filled) or WHITE (outlined) */
  variant: HushhTechCtaVariant;
  /** Button content */
  children: React.ReactNode;
}

/** Tailwind classes for each variant */
const VARIANT_CLASSES: Record<HushhTechCtaVariant, string> = {
  [HushhTechCtaVariant.BLACK]: [
    "bg-black text-white border border-black",
    "shadow-lg hover:shadow-xl hover:bg-black/90",
    "active:scale-[0.98] transition-all",
  ].join(" "),

  [HushhTechCtaVariant.WHITE]: [
    "bg-white text-black border border-black",
    "hover:bg-gray-50",
    "active:scale-[0.98] transition-colors",
  ].join(" "),
};

/** Base classes shared by both variants — always full-width, consistent height */
const BASE_CLASSES = [
  "w-full h-14 px-8 rounded-xl",
  "font-semibold text-sm tracking-wide whitespace-nowrap capitalize",
  "flex items-center justify-center gap-2",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const HushhTechCta: React.FC<HushhTechCtaProps> = ({
  variant,
  children,
  className = "",
  ...rest
}) => {
  return (
    <button
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default HushhTechCta;
