import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_78%,white)_42%,color-mix(in_oklab,var(--primary)_70%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_rgb(0_0_0/0.24),0_0_22px_color-mix(in_oklab,var(--primary)_18%,transparent)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_30px_rgb(0_0_0/0.28),0_0_30px_color-mix(in_oklab,var(--primary)_24%,transparent)]",
        outline:
          "border-primary/20 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_92%,var(--primary)_14%),color-mix(in_oklab,var(--background)_78%,black))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgb(0_0_0/0.2)] backdrop-blur-sm hover:-translate-y-0.5 hover:border-primary/45 hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgb(0_0_0/0.24),0_0_18px_color-mix(in_oklab,var(--primary)_16%,transparent)] aria-expanded:border-primary/45 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border-primary/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--muted)_92%,var(--primary)_10%),color-mix(in_oklab,var(--muted)_76%,black))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgb(0_0_0/0.18)] hover:border-primary/35 hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-primary/10 hover:text-foreground aria-expanded:bg-primary/10 aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
