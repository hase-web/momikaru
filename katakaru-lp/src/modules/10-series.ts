import { series } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function bolds(text: string, targets: string[]): string {
  let result = text;
  for (const t of targets) {
    const idx = result.indexOf(t);
    if (idx < 0) continue;
    result = result.slice(0, idx) + `<strong>${t}</strong>` + result.slice(idx + t.length);
  }
  return result;
}

// Lucide-inspired icons per body region.
const seriesIcons: string[] = [
  // 1. かたかる(肩・首) — head + shoulders
  `<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0"/>`,
  // 2. こしかる(腰) — torso with waist marker
  `<rect x="6.5" y="3.5" width="11" height="17" rx="2.4"/><line x1="6.5" y1="11.5" x2="17.5" y2="11.5" stroke-width="2.4"/>`,
  // 3. あしかる(脚) — Footprints (Lucide)
  `<path d="M4 16v-2.4C4 11.5 2.97 10.5 3 8c.03-2.7 1.5-6 4.5-6 1.87 0 2.5 1.8 2.5 3.5 0 3.1-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.4c0-2.1 1.03-3.1 1-5.6-.03-2.7-1.5-6-4.5-6-1.87 0-2.5 1.8-2.5 3.5 0 3.1 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>`,
  // 4. せなかる(背中) — spine column
  `<line x1="12" y1="3" x2="12" y2="21"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="16" x2="16" y2="16"/>`,
];

export function renderSeries(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'series';
  section.className = 'section section-series';
  section.setAttribute('aria-labelledby', 'series-heading');

  const cardsHtml = series.items
    .map((item, i) => {
      const cls = item.isCurrent ? 'series-card is-current' : 'series-card';
      const iconPath = seriesIcons[i] ?? seriesIcons[0];
      const badge = item.isCurrent
        ? `<span class="here-badge" aria-label="現在のメニュー">いま、ここ</span>`
        : '';
      return `
        <li class="${cls}" data-series-card>
          ${badge}
          <span class="menu-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
          </span>
          <p class="name">${escapeHtml(item.name)}</p>
          <p class="area">(${escapeHtml(item.area)})</p>
          <p class="tags">${escapeHtml(item.tags)}</p>
        </li>
      `;
    })
    .join('');

  let comboBody = escapeHtml(series.combo.body);
  comboBody = bolds(comboBody, [
    '「かたかる + せなかる」',
    '「こしかる + あしかる」',
    '「全身もみほぐし」',
  ]);

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="series-heading" class="section-heading" data-series-heading>
        ${escapeHtml(series.heading)}
      </h2>
      <p class="section-lead" data-series-lead>${escapeHtml(series.lead)}</p>
    </div>

    <div class="container-wide">
      <ul class="series-grid">
        ${cardsHtml}
      </ul>
    </div>

    <div class="container-narrow">
      <div class="series-combo" data-series-combo>
        <h3>${escapeHtml(series.combo.heading)}</h3>
        <p>${comboBody}</p>
      </div>
    </div>
  `;

  return section;
}

export function initSeries(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-series-heading]');
  const lead = section.querySelector('[data-series-lead]');
  const cards = section.querySelectorAll<HTMLElement>('[data-series-card]');
  const combo = section.querySelector('[data-series-combo]');

  if (reduced) {
    [heading, lead, combo].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    cards.forEach((c) => (c.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('series'),
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
  if (cards.length) {
    gsap.from(cards, {
      autoAlpha: 0,
      y: 22,
      scale: 0.97,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: cards[0], start: 'top 85%', once: true },
    });
  }
  if (combo) {
    gsap.from(combo, {
      autoAlpha: 0,
      y: 24,
      scale: 0.98,
      duration: 0.75,
      ease: 'power3.out',
      scrollTrigger: { trigger: combo, start: 'top 85%', once: true },
    });
  }
}
