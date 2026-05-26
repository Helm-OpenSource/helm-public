import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (
    {
      className,
      placeholder,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const derivedAriaLabel =
      ariaLabel ??
      (ariaLabelledBy || typeof placeholder !== "string"
        ? undefined
        : placeholder);

    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white_14%)] px-3.5 py-2 text-sm text-[color:var(--foreground)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--ring)]",
          className,
        )}
        placeholder={placeholder}
        aria-label={derivedAriaLabel}
        aria-labelledby={ariaLabelledBy}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
