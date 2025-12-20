import { cn } from "@/lib/utils";

import { Badge as ShadcnBadge } from "@/components/ui/badge";

import { badgeVariants, type BadgeVariantsProps } from "./badge.variants";

import "./styles/retro.css";

export interface BitBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    BadgeVariantsProps {
  asChild?: boolean;
}

function Badge({ children, variant, className, font }: BitBadgeProps) {
  const color = badgeVariants({ variant, font });

  const classes = (className || "").split(" ");

  // visual classes for badge and sidebars
  const visualClasses = classes.filter(
    (c) =>
      c.startsWith("bg-") ||
      c.startsWith("border-") ||
      c.startsWith("text-") ||
      c.startsWith("rounded-")
  );

  // Container should accept all non-visual utility classes (e.g., size, spacing, layout)
  const containerClasses = classes.filter(
    (c) =>
      !(
        c.startsWith("bg-") ||
        c.startsWith("border-") ||
        c.startsWith("text-") ||
        c.startsWith("rounded-")
      )
  );

  return (
    <div className={cn("relative inline-flex items-stretch", containerClasses)}>
      <ShadcnBadge
        className={cn(
          "h-full",
          "rounded-none",
          "w-full",
          font !== "normal" && "retro",
          visualClasses
        )}
        variant={variant}
      >
        {children}
      </ShadcnBadge>

      {/* Left pixel bar */}
      <div
        className={cn(
          "-left-1.5 absolute inset-y-[4px] w-1.5",
          color,
          visualClasses
        )}
      />
      {/* Right pixel bar */}
      <div
        className={cn(
          "-right-1.5 absolute inset-y-[4px] w-1.5",
          color,
          visualClasses
        )}
      />
    </div>
  );
}

export { Badge };
