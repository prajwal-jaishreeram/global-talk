import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const phoneFrameVariants = {
  purple: {
    frame: "bg-[#4a4254]",
    button: "bg-[#423d4d]",
  },
  orange: {
    frame: "bg-[#d4845a]",
    button: "bg-[#cc7a50]",
  },
  white: {
    frame: "bg-[#e4e4e8]",
    button: "bg-[#d8d8de]",
  },
  titanium: {
    frame: "bg-[#1F1F23] dark:bg-[#1A1A1E] ring-1 ring-black/10 dark:ring-white/10",
    button: "bg-[#333338] dark:bg-[#2A2A30]",
  },
  cherry: {
    frame: "bg-[#d49aa8]",
    button: "bg-[#ca90a0]",
  },
} as const;

export type PhoneFrameVariant = keyof typeof phoneFrameVariants;

const PHONE_ASPECT = 71 / 138;

type PhoneMockupCardProps = Readonly<
  ComponentPropsWithoutRef<"div"> & {
    variant?: PhoneFrameVariant;
    visibleRatio?: number;
    showDynamicIsland?: boolean;
  }
>;

const buttonClass = (color: string) =>
  cn("absolute w-[3px] rounded-l-sm", color);

function PhoneSideButtons({
  frame,
}: Readonly<{
  frame: (typeof phoneFrameVariants)[PhoneFrameVariant];
}>) {
  return (
    <>
      {/* Mute switch */}
      <div
        className={cn(
          buttonClass(frame.button),
          "top-[15.5%] -left-[3px] h-[3.2%]",
        )}
        aria-hidden="true"
      />
      {/* Volume up */}
      <div
        className={cn(
          buttonClass(frame.button),
          "top-[21%] -left-[3px] h-[7.2%]",
        )}
        aria-hidden="true"
      />
      {/* Volume down */}
      <div
        className={cn(
          buttonClass(frame.button),
          "top-[30.5%] -left-[3px] h-[7.2%]",
        )}
        aria-hidden="true"
      />
      {/* Power button */}
      <div
        className={cn(
          buttonClass(frame.button),
          "top-[23%] -right-[3px] h-[11.5%] rounded-l-none rounded-r-sm",
        )}
        aria-hidden="true"
      />
    </>
  );
}

function PhoneScreen({
  children,
  showDynamicIsland,
}: Readonly<{
  children: ReactNode;
  showDynamicIsland: boolean;
}>) {
  return (
    <div className="relative w-full rounded-[2.35rem] bg-neutral-950 p-[3px] text-foreground">
      {/* Screen container */}
      <div className="relative w-full overflow-hidden rounded-[2.2rem] bg-card flex flex-col">
        {showDynamicIsland ? (
          <div
            className="pointer-events-none absolute top-[7px] left-1/2 z-30 h-[18px] w-[64px] -translate-x-1/2 rounded-full bg-black flex items-center justify-end px-2 shadow-xs"
            aria-hidden="true"
          >
            <div
              className="h-[5.5px] w-[5.5px] shrink-0 rounded-full bg-[#1b3a57]"
              aria-hidden="true"
            />
          </div>
        ) : null}

        <div className="relative w-full flex flex-col">{children}</div>

        {/* Home indicator */}
        <div
          className="pointer-events-none absolute bottom-[5px] left-1/2 z-30 h-[3px] w-[30%] -translate-x-1/2 rounded-full bg-foreground/25"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export const PhoneMockupCard = forwardRef<HTMLDivElement, PhoneMockupCardProps>(
  (
    {
      className,
      children,
      variant = "titanium",
      visibleRatio = 1,
      showDynamicIsland = true,
      style,
      ...props
    },
    ref,
  ) => {
    const frame = phoneFrameVariants[variant];
    const ratio = Math.min(1, Math.max(0, visibleRatio));
    const isCropped = ratio < 1;

    const phoneFrameClassName = cn(
      "relative w-full rounded-[2.5rem] p-[3px] shadow-2xl transition-all",
      frame.frame,
    );

    if (!isCropped) {
      return (
        <div
          ref={ref}
          data-slot="phone-mockup-card"
          data-variant={variant}
          className={cn(phoneFrameClassName, className)}
          style={style}
          {...props}
        >
          <PhoneSideButtons frame={frame} />
          <PhoneScreen showDynamicIsland={showDynamicIsland}>
            {children}
          </PhoneScreen>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-slot="phone-mockup-card"
        data-variant={variant}
        data-visible-ratio={ratio}
        className={cn("relative overflow-hidden", className)}
        style={{
          aspectRatio: PHONE_ASPECT / ratio,
          ...style,
        }}
        {...props}
      >
        <div className="absolute inset-0 right-[3px] left-[3px] overflow-hidden">
          <div
            className={cn(phoneFrameClassName, "w-full shrink-0")}
            style={{ height: `${100 / ratio}%` }}
          >
            <PhoneScreen showDynamicIsland={showDynamicIsland}>
              {children}
            </PhoneScreen>
          </div>
        </div>

        <div
          className="pointer-events-none absolute top-0 left-[3px] z-10 w-full shrink-0"
          style={{ height: `${100 / ratio}%` }}
        >
          <PhoneSideButtons frame={frame} />
        </div>
      </div>
    );
  },
);

PhoneMockupCard.displayName = "PhoneMockupCard";
