"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customerReviews } from "@/lib/site-content";

export function CustomerReviews() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const reviewRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasRevealedSection = useRef(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      if (!hasRevealedSection.current) {
        hasRevealedSection.current = true;
        if (
          reviewsSectionRef.current &&
          typeof reviewsSectionRef.current.scrollIntoView === "function"
        ) {
          reviewsSectionRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
      setActiveIndex((current) => (current + 1) % customerReviews.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    const carousel = carouselRef.current;
    const review = reviewRefs.current[activeIndex];
    if (carousel && review && typeof carousel.scrollTo === "function") {
      carousel.scrollTo({
        left: review.offsetLeft,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  function moveToReview(index: number) {
    setActiveIndex((index + customerReviews.length) % customerReviews.length);
  }

  return (
    <div
      ref={reviewsSectionRef}
      role="region"
      aria-label="Customer reviews"
      aria-roledescription="carousel"
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      <div className="absolute -top-12 right-0 z-20 flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Previous review"
          onClick={() => moveToReview(activeIndex - 1)}
        >
          <span aria-hidden="true">←</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Next review"
          onClick={() => moveToReview(activeIndex + 1)}
        >
          <span aria-hidden="true">→</span>
        </Button>
      </div>
      <div
        ref={carouselRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {customerReviews.map((review, index) => (
          <div
            key={review.reviewer}
            ref={(element) => {
              reviewRefs.current[index] = element;
            }}
            className="min-w-[min(21rem,88vw)] snap-start sm:min-w-[24rem]"
            aria-label={`Review ${index + 1} of ${customerReviews.length}`}
          >
            <Card className="h-full border transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
              <CardHeader className="gap-3">
                <div className="flex gap-1 text-amber-400" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <Star key={starIndex} className="size-4 fill-current" aria-hidden="true" />
                  ))}
                </div>
                <CardTitle className="text-base">{review.reviewer}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                “{review.text}”
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center gap-1.5" aria-label="Choose a review">
        {customerReviews.map((review, index) => (
          <button
            key={review.reviewer}
            type="button"
            aria-label={`Show review ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => moveToReview(index)}
            className={`size-2 rounded-full transition-colors ${
              index === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
