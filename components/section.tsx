import type { ReactNode } from "react";

type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-7 max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

