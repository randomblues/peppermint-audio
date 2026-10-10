"use client";

import { useEffect, useRef } from "react";
import { howItWorks } from "@/lib/site-content";
import styles from "./hire-journey.module.css";

export function HireJourney() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const scenes = Array.from(element.querySelectorAll<HTMLElement>("[data-journey-scene]"));
    const preference = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    let frame = 0;

    function update() {
      frame = 0;
      const height = window.innerHeight;
      for (const scene of scenes) {
        const box = scene.getBoundingClientRect();
        const visible = box.bottom > 0 && box.top < height;
        const travel = Math.max(-1, Math.min(1, (height / 2 - box.top - box.height / 2) / height));
        scene.style.setProperty("--travel", preference?.matches ? "0" : String(travel));
        scene.dataset.active = String(visible && !preference?.matches);
      }
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    preference?.addEventListener("change", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      preference?.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div ref={root} className={styles.journey}>
      {howItWorks.map((stage, index) => {
        return (
          <section key={stage.title} aria-label={stage.title} data-journey-scene data-stage={index} className={styles.scene}>
            <div aria-hidden="true" className={styles.atmosphere} />
            <div className={styles.inner}>
              <div aria-hidden="true" className={styles.visual}>
                <div className={styles.orbit} />
                <div className={styles.core}><span className={styles.number}>{index + 1}</span></div>
              </div>
              <div className={styles.copy}>
                <div aria-hidden="true" className={styles.progress}>
                  {howItWorks.map((item, dot) => <span key={item.title} data-current={dot === index} />)}
                  <span className={styles.stageLabel}>{String(index + 1).padStart(2, "0")} / 03</span>
                </div>
                <h2>{stage.title}</h2>
                <div className={styles.paragraphs}>
                  {stage.detail.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
