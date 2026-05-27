import { useState } from "react";
import { cn } from "@/lib/utils";

type CountryFlagProps = {
  code: string;
  className?: string;
};

export function CountryFlag({ code, className }: CountryFlagProps) {
  const normalized = code.toLowerCase();
  const [failed, setFailed] = useState(!/^[a-z]{2}$/.test(normalized));

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-5 shrink-0 items-center justify-center rounded-[3px] bg-muted text-[9px] font-semibold uppercase leading-none text-muted-foreground ring-1 ring-border/60",
          className,
        )}
      >
        {code.slice(0, 2)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] bg-muted ring-1 ring-border/60",
        className,
      )}
    >
      <img
        src={`https://flagcdn.com/w40/${normalized}.png`}
        srcSet={`https://flagcdn.com/w40/${normalized}.png 1x, https://flagcdn.com/w80/${normalized}.png 2x`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
