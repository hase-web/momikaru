import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,js,html}'],
  theme: {
    extend: {
      colors: {
        'main-blue': '#4A90E2',
        'deep-blue': '#2B5BA8',
        'accent-pink': '#F5C2D6',
        'hot-pink': '#E94B7C',
        'dark-navy': '#1A2B4A',
        'soft-white': '#FAFBFD',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['"Zen Kaku Gothic New"', '"Noto Sans JP"', 'sans-serif'],
      },
      fontSize: {
        'hero': ['clamp(3rem, 14vw, 7rem)', { lineHeight: '1.05', fontWeight: '900' }],
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #C9E5FF 0%, #FFD8E8 55%, #FFF1B8 100%)',
        'cta-shimmer':
          'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'feather-drift': {
          '0%': { transform: 'translateY(-8%) rotate(-4deg)' },
          '50%': { transform: 'translateY(2%) rotate(4deg)' },
          '100%': { transform: 'translateY(-8%) rotate(-4deg)' },
        },
        'soft-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 4s linear infinite',
        'feather-drift': 'feather-drift 9s ease-in-out infinite',
        'soft-bounce': 'soft-bounce 2.4s ease-in-out infinite',
      },
      boxShadow: {
        'cta': '0 10px 28px -10px rgba(233, 75, 124, 0.45), 0 4px 10px -4px rgba(43, 91, 168, 0.18)',
        'card': '0 18px 40px -24px rgba(26, 43, 74, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
