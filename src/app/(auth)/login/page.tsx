import { BrandMark } from '@/components/shared/BrandMark';
import { BrandMascot } from '@/components/shared/BrandMascot';
import { LoginForm } from './LoginForm';

// Existing server-action authentication requires dynamic rendering.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="AI Builder STEM Capacity Building">
        <div className="auth-brand"><BrandMark /><span>AI Builder</span><sup>®</sup></div>
        <div className="auth-story-copy">
          <span className="auth-kicker"><span /> STEM CAPACITY BUILDING 2026</span>
          <h2>Ide hari ini.<br />Inovasi<br /><em>masa depan.</em></h2>
          <p>Ruang untuk belajar, bereksperimen, dan membangun dampak bersama.</p>
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-orbit" /><BrandMark className="auth-spark" />
          <span className="auth-sticker">LET’S BUILD<br />SOMETHING GREAT.</span>
          <BrandMascot />
          <span className="auth-floating-label">Imajinasi jadi inovasi. ↗</span>
        </div>
        <div className="auth-partners">Prestasi Junior Indonesia <span>×</span> AWS</div>
      </section>
      <section className="auth-panel" aria-label="Masuk platform pembelajaran">
        <a href="https://awsinstem.id" className="auth-home"><span aria-hidden="true">↖</span> Kembali ke Beranda</a>
        <div className="auth-form-wrap">
          <div className="auth-form-mark" aria-hidden="true"><BrandMark /></div>
          <span className="auth-form-eyebrow">SELAMAT DATANG KEMBALI</span>
          <LoginForm />
          <p className="auth-program-note">Satu ruang untuk kelas, materi,<br />dan perjalanan belajar Anda.</p>
        </div>
        <p className="auth-copyright">© 2026 Prestasi Junior Indonesia</p>
      </section>
    </main>
  );
}
