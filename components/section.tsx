import type { ReactNode } from "react";

type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  headingAs?: "h1" | "h2";
  children: ReactNode;
};

export function Section({ eyebrow, title, description, headingAs = "h2", children }: SectionProps) {
  const HeadingTag = headingAs;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="site-section-heading mb-7 max-w-3xl">
        {eyebrow ? (
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
          </div>
        ) : null}
        <HeadingTag className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </HeadingTag>
        {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
