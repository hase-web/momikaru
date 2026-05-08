import { empathy } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Emotion micro-labels per item — Japanese chat-style empathy.
// All entries verified clean of forbidden U+3084 / U+FF03 characters.
const emotionLabels = [
  'それ、わかる…',
  '確かに…',
  'そう、それ',
  'うんうん…',
  'ほんとそれ',
  'あるある…',
];

const frownIcon = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
    <line x1="9" x2="9.01" y1="9" y2="9"/>
    <line x1="15" x2="15.01" y1="9" y2="9"/>
  </svg>
`;

function renderHeading(heading: string): string {
  // 「もみほぐしに通って、こんな経験はありませんか?」 → break after 「、」 always
  const idx = heading.indexOf('、');
  if (idx < 0) return escapeHtml(heading);
  return `${escapeHtml(heading.slice(0, idx + 1))}<br />${escapeHtml(heading.slice(idx + 1))}`;
}

export function renderEmpathy(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'empathy';
  section.className = 'section section-empathy';
  section.setAttribute('aria-labelledby', 'empathy-heading');

  const items = empathy.items
    .map((text, i) => {
      const label = emotionLabels[i] ?? emotionLabels[0];
      const side = i % 2 === 0 ? 'left' : 'right';
      return `
        <li class="empathy-item" data-empathy-item data-side="${side}">
          <div class="item-head">
            <span class="icon" aria-hidden="true">${frownIcon}</span>
            <span class="emotion-label">${escapeHtml(label)}</span>
          </div>
          <p>${escapeHtml(text)}</p>
        </li>
      `;
    })
    .join('');

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="empathy-heading" class="section-heading" data-empathy-heading>
        ${renderHeading(empathy.heading)}
      </h2>
      <p class="section-lead" data-empathy-lead>${escapeHtml(empathy.lead)}</p>
    </div>

    <div class="container-wide">
      <ul class="empathy-list">
        ${items}
      </ul>
    </div>
  `;

  return section;
}

export function initEmpathy(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-empathy-heading]');
  const lead = section.querySelector('[data-empathy-lead]');
  const items = section.querySelectorAll<HTMLElement>('[data-empathy-item]');

  if (reduced) {
    [heading, lead].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    items.forEach((it) => (it.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('empathy'),
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
  items.forEach((item, i) => {
    const fromX = item.dataset.side === 'right' ? 28 : -28;
    gsap.from(item, {
      autoAlpha: 0,
      x: fromX,
      y: 8,
      duration: 0.55,
      ease: 'power3.out',
      delay: i * 0.08,
      scrollTrigger: { trigger: item, start: 'top 88%', once: true },
    });
  });
}
