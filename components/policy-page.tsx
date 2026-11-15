import Link from "next/link";
import type { ReactNode } from "react";

type PolicyPageProps = {
  title: string;
  introduction: string;
  sections: readonly { title: string; body: string }[];
  children: ReactNode;
};

export function PolicyPage({ title, introduction, sections, children }: PolicyPageProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="max-w-3xl border-b border-border/70 pb-10 sm:pb-12">
        <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">{introduction}</p>
      </header>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
          <ol className="space-y-1">
            {sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#section-${index + 1}`} className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm leading-6 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article aria-label={title} className="min-w-0 max-w-3xl space-y-8 sm:space-y-10">
          {sections.map((section, index) => (
            <section key={section.title} id={`section-${index + 1}`} aria-labelledby={`heading-${index + 1}`} className="scroll-mt-28 border-b border-border/60 pb-8 sm:pb-10">
              <h2 id={`heading-${index + 1}`} className="font-heading text-xl leading-8 font-medium tracking-tight sm:text-2xl">{section.title}</h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-muted-foreground">
                {section.body.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
          {children}
          <nav aria-label="Policies" className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-6">
            <Link href="/privacy-policy" className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Privacy Policy</Link>
            <Link href="/terms-of-hire" className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Terms of Hire</Link>
          </nav>
        </article>
      </div>
    </div>
  );
}
