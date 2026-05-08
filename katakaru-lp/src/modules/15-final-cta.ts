import { finalCta, storeInfo, corporateInfo, env, legalLinks } from '../data/content';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { trackCta, trackPhoneTap, trackSectionView } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderFinalCta(): HTMLElement {
  const wrap = document.createDocumentFragment();

  const section = document.createElement('section');
  section.id = 'final-cta';
  section.className = 'section-final-cta';
  section.setAttribute('aria-labelledby', 'final-cta-heading');

  section.innerHTML = `
    <div class="final-cta-content">
      <h2 id="final-cta-heading" class="section-heading" data-final-heading>
        ${escapeHtml(finalCta.heading)}
      </h2>
      <p class="final-cta-body" data-final-body>${escapeHtml(finalCta.body)}</p>

      <div class="final-cta-buttons" data-final-buttons>
        <a
          href="${env.bookingUrl30}"
          target="_blank"
          rel="noopener"
          class="final-cta-primary"
          data-cta="final-30"
          aria-label="${escapeHtml(finalCta.ctaPrimary)}(30分コース・Andy予約システムで開きます)"
        >${escapeHtml(finalCta.ctaPrimary)}</a>

        <a
          href="${env.bookingUrl20}"
          target="_blank"
          rel="noopener"
          class="final-cta-secondary"
          data-cta="final-20"
          aria-label="${escapeHtml(finalCta.ctaSecondary)}(20分コース・Andy予約システムで開きます)"
        >${escapeHtml(finalCta.ctaSecondary)}</a>

        <a
          href="tel:${escapeHtml(env.phone)}"
          class="final-cta-tertiary"
          data-cta="final-tel"
          aria-label="店舗に電話して予約"
        >${escapeHtml(finalCta.ctaTertiary)}</a>
      </div>
    </div>
  `;

  wrap.appendChild(section);

  // Slim site footer: brand + minimal store info + legal links + copyright only
  const footerEl = document.createElement('footer');
  footerEl.className = 'site-footer';
  footerEl.setAttribute('role', 'contentinfo');

  footerEl.innerHTML = `
    <div class="footer-container">
      <div class="footer-brand-section">
        <img
          src="/images/logo-momikaru.png"
          alt="もみかる"
          class="footer-logo"
          loading="lazy"
          decoding="async"
          width="220"
          height="auto"
        />
        <p class="footer-store-name">総本店</p>
      </div>

      <dl class="footer-store-info">
        <div class="store-info-item">
          <dt class="info-label">住所</dt>
          <dd class="info-value">${escapeHtml(storeInfo.address)}</dd>
        </div>

        <div class="store-info-item">
          <dt class="info-label">営業時間</dt>
          <dd class="info-value">${escapeHtml(storeInfo.hours)}</dd>
        </div>
      </dl>

      <nav class="footer-legal-links" aria-label="法務リンク">
        <a
          href="${escapeHtml(legalLinks.privacyPolicyUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="legal-link"
          aria-label="プライバシーポリシー(別タブで開きます)"
        >プライバシーポリシー</a>
        <span class="separator" aria-hidden="true">|</span>
        <a
          href="${escapeHtml(legalLinks.termsOfServiceUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="legal-link"
          aria-label="特定商取引法に基づく表記(別タブで開きます)"
        >特定商取引法に基づく表記</a>
      </nav>

      <div class="footer-copyright">
        <p class="footer-copy">© ${corporateInfo.copyrightYear} ${escapeHtml(corporateInfo.legalName)}</p>
      </div>
    </div>
  `;
  wrap.appendChild(footerEl);

  // Wrap fragment into a wrapper so the bootstrap can append a single Element.
  // Caller will append children of the wrapper if needed; here we return the section
  // and rely on the bootstrap to append the footer separately. To keep the API simple,
  // we attach a property to find the footer.
  (section as HTMLElement & { footerNode?: HTMLElement }).footerNode = footerEl;
  return section;
}

export function initFinalCta(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heading = section.querySelector('[data-final-heading]');
  const body = section.querySelector('[data-final-body]');
  const buttons = section.querySelector('[data-final-buttons]');

  // CTA tracking
  section.querySelectorAll<HTMLAnchorElement>('a[data-cta="final-30"]').forEach((el) =>
    el.addEventListener('click', () =>
      trackCta('final_30', { plan: '30', position: 'final' }),
    ),
  );
  section.querySelectorAll<HTMLAnchorElement>('a[data-cta="final-20"]').forEach((el) =>
    el.addEventListener('click', () =>
      trackCta('final_20', { plan: '20', position: 'final' }),
    ),
  );
  section.querySelectorAll<HTMLAnchorElement>('a[data-cta="final-tel"]').forEach((el) =>
    el.addEventListener('click', () => {
      trackPhoneTap('final');
      trackCta('final_tel', { plan: 'tel', position: 'final' });
    }),
  );

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => trackSectionView('final-cta'),
  });

  if (reduced) {
    [heading, body, buttons].forEach((el) => {
      if (el) (el as HTMLElement).style.opacity = '1';
    });
    return;
  }

  if (heading) {
    gsap.from(heading, {
      autoAlpha: 0,
      y: 26,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
    });
  }
  if (body) {
    gsap.from(body, {
      autoAlpha: 0,
      y: 18,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.1,
      scrollTrigger: { trigger: body, start: 'top 85%', once: true },
    });
  }
  if (buttons) {
    gsap.from(buttons.children, {
      autoAlpha: 0,
      y: 14,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: buttons, start: 'top 90%', once: true },
    });
  }
}
