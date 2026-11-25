import Image from 'next/image';
import type { ReactNode } from 'react';

import awsLogo from './home-assets/aws.png';
import footerLogo from './home-assets/ai-builder-footer.png';
import pjiLogo from './home-assets/prestasi-junior-indonesia.png';
import { activities, competitionStages, faqs, featuredProjects, LMS_URL, PROGRAM_EMAIL } from './home-content';
import { HomeIcon, HomeSpark } from './HomeIcons';
import {
  CurriculumTabs,
  FeaturedProjectCarousel,
  FooterRobot,
  HeroSlideshow,
  HomeNavigation,
  ProgramImpact,
} from './HomeInteractions';

type HomeSlots = {
  showcase: ReactNode;
  gallery: ReactNode;
  submission: ReactNode;
};

function Hero() {
  return (
    <header id="beranda" className="home-hero">
      <div className="home-container home-hero-layout">
        <div className="home-hero-copy">
          <h1>
            STEM<br />CAPACITY<br />
            <span>
              BUILDING
              <svg aria-hidden="true" viewBox="0 0 300 28" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeLinecap="round">
                <path d="M4 8C80 4 200 3 296 8" strokeWidth="4" />
                <path d="M60 20C130 15 200 14 250 18" strokeWidth="3" />
              </svg>
            </span>
          </h1>
          <p className="home-hero-tagline">AI Builder: From Literacy to Real-World Solutions</p>
          <p className="home-hero-description">
            Program peningkatan literasi AI dan keterampilan digital guru dan siswa SMA/SMK di Indonesia.
            Peserta belajar memahami AI dan etikanya, mengembangkan aplikasi dengan AI, dan menciptakan
            solusi nyata untuk mengatasi masalah di sekitar.
          </p>
          <div className="home-hero-actions">
            <a className="home-primary-button" href="#program">
              Kenali programnya <span><HomeIcon name="arrow" size={15} /></span>
            </a>
            <a className="home-text-link" href="#showcase">
              Lihat Karya Siswa <HomeIcon name="external" size={15} />
            </a>
          </div>
        </div>
        <HeroSlideshow />
      </div>
    </header>
  );
}

function Partners() {
  return (
    <section className="home-partners" aria-label="Mitra program">
      <div className="home-container home-partners-row">
        <p>Bersama membangun<br /><strong>generasi siap AI.</strong></p>
        <Image unoptimized src={pjiLogo} alt="Prestasi Junior Indonesia, Member of JA Worldwide" className="home-pji-logo" />
        <span className="home-partner-times" aria-hidden="true">×</span>
        <div className="home-sponsor">
          <span>DISPONSORI OLEH</span>
          <Image unoptimized src={awsLogo} alt="AWS" className="home-aws-logo" />
        </div>
      </div>
    </section>
  );
}

function Program() {
  return (
    <section id="program" className="home-program" aria-labelledby="home-program-title">
      <div className="home-container home-section">
        <div className="home-kicker">Tentang Program</div>
        <div className="home-program-heading">
          <h2 id="home-program-title">MENJANGKAU RATUSAN GURU DAN RIBUAN SISWA <span>DI JAWA BARAT.</span></h2>
          <div className="home-program-copy">
            <HomeSpark size={40} />
            <p>
              Sejak 2023, AWS dan Prestasi Junior Indonesia (PJI) berkolaborasi melalui STEM Capacity Program
              untuk meningkatkan kualitas pendidikan STEM. Program ini memperkuat kompetensi pedagogis guru
              dalam mengintegrasikan pembelajaran digital dan teknologi terkini.
            </p>
            <p><strong>Program ini dikembangkan secara bertahap, mengikuti perkembangan teknologi dan kebutuhan pendidikan.</strong></p>
          </div>
        </div>
        <ProgramImpact />
      </div>
    </section>
  );
}

