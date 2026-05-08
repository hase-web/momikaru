import { stolenThings } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Per-card icons. Color/background are driven by nth-child in CSS (dusty palette).
const cardIcons: string[] = [
  // 1. Briefcase
  `<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>`,
  // 2. Moon
  `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
  // 3. Heart
  `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>`,
  // 4. User circle
  `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66a8 8 0 0 1 10 0"/>`,
];

function splitHeadingForMobile(heading: string): string {
  const idx = heading.indexOf('、');
  if (idx < 0) return escapeHtml(heading);
  const before = heading.slice(0, idx + 1);
  const after = heading.slice(idx + 1);
  return `${escapeHtml(before)}<br class="md:hidden" />${escapeHtml(after)}`;
}

function splitClosing(full: string, highlight: string): string {
  const idx = full.indexOf(highlight);
  if (idx < 0) return escapeHtml(full);
  const before = full.slice(0, idx);
  const after = full.slice(idx + highlight.length);
  return `${escapeHtml(before)}<br /><strong>${escapeHtml(highlight)}</strong><br />${escapeHtml(after)}`;
}

export function renderStolenThings(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'stolen-things';
  section.className = 'section section-stolen-things';
  section.setAttribute('aria-labelledby', 'stolen-things-heading');

  const cardsHtml = stolenThings.items
    .map((item, i) => {
      const iconPath = cardIcons[i] ?? cardIcons[0];
      const num = String(item.index).padStart(2, '0');
      return `
        <li class="stolen-card" data-stolen-card>
          <span class="accent-bar" data-stolen-bar aria-hidden="true"></span>
          <span class="number" data-stolen-number aria-hidden="true">${num}</span>
          <div class="card-head">
            <span class="card-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
            </span>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
          </div>
          <p class="card-body">${escapeHtml(item.body)}</p>
        </li>
      `;
    })
    .join('');

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="stolen-things-heading" class="section-heading section-heading--keep" data-stolen-heading>
        ${splitHeadingForMobile(stolenThings.heading)}
      </h2>
      <p class="section-lead" data-stolen-lead>${escapeHtml(stolenThings.lead)}</p>
    </div>

    <div class="container-wide">
      <ul class="stolen-grid grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7 lg:gap-8 list-none p-0 m-0">
        ${cardsHtml}
      </ul>
    </div>

    <div class="container-narrow">
      <div class="closing-warning" role="note" data-stolen-closing>
        <p>${splitClosing(stolenThings.closing, stolenThings.closingHighlight)}</p>
      </div>
    </div>
  `;

  return section;
}

export function initStolenThings(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-stolen-heading]');
  const lead = section.querySelector('[data-stolen-lead]');
  const cards = section.querySelectorAll<HTMLElement>('[data-stolen-card]');
  const closing = section.querySelector('[data-stolen-closing]');

  if (reduced) {
    [heading, lead, closing].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    cards.forEach((c) => {
      c.style.opacity = '1';
      const bar = c.querySelector<HTMLElement>('[data-stolen-bar]');
      if (bar) bar.style.transform = 'scaleY(1)';
    });
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('stolen-things'),
  });

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

  cards.forEach((card) => {
    const bar = card.querySelector<HTMLElement>('[data-stolen-bar]');
    const num = card.querySelector<HTMLElement>('[data-stolen-number]');
    if (bar) gsap.set(bar, { scaleY: 0, transformOrigin: 'top center' });
    if (num) gsap.set(num, { autoAlpha: 0 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: card, start: 'top 88%', once: true },
    });
    tl.from(card, { y: 36, autoAlpha: 0, duration: 0.7, ease: 'power3.out' });
    if (bar) tl.to(bar, { scaleY: 1, duration: 0.6, ease: 'power2.out' }, 0.15);
    if (num) tl.to(num, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.3);
  });

  if (closing) {
    gsap.from(closing, {
      autoAlpha: 0,
      y: 24,
      scale: 0.97,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: closing, start: 'top 85%', once: true },
    });
  }
}
