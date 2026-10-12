import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const laptopFrameVariants = {
  gray: {
    border: "border-neutral-300",
    base: "bg-linear-to-b from-neutral-300 to-neutral-400",
    notch: "bg-neutral-500",
  },
  titanium: {
    border: "border-[#7a7671]",
    base: "bg-linear-to-b from-[#8a8580] to-[#6a6560]",
    notch: "bg-[#5c5854]",
  },
  white: {
    border: "border-neutral-200",
    base: "bg-linear-to-b from-neutral-100 to-neutral-300",
    notch: "bg-neutral-400",
  },
  midnight: {
    border: "border-[#26262c]",
    base: "bg-linear-to-b from-[#34343c] to-[#1c1c22]",
    notch: "bg-[#131318]",
  },
} as const;

export type LaptopFrameVariant = keyof typeof laptopFrameVariants;

type LaptopMockupCardProps = Readonly<
  ComponentPropsWithoutRef<"div"> & {
    variant?: LaptopFrameVariant;
    children?: ReactNode;
  }
>;

export const LaptopMockupCard = forwardRef<
  HTMLDivElement,
  LaptopMockupCardProps
>(({ className, children, variant = "titanium", ...props }, ref) => {
  const frame = laptopFrameVariants[variant];

  return (
    <div
      ref={ref}
      data-slot="laptop-mockup-card"
      data-variant={variant}
      className={cn("flex flex-col items-center font-sans", className)}
      {...props}
    >
      <div
        className={cn(
          "w-full max-w-[340px] sm:max-w-[480px] md:max-w-[560px] overflow-hidden rounded-t-xl border-2 border-b-0 shadow-2xl",
          frame.border,
        )}
      >
        <div className="bg-neutral-900 p-2 pb-0">
          <div className="relative h-60 sm:h-76 md:h-88 overflow-hidden rounded-t-sm bg-neutral-950">
            <div className="relative size-full overflow-hidden rounded-t-sm">
              {children}
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "relative h-3 w-[360px] sm:w-[510px] md:w-[600px] rounded-b-xl",
          frame.base,
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-b-md md:w-20",
            frame.notch,
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  );
});

LaptopMockupCard.displayName = "LaptopMockupCard";
