import { type VariantProps, cva } from "class-variance-authority";

export const badgeVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-md border-2 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-foreground bg-foreground text-background",
        destructive: "border-destructive bg-destructive text-background",
        outline: "border-background bg-background text-foreground",
        secondary: "border-secondary bg-secondary text-foreground",
      },
      font: {
        normal: "",
        retro: "retro",
      },
    },
    defaultVariants: {
      variant: "default",
      font: "retro",
    },
  }
);

export type BadgeVariantsProps = VariantProps<typeof badgeVariants>;
