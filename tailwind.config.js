/** InfuMedz website — Tailwind config.
 *
 *  Every colour below is lifted verbatim from the Flutter app's
 *  lib/app/theme/app_colors.dart so the website and the app are the same
 *  brand. Nothing here is a new colour; the web-specific work is in
 *  layout, type scale and density, not palette.
 */
module.exports = {
  content: ['./*.html', './admin/*.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // ── Brand (app_colors.dart) ──
        primary: {
          DEFAULT: '#0E5FD8',   // AppColors.primary
          dark:    '#0057C1',   // AppColors.primaryDark
          light:   '#3B82F6',   // primaryGradient end
        },
        navy:   '#1F3C68',      // AppColors.navy
        indigo: '#4F46E5',      // heroGradient start
        cyan:   '#06B6D4',      // heroGradient end

        // ── Surfaces ──
        canvas: '#F6F7FB',      // AppColors.background
        line:   '#E2E8F0',      // AppColors.border
        chip:   '#EAF3FF',      // AppColors.chipBackground

        // ── Text ──
        ink: {
          DEFAULT: '#1E1E1E',   // AppColors.textPrimary
          soft:    '#4B5563',   // web-tuned stand-in for black54
          muted:   '#6B7280',   // web-tuned stand-in for black45
        },

        // ── Status ──
        ok:   '#16A34A',        // AppColors.success
        free: '#00D68F',        // AppColors.freeBadge
        warn: '#F59E0B',
        bad:  '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #0E5FD8 0%, #3B82F6 100%)',
        'hero-grad':  'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06)',
        lift: '0 8px 24px rgba(16,24,40,.10)',
        nav:  '0 1px 0 rgba(226,232,240,1)',
      },
      maxWidth: { shell: '1280px' },
      borderRadius: { xl2: '14px' },
    },
  },
  plugins: [],
};
