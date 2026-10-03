"use client";

import { useEffect, useRef, useState } from "react";

import { packageTiers } from "@/lib/site-content";
import { PackageCard } from "@/components/package-card";
import { Button } from "@/components/ui/button";

export function PackageCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadeEdges, setFadeEdges] = useState({ left: false, right: true });
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const packageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    function updateFadeEdges() {
      if (!carousel) return;
      const edgeThreshold = 8;
      setFadeEdges({
        left: carousel.scrollLeft > edgeThreshold,
        right:
          carousel.scrollLeft + carousel.clientWidth <
          carousel.scrollWidth - edgeThreshold,
      });
    }

    updateFadeEdges();
    carousel.addEventListener("scroll", updateFadeEdges, { passive: true });
    const frame = window.requestAnimationFrame(updateFadeEdges);
    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(updateFadeEdges) : null;
    resizeObserver?.observe(carousel);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      carousel.removeEventListener("scroll", updateFadeEdges);
    };
  }, []);

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
      <div className="relative">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Previous package"
          onClick={() => moveToPackage(activeIndex - 1)}
          className="absolute top-28 left-2 z-20 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur-sm"
        >
          <span aria-hidden="true">←</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Next package"
          onClick={() => moveToPackage(activeIndex + 1)}
          className="absolute top-28 right-2 z-20 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur-sm"
        >
          <span aria-hidden="true">→</span>
        </Button>
        {fadeEdges.left ? (
          <div
            aria-hidden="true"
            data-testid="package-carousel-left-fade"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-background/70 via-background/20 to-transparent transition-opacity duration-300"
          />
        ) : null}
        {fadeEdges.right ? (
          <div
            aria-hidden="true"
            data-testid="package-carousel-right-fade"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-background/70 via-background/20 to-transparent transition-opacity duration-300"
          />
        ) : null}
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
