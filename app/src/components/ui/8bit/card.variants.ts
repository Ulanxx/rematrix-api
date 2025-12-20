import { type VariantProps, cva } from "class-variance-authority";

export const cardVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "retro",
  },
});

export type CardVariantsProps = VariantProps<typeof cardVariants>;