function Activities() {
  return (
    <section id="perjalanan" className="home-activities" aria-labelledby="home-activities-title">
      <div className="home-container home-section">
        <div className="home-kicker">Aktivitas Program</div>
        <div className="home-activities-heading">
          <h2 id="home-activities-title">MENDUKUNG PEMBELAJARAN STEM<br /><span>BERKELANJUTAN DI SEKOLAH.</span></h2>
          <p>
            Selain pelatihan, guru juga dibekali akses ke media pembelajaran praktik seperti BBC micro:bit serta
            platform pengembangan aplikasi berbasis AI, seperti AWS PartyRock, Amazon Bedrock, dan AWS Kiro.
          </p>
        </div>
        <ol className="home-activity-grid">
          {activities.map(({ title, image, alt, position, description }, index) => (
            <li key={title}>
              <Image unoptimized src={image} alt={alt} style={{ objectPosition: position }} />
              <h3>{index + 1}. {title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Curriculum() {
  return (
    <section id="kurikulum" className="home-curriculum home-dark" aria-labelledby="home-curriculum-title">
      <div className="home-container home-section">
        <div className="home-kicker">Curriculum Program</div>
        <div className="home-section-heading">
          <h2 id="home-curriculum-title">MULAI DARI KONSEP.<br /><span>KE INOVASI IDE.</span></h2>
          <p>Siswa belajar mulai dari “AI itu apa?” sampai<br />“Ini aplikasi buatan saya.”</p>
        </div>
        <CurriculumTabs />
        <div className="home-curriculum-bottom">
          <p><HomeIcon name="book" /> Panduan guru, slide presentasi, dan lembar kerja siswa. Pendampingan PJI sepanjang program.</p>
          <a className="home-text-link" href={LMS_URL}>Buka ruang belajar LMS <HomeIcon name="external" size={15} /></a>
        </div>
      </div>
    </section>
  );
}

function Hackathon() {
  return (
    <section id="hackathon" className="home-hackathon home-dark" aria-labelledby="home-hackathon-title">
      <div className="home-container home-section">
        <div className="home-kicker">Tentang AI Hackathon</div>
        <div className="home-section-heading">
          <h2 id="home-hackathon-title">CHALLENGE!<br /><span>AI FOR GOOD.</span></h2>
          <p>
            Ajang kompetisi inovasi yang mendorong siswa menerapkan pengetahuan dan keterampilan AI
            untuk menciptakan solusi atas permasalahan nyata di lingkungan sekitar.
          </p>
        </div>
        <div className="home-hackathon-grid">
          <div>
            <h3 className="home-kicker">Tahapan Kompetisi</h3>
            <ol className="home-competition-stages">
              {competitionStages.map(({ quantity, unit, title, description }, index) => (
                <li key={title}>
                  <div className="home-competition-count"><strong>{quantity}</strong><span>{unit}</span></div>
                  <div>
                    <span className="home-competition-meta">TAHAP 0{index + 1}</span>
                    <h4>{title}</h4>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="home-kicker">Kategori Penghargaan</h3>
            <div className="home-awards">
              <div>
                <h4>Main Awards</h4>
                <p>Penghargaan untuk tiga tim terbaik berdasarkan showcase prototipe, pitching, dan wawancara panel.</p>
                <ol>
                  <li><span aria-hidden="true">1st</span> First Place Winner</li>
                  <li><span aria-hidden="true">2nd</span> Second Place Winner</li>
                  <li><span aria-hidden="true">3rd</span> Third Place Winner</li>
                </ol>
              </div>
              <div>
                <h4>Signature Awards</h4>
                <p>Penghargaan khusus bagi inovasi dengan keunggulan tertentu.</p>
                <ul>
                  {['Sustainability Innovation Award', 'The Most Creative Project', 'Public Choice Award'].map((name) => (
                    <li key={name}><span><HomeSpark size={11} /></span> {name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Teacher Ambassadors <span className="home-competition-meta">5 GURU</span></h4>
                <p>
                  Lima guru terbaik terpilih sebagai Duta Program STEM Capacity Building untuk mendorong
                  inspirasi dan keberlanjutan implementasi pembelajaran STEM di sekolah.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase({ published }: { published: ReactNode }) {
  return (
    <section id="showcase" className="home-showcase" aria-labelledby="home-showcase-title">
      <div className="home-container home-section">
        <div className="home-kicker">Showcase Karya</div>
        <FeaturedProjectCarousel heading={
          <h2 id="home-showcase-title">KARYA INOVASI SISWA.<br /><span>SOLUSI MASA DEPAN.</span></h2>
        }>
          {featuredProjects.map(({ title, image, alt, position, school, award, medal, description, features }) => (
            <li key={title} className="home-featured-card">
              <div className="home-featured-image">
                <Image unoptimized src={image} alt={alt} style={{ objectPosition: position }} />
                <span className="home-award-badge" data-medal={medal}>{award}</span>
              </div>
              <div className="home-featured-body">
                <span className="home-featured-school">{school}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <ul className="home-project-features" aria-label="Fitur utama">
                  {features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
            </li>
          ))}
          <li className="home-featured-next">
            <HomeSpark size={30} />
            <h3>Karya siswa berikutnya</h3>
            <p>Segera hadir setelah ditinjau tim program.</p>
            <a className="home-text-link" href="#kirim">Kirim karya <HomeIcon name="external" size={15} /></a>
          </li>
        </FeaturedProjectCarousel>
        <div id="karya-terbit" className="home-published">
          <h3>Karya yang Dipublikasikan</h3>
          {published}
        </div>
      </div>
    </section>
  );
}

function Submission({ children }: { children: ReactNode }) {
  return (
    <section id="kirim" className="home-submission home-dark" aria-labelledby="home-submission-title">
      <div className="home-container home-section home-submission-grid">
        <div className="home-submission-copy">
          <div className="home-kicker">Kirim Karya</div>
          <h2 id="home-submission-title">SATU IDE.<br />LANGKAH<br /><span>SELANJUTNYA.</span></h2>
          <p>
            Tim sekolah peserta dapat mengirimkan proyek atau prototipe AI untuk ditinjau tim program
            dan ditampilkan di website ini.
          </p>
          <ol>
            <li>Lengkapi cerita di balik karya.</li>
            <li>Kirim proyek langsung ke tim program.</li>
            <li>Tim program meninjau karya sebelum publikasi.</li>
          </ol>
          <a className="home-lms-card" href={LMS_URL}>
            <HomeIcon name="book" size={24} />
            <span>
              <strong>Guru pengampu &amp; admin?</strong>
              <small>Masuk ke akun LMS yang telah diaktifkan.</small>
            </span>
            <HomeIcon name="external" size={15} />
          </a>
        </div>
        <div className="home-form-card">{children}</div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="home-faq" aria-labelledby="home-faq-title">
      <div className="home-container home-section home-faq-grid">
        <div>
          <div className="home-kicker">Masih Penasaran?</div>
          <h2 id="home-faq-title">INGIN TAHU<br />LEBIH LANJUT?<br /><span>LET’S TALK.</span></h2>
          <HomeSpark size={58} />
        </div>
        <div className="home-faq-list">
          {faqs.map(({ question, answer }, index) => (
            <details name="home-faq" key={question}>
              <summary>
                <span aria-hidden="true">0{index + 1}</span>
                <strong>{question}</strong>
                <span aria-hidden="true"><HomeIcon name="plus" size={13} /></span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="footer" className="home-footer">
      <div className="home-container">
        <div className="home-footer-grid">
          <FooterRobot />
          <div className="home-footer-brand">
            <a href="#top" aria-label="AI Builder, kembali ke beranda">
              <Image unoptimized src={footerLogo} alt="AI Builder by PJI × AWS" />
            </a>
            <p>Membangun generasi yang tidak hanya siap menghadapi masa depan, tetapi juga ikut menciptakannya.</p>
          </div>
          <nav aria-label="Jelajahi program">
            <h2>Jelajahi</h2>
            <a href="#program">Tentang program</a>
            <a href="#perjalanan">Aktivitas program</a>
            <a href="#kurikulum">Kurikulum</a>
            <a href="#hackathon">AI Hackathon</a>
            <a href="#showcase">Showcase karya</a>
            <a href="#galeri">Galeri kegiatan</a>
          </nav>
          <nav aria-label="Tautan program">
            <h2>Terhubung</h2>
            <a href="#faq">Pertanyaan umum</a>
            <a href={LMS_URL}>Ruang belajar LMS <HomeIcon name="external" size={12} /></a>
            <a href="https://www.prestasijunior.org" target="_blank" rel="noopener noreferrer">Prestasi Junior Indonesia <HomeIcon name="external" size={12} /></a>
          </nav>
          <div className="home-footer-contact">
            <h2>Mari Berkolaborasi</h2>
            <p>Satu percakapan bisa menjadi awal dari perubahan besar.</p>
            <a href={'mailto:' + PROGRAM_EMAIL}>{PROGRAM_EMAIL} <HomeIcon name="external" size={13} /></a>
          </div>
        </div>
        <div className="home-footer-bottom">
          <span>© 2026 Prestasi Junior Indonesia · Anggota JA Worldwide</span>
          <span>STEM Capacity Building · Didukung oleh AWS Indonesia</span>
          <a href="#top">Kembali ke atas ↑</a>
        </div>
      </div>
    </footer>
  );
}

export default function AIBuilderHome({ showcase, gallery, submission }: HomeSlots) {
  return (
    <div id="top" className="stem-home">
      <a className="home-skip-link" href="#main">Langsung ke konten</a>
      <HomeNavigation />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Partners />
        <Program />
        <Activities />
        <Curriculum />
        <Hackathon />
        <Showcase published={showcase} />
        <section id="galeri" className="home-gallery" aria-labelledby="home-gallery-title">
          <div className="home-container home-section">
            <h2 id="home-gallery-title">GALERI <span>KEGIATAN.</span></h2>
            {gallery}
          </div>
        </section>
        <Submission>{submission}</Submission>
        <Faq />
        <div className="home-closing">
          <span>THINK BIG.</span><HomeSpark size={33} />
          <span>BUILD WITH AI.</span><HomeSpark size={33} />
          <span>MAKE IT MATTER.</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
