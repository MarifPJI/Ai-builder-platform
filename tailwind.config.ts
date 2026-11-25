import type { Config } from 'tailwindcss';

// Palet STEM Capacity Building 2026 (Apple HIG × Prestasi Junior Indonesia × AWS).
// Token diturunkan dari .kiro/steering/apple-ui.md dan
// docs/ui-reference/APPLE_LMS_UI_DESIGN_SPEC.md.
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primer — STEM Berry Magenta (CTA pill & status aktif utama).
        primary: {
          DEFAULT: '#CB3480',
          hover: '#B5286F',
          soft: '#FCEBF3',
        },
        // STEM Ocean Teal (focus ring, tautan, tombol sekunder).
        teal: {
          DEFAULT: '#0181B2',
          soft: '#E6F4F8',
          sky: '#2AD4E8',
        },
        // STEM Cosmic Indigo (identitas brand & permukaan kamera).
        indigo: {
          DEFAULT: '#21245B',
          soft: '#ECEEF8',
        },
        // Permukaan bersih Apple UI.
        canvas: '#F4F5F9',
        soft: '#F8F9FC',
        line: '#E2E6F0',
        ink: '#181A33',
        muted: '#5E6478',
        // Warna semantik status presensi/akun.
        hadir: { DEFAULT: '#158058', soft: '#E7F6F0' },
        sakit: { DEFAULT: '#0181B2', soft: '#E6F4F8' },
        izin: { DEFAULT: '#A76A00', soft: '#FEF4E2' },
        alfa: { DEFAULT: '#C43D37', soft: '#FCECEB' },

        // Alias ringkas (kompatibel pemakaian sebelumnya).
        stem: {
          magenta: '#CB3480',
          biru: '#0181B2',
          navy: '#21245B',
        },
      },
      borderRadius: {
        card: '18px',
      },
      backgroundImage: {
        'hero-grad':
          'linear-gradient(135deg, #732B6D 0%, #21245B 52%, #0181B2 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
