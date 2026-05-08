import { pricing, env } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackCta, trackSectionView } from '../lib/analytics';

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

export function renderPricing(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'pricing';
  section.className = 'section section-pricing';
  section.setAttribute('aria-labelledby', 'pricing-heading');

  let leadHtml = escapeHtml(pricing.lead);
  leadHtml = emphasizeFirst(leadHtml, escapeHtml(pricing.leadHighlight));
  leadHtml = emphasizeFirst(leadHtml, '届く深さが違います');
  // Split into paragraphs on blank lines
  leadHtml = leadHtml
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join('</p><p class="section-lead" data-pricing-lead>');

  const cardsHtml = pricing.plans
    .map((plan) => {
      const isPrimary = plan.isPrimary;
      const cardClass = isPrimary
        ? 'pricing-card pricing-card--primary'
        : 'pricing-card pricing-card--secondary';
      const url = isPrimary ? env.bookingUrl30 : env.bookingUrl20;
      const badgeHtml = isPrimary
        ? `<span class="recommend-badge" aria-hidden="true">${escapeHtml(plan.badge)}</span>`
        : `<span class="secondary-badge">${escapeHtml(plan.badge)}</span>`;
      return `
        <li class="${cardClass}" data-pricing-card data-plan="${plan.id}">
          ${badgeHtml}
          <div class="duration-line">
            <span class="duration">${escapeHtml(plan.duration)}</span>
            <span class="price">${escapeHtml(plan.price)}</span>
          </div>
          <dl class="spec-list">
            <div><dt>施術範囲</dt><dd>${escapeHtml(plan.area)}</dd></div>
            <div><dt>届く深さ</dt><dd>${escapeHtml(plan.depth)}</dd></div>
            <div><dt>アプローチ</dt><dd>${escapeHtml(plan.approach)}</dd></div>
            <div><dt>こんな日に</dt><dd>${escapeHtml(plan.use)}</dd></div>
            <div><dt>1分あたり</dt><dd>${escapeHtml(plan.perMinute)}</dd></div>
          </dl>
          <a
            href="${url}"
            target="_blank"
            rel="noopener"
            class="pricing-cta"
            data-cta="pricing-${plan.id}"
            aria-label="${escapeHtml(plan.cta)}(${escapeHtml(plan.duration)}コース・Andy予約システムで開きます)"
          >
            <span>${escapeHtml(plan.cta)}</span>
          </a>
        </li>
      `;
    })
    .join('');

  const rec = pricing.recommendation;
  let recBody = escapeHtml(rec.body);
  recBody = emphasizeFirst(recBody, escapeHtml(rec.highlight));

  section.innerHTML = `
    <div class="container-narrow">
      <h2 id="pricing-heading" class="section-heading" data-pricing-heading>
        ${escapeHtml(pricing.heading)}
      </h2>
      <p class="section-lead" data-pricing-lead>${leadHtml}</p>
    </div>
    <div class="container-wide">
      <ul class="pricing-grid">${cardsHtml}</ul>
    </div>
    <div class="container-narrow">
      <div class="pricing-recommendation" data-pricing-rec>
        <h3>${escapeHtml(rec.heading)}</h3>
        <p>${recBody}</p>
      </div>
    </div>
  `;

  return section;
}

export function initPricing(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-pricing-heading]');
  const lead = section.querySelector('[data-pricing-lead]');
  const cards = section.querySelectorAll<HTMLElement>('[data-pricing-card]');
  const rec = section.querySelector('[data-pricing-rec]');

  // CTA tracking
  cards.forEach((card) => {
    const cta = card.querySelector<HTMLAnchorElement>('a[data-cta]');
    if (!cta) return;
    const plan = card.dataset.plan === '20' ? '20' : '30';
    cta.addEventListener('click', () =>
      trackCta(`pricing_${plan}`, { plan, position: 'pricing' }),
    );
  });

  if (reduced) {
    [heading, lead, rec].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    cards.forEach((c) => (c.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('pricing'),
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
      y: 28,
      scale: 0.97,
      duration: 0.7,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: { trigger: cards[0], start: 'top 80%', once: true },
    });
  }
  if (rec) {
    gsap.from(rec, {
      autoAlpha: 0,
      y: 24,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: { trigger: rec, start: 'top 85%', once: true },
    });
  }
}
