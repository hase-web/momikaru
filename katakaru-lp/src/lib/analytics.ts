declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type CtaContext = {
  plan?: '30' | '20' | 'tel' | 'other';
  position: string;
};

function push(event: Record<string, unknown>): void {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(event);
}

export function trackCta(label: string, ctx: CtaContext): void {
  push({
    event: 'cta_click',
    cta_label: label,
    cta_plan: ctx.plan ?? 'other',
    cta_position: ctx.position,
  });
}

export function trackPhoneTap(position: string): void {
  push({ event: 'phone_tap', cta_position: position });
}

export function trackFaqToggle(question: string, opened: boolean): void {
  push({ event: 'faq_toggle', question, opened });
}

export function trackSectionView(sectionId: string): void {
  push({ event: 'section_view', section_id: sectionId });
}

export function trackScrollDepth(depth: 25 | 50 | 75 | 100): void {
  push({ event: 'scroll_depth', depth });
}

const fired = new Set<number>();
export function initScrollDepthTracking(): void {
  const onScroll = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    const pct = Math.round(scrolled * 100);
    [25, 50, 75, 100].forEach((d) => {
      if (pct >= d && !fired.has(d)) {
        fired.add(d);
        trackScrollDepth(d as 25 | 50 | 75 | 100);
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}
