import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis } from './lenis-setup';

let initialized = false;

export function initGsap(): void {
  if (initialized) return;
  initialized = true;

  gsap.registerPlugin(ScrollTrigger);

  // Sync ScrollTrigger with Lenis (smooth scroll proxy)
  const lenis = getLenis();
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  ScrollTrigger.config({ ignoreMobileResize: true });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    gsap.globalTimeline.timeScale(2.5);
  }
}

export { gsap, ScrollTrigger };
