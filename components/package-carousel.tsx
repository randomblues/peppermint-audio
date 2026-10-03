"use client";

import { useEffect, useRef, useState } from "react";

import { packageTiers } from "@/lib/site-content";
import { PackageCard } from "@/components/package-card";
import { Button } from "@/components/ui/button";

export function PackageCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const packageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const carousel = carouselRef.current;
    const packageCard = packageRefs.current[activeIndex];
    if (carousel && packageCard && typeof carousel.scrollTo === "function") {
      carousel.scrollTo({
        left: packageCard.offsetLeft,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  function moveToPackage(index: number) {
    setActiveIndex((index + packageTiers.length) % packageTiers.length);
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      <div className="absolute -top-12 right-0 z-20 flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Previous package"
          onClick={() => moveToPackage(activeIndex - 1)}
        >
          <span aria-hidden="true">←</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Next package"
          onClick={() => moveToPackage(activeIndex + 1)}
        >
          <span aria-hidden="true">→</span>
        </Button>
      </div>
      <div
        ref={carouselRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {packageTiers.map((pkg, index) => (
          <div
            key={pkg.slug}
            ref={(element) => {
              packageRefs.current[index] = element;
            }}
            className="min-w-[min(21rem,88vw)] snap-start sm:min-w-[24rem]"
            aria-label={`Package ${index + 1}`}
          >
            <PackageCard pkg={pkg} compact priority={index === 0} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center gap-1.5" aria-label="Choose a package">
        {packageTiers.map((pkg, index) => (
          <button
            key={pkg.slug}
            type="button"
            aria-label={`Show ${pkg.name}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => moveToPackage(index)}
            className={`size-2 rounded-full transition-colors ${
              index === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
