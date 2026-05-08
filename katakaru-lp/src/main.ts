import './styles/main.css';

import { featureFlags } from './data/content';
import { initLenis } from './lib/lenis-setup';
import { initGsap } from './lib/gsap-setup';
import { initFeatherLayer } from './lib/lottie-loader';
import { initScrollDepthTracking } from './lib/analytics';

import { renderHero, initHero } from './modules/01-hero';
import { renderStolenThings, initStolenThings } from './modules/02-stolen-things';
import { renderEmpathy, initEmpathy } from './modules/03-empathy';
import { renderSolution, initSolution } from './modules/05-solution';
import { renderPricing, initPricing } from './modules/08-pricing';
import { renderExistingMenuPosition, initExistingMenuPosition } from './modules/09-existing-menu-position';
import { renderSeries, initSeries } from './modules/10-series';
import { renderStoreInfo, initStoreInfo } from './modules/13-store-info';
import { renderFinalCta, initFinalCta } from './modules/15-final-cta';
import { renderStickyCta, initStickyCta } from './modules/sticky-cta';

function boot() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Smooth scroll first, GSAP must register after Lenis exists.
  initLenis();
  initGsap();
  initFeatherLayer();
  initScrollDepthTracking();

  const hero = renderHero();
  main.appendChild(hero);
  initHero(hero);

  const stolen = renderStolenThings();
  main.appendChild(stolen);
  initStolenThings(stolen);

  const empathy = renderEmpathy();
  main.appendChild(empathy);
  initEmpathy(empathy);

  const solution = renderSolution();
  main.appendChild(solution);
  initSolution(solution);

  const pricing = renderPricing();
  main.appendChild(pricing);
  initPricing(pricing);

  const existing = renderExistingMenuPosition();
  main.appendChild(existing);
  initExistingMenuPosition(existing);

  const seriesEl = renderSeries();
  main.appendChild(seriesEl);
  initSeries(seriesEl);

  if (featureFlags.showStoreLocations) {
    const storeInfo = renderStoreInfo();
    main.appendChild(storeInfo);
    initStoreInfo(storeInfo);
  }

  const finalCta = renderFinalCta();
  main.appendChild(finalCta);
  // Final CTA module attaches its <footer> as a sibling node via .footerNode
  const footerNode = (finalCta as HTMLElement & { footerNode?: HTMLElement }).footerNode;
  if (footerNode) main.appendChild(footerNode);
  initFinalCta(finalCta);

  const stickyBar = renderStickyCta();
  initStickyCta(stickyBar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
