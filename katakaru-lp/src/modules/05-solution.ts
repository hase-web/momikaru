import { solution } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lucide-style icons per feature.
const featureIcons: string[] = [
  // 1. Crosshair-style focused lock-in
  `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  // 2. Shield-check
  `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>`,
  // 3. Award
  `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`,
];

export function renderSolution(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'solution';
  section.className = 'section section-solution';
  section.setAttribute('aria-labelledby', 'solution-heading');

  const cardsHtml = solution.features
    .map((feature, i) => {
      const iconPath = featureIcons[i] ?? featureIcons[0];
      const indexLabel = `特長 ${String(feature.index).padStart(2, '0')}`;
      return `
        <li class="solution-card" data-solution-card>
          <span class="card-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
          </span>
          <span class="card-index">${escapeHtml(indexLabel)}</span>
          <h3 class="card-title">${escapeHtml(feature.title)}</h3>
          <p class="card-body">${escapeHtml(feature.body)}</p>
        </li>
      `;
    })
    .join('');

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="solution-heading" class="section-heading" data-solution-heading>
        ${escapeHtml(solution.heading)}
      </h2>
      <p class="section-lead" data-solution-lead>${escapeHtml(solution.lead)}</p>
    </div>

    <div class="container-wide">
      <ul class="solution-grid">
        ${cardsHtml}
      </ul>
    </div>
  `;

  return section;
}

export function initSolution(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-solution-heading]');
  const lead = section.querySelector('[data-solution-lead]');
  const cards = section.querySelectorAll<HTMLElement>('[data-solution-card]');

  if (reduced) {
    [heading, lead].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    cards.forEach((c) => (c.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('solution'),
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
  cards.forEach((card, i) => {
    gsap.from(card, {
      autoAlpha: 0,
      y: 28,
      scale: 0.96,
      duration: 0.65,
      ease: 'power3.out',
      delay: i * 0.12,
      scrollTrigger: { trigger: card, start: 'top 88%', once: true },
    });
  });
}
