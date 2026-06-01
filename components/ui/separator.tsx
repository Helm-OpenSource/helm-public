import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn("h-px w-full bg-[color:var(--border)]", className)}
      decorative
      orientation="horizontal"
      {...props}
    />
  );
}
