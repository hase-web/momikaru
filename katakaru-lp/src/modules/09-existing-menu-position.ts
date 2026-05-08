import { existingMenuPosition } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function emphasizeFirst(text: string, target: string): string {
  const idx = text.indexOf(target);
  if (idx < 0) return text;
  return (
    text.slice(0, idx) +
    `<strong>${target}</strong>` +
    text.slice(idx + target.length)
  );
}

export function renderExistingMenuPosition(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'existing-menu-position';
  section.className = 'section section-existing';
  section.setAttribute('aria-labelledby', 'existing-heading');

  const introText = existingMenuPosition.paragraphs[0] ?? '';
  let introHtml = escapeHtml(introText);
  introHtml = emphasizeFirst(
    introHtml,
    escapeHtml(existingMenuPosition.paragraphsHighlight),
  );

  const renderList = (items: readonly string[]) =>
    items.map((it) => `<li>${escapeHtml(it)}</li>`).join('');

  // Split title into prefix ("こんな日に") + main ("「かたかる」" / "「全身もみほぐし」")
  const prefix = 'こんな日に';
  const splitTitle = (full: string): { pfx: string; main: string } => {
    if (full.startsWith(prefix)) return { pfx: prefix, main: full.slice(prefix.length) };
    return { pfx: '', main: full };
  };
  const k = splitTitle(existingMenuPosition.katakaruDays.title);
  const f = splitTitle(existingMenuPosition.fullBodyDays.title);

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="existing-heading" class="section-heading" data-existing-heading>
        ${escapeHtml(existingMenuPosition.heading)}
      </h2>
      <p class="existing-intro" data-existing-intro>${introHtml}</p>

      <ul class="existing-grid">
        <li class="existing-card" data-existing-card>
          <span class="card-title-prefix">${escapeHtml(k.pfx)}</span>
          <h3 class="card-title">${escapeHtml(k.main)}</h3>
          <ul>
            ${renderList(existingMenuPosition.katakaruDays.items)}
          </ul>
        </li>
        <li class="existing-card" data-existing-card>
          <span class="card-title-prefix">${escapeHtml(f.pfx)}</span>
          <h3 class="card-title">${escapeHtml(f.main)}</h3>
          <ul>
            ${renderList(existingMenuPosition.fullBodyDays.items)}
          </ul>
        </li>
      </ul>

      <p class="existing-closing" data-existing-closing>
        ${escapeHtml(existingMenuPosition.closing)}
      </p>
    </div>
  `;

  return section;
}

export function initExistingMenuPosition(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-existing-heading]');
  const intro = section.querySelector('[data-existing-intro]');
  const cards = section.querySelectorAll<HTMLElement>('[data-existing-card]');
  const closing = section.querySelector('[data-existing-closing]');

  if (reduced) {
    [heading, intro, closing].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    cards.forEach((c) => (c.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('existing-menu-position'),
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
  if (intro) {
    gsap.from(intro, {
      autoAlpha: 0,
      y: 16,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.1,
      scrollTrigger: { trigger: intro, start: 'top 85%', once: true },
    });
  }
  if (cards.length) {
    gsap.from(cards, {
      autoAlpha: 0,
      y: 24,
      duration: 0.65,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: { trigger: cards[0], start: 'top 85%', once: true },
    });
  }
  if (closing) {
    gsap.from(closing, {
      autoAlpha: 0,
      y: 16,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: closing, start: 'top 90%', once: true },
    });
  }
}
