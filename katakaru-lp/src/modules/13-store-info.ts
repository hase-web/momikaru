import { stores, storesSection, storeRegions, env } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackCta, trackPhoneTap, trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderStoreInfo(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'store-info';
  section.className = 'section section-stores';
  section.setAttribute('aria-labelledby', 'stores-heading');

  const tabsHtml = storeRegions
    .map(
      (r, i) => `
        <button
          type="button"
          class="region-tab${i === 0 ? ' active' : ''}"
          data-region-tab
          data-region="${escapeHtml(r)}"
          aria-pressed="${i === 0 ? 'true' : 'false'}"
        >${escapeHtml(r)}</button>
      `,
    )
    .join('');

  // Pre-render all stores; module shows/hides via dataset filter.
  const storesHtml = stores
    .map(
      (s) => `
        <li class="store-card" data-store-card data-store-region="${escapeHtml(s.region)}">
          <h3 class="store-name">${escapeHtml(s.name)}</h3>
          <p class="store-address">${escapeHtml(s.address)}</p>
          <div class="store-actions">
            <a
              href="tel:${escapeHtml(s.phone)}"
              class="store-action phone"
              data-cta="store-tel"
              aria-label="${escapeHtml(s.name)}に電話で予約"
            >電話</a>
            <a
              href="${escapeHtml(s.bookingUrl)}"
              target="_blank"
              rel="noopener"
              class="store-action web"
              data-cta="store-web"
              aria-label="${escapeHtml(s.name)}をWEB予約"
            >WEB予約</a>
          </div>
        </li>
      `,
    )
    .join('');

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="stores-heading" class="section-heading" data-stores-heading>
        ${escapeHtml(storesSection.heading)}
      </h2>
      <p class="section-lead" data-stores-lead>${escapeHtml(storesSection.lead)}</p>
    </div>

    <div class="container-wide">
      <div class="region-tabs" role="tablist" aria-label="地域選択">
        ${tabsHtml}
      </div>
      <ul class="stores-grid" data-stores-grid>${storesHtml}</ul>
    </div>
  `;

  return section;
}

export function initStoreInfo(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-stores-heading]');
  const lead = section.querySelector('[data-stores-lead]');
  const tabs = section.querySelectorAll<HTMLButtonElement>('[data-region-tab]');
  const cards = section.querySelectorAll<HTMLElement>('[data-store-card]');

  function applyFilter(region: string): void {
    cards.forEach((c) => {
      const match = c.dataset.storeRegion === region;
      c.style.display = match ? '' : 'none';
    });
    tabs.forEach((t) => {
      const isActive = t.dataset.region === region;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // Initialize filter to first region
  if (tabs.length > 0) {
    const first = tabs[0].dataset.region ?? '';
    applyFilter(first);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const r = tab.dataset.region ?? '';
      applyFilter(r);
      trackCta(`store_region_${r}`, { plan: 'other', position: 'stores' });
    });
  });

  // CTA tracking
  cards.forEach((card) => {
    const tel = card.querySelector<HTMLAnchorElement>('a[data-cta="store-tel"]');
    const web = card.querySelector<HTMLAnchorElement>('a[data-cta="store-web"]');
    if (tel) {
      tel.addEventListener('click', () => {
        trackPhoneTap('stores');
        trackCta('store_tel', { plan: 'tel', position: 'stores' });
      });
    }
    if (web) {
      web.addEventListener('click', () =>
        trackCta('store_web', { plan: '30', position: 'stores' }),
      );
    }
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('store-info'),
  });

  if (reduced) {
    [heading, lead].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    return;
  }

  if (heading) {
    gsap.from(heading, {
      autoAlpha: 0,
      y: 24,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
    });
  }
  if (lead) {
    gsap.from(lead, {
      autoAlpha: 0,
      y: 16,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.1,
      scrollTrigger: { trigger: lead, start: 'top 85%', once: true },
    });
  }
  // Touch env to silence env unused warning if any
  void env;
}
