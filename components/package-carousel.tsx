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
  const programmaticTarget = useRef<number | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    function updateFadeEdges() {
      if (!carousel) return;
      const edgeThreshold = 8;
      const scrollInset = carousel.clientWidth < 640 ? 32 : 0;
      const atLeftEdge = carousel.scrollLeft <= edgeThreshold;
      const atRightEdge =
        carousel.scrollLeft + carousel.clientWidth >=
        carousel.scrollWidth - edgeThreshold;
      setFadeEdges({
        left: !atLeftEdge,
        right: !atRightEdge,
      });

      const targetIndex = programmaticTarget.current;
      const targetCard = targetIndex === null ? null : packageRefs.current[targetIndex];
      if (targetIndex !== null) {
        const targetSettledAtEdge =
          (targetIndex === 0 && atLeftEdge) ||
          (targetIndex === packageTiers.length - 1 && atRightEdge);

        if (targetSettledAtEdge) {
          programmaticTarget.current = null;
          setActiveIndex((currentIndex) =>
            currentIndex === targetIndex ? currentIndex : targetIndex,
          );
          return;
        }

        if (
          targetCard &&
          Math.abs(targetCard.offsetLeft - scrollInset - carousel.scrollLeft) > edgeThreshold
        ) {
          return;
        }
        programmaticTarget.current = null;
        setActiveIndex((currentIndex) =>
          currentIndex === targetIndex ? currentIndex : targetIndex,
        );
        return;
      }

      const nearestIndex = packageRefs.current.reduce(
        (closestIndex, packageCard, index) => {
          if (!packageCard) return closestIndex;

          const closestCard = packageRefs.current[closestIndex];
          if (!closestCard) return index;

          return Math.abs(packageCard.offsetLeft - (carousel.scrollLeft + scrollInset)) <
            Math.abs(closestCard.offsetLeft - (carousel.scrollLeft + scrollInset))
            ? index
            : closestIndex;
        },
        0,
      );
      setActiveIndex((currentIndex) =>
        currentIndex === nearestIndex ? currentIndex : nearestIndex,
      );
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
      const scrollInset = carousel.clientWidth < 640 ? 32 : 0;
      programmaticTarget.current = activeIndex;
      carousel.scrollTo({
        left: Math.max(0, packageCard.offsetLeft - scrollInset),
        behavior: "smooth",
      });
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        programmaticTarget.current = null;
      }, 700);
    }

    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [activeIndex]);

  function moveToPackage(index: number) {
    const nextIndex = Math.max(0, Math.min(index, packageTiers.length - 1));
    programmaticTarget.current = nextIndex;
    setActiveIndex(nextIndex);
  }

  function moveBy(offset: number) {
    setActiveIndex((currentIndex) => {
      const nextIndex = Math.max(
        0,
        Math.min(currentIndex + offset, packageTiers.length - 1),
      );
      programmaticTarget.current = nextIndex;
      return nextIndex;
    });
  }

  return (
    <div className="relative">
      <div className="relative">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Previous package"
          onClick={() => moveBy(-1)}
          disabled={activeIndex === 0}
          title="Previous package"
          className="absolute top-28 left-3 z-20 size-10 -translate-y-1/2 rounded-full border border-primary/20 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_10%),color-mix(in_oklab,var(--background)_82%,black))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_20px_rgb(0_0_0/0.24)] backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgb(0_0_0/0.26),0_0_16px_color-mix(in_oklab,var(--primary)_14%,transparent)] disabled:opacity-45"
        >
          <span aria-hidden="true">←</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Next package"
          onClick={() => moveBy(1)}
          disabled={activeIndex === packageTiers.length - 1}
          title="Next package"
          className="absolute top-28 right-3 z-20 size-10 -translate-y-1/2 rounded-full border border-primary/20 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_10%),color-mix(in_oklab,var(--background)_82%,black))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_20px_rgb(0_0_0/0.24)] backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgb(0_0_0/0.26),0_0_16px_color-mix(in_oklab,var(--primary)_14%,transparent)] disabled:opacity-45"
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
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-4 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-0 sm:scroll-px-0"
        >
          {packageTiers.map((pkg, index) => (
            <div
              key={pkg.slug}
              ref={(element) => {
                packageRefs.current[index] = element;
              }}
              className="min-w-[calc(100%-2rem)] snap-center sm:snap-start sm:min-w-[calc((100%-1rem)/2)] lg:min-w-[calc((100%-2rem)/3)]"
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
