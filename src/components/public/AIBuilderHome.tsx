import Image from 'next/image';
import type { ReactNode } from 'react';

import awsLogo from './home-assets/aws.png';
import footerLogo from './home-assets/ai-builder-footer.png';
import pjiLogo from './home-assets/prestasi-junior-indonesia.png';
import { Bi, LangInit, T } from './Bi';
import { activities, competitionStages, faqs, featuredProjects, LMS_URL, PROGRAM_EMAIL } from './home-content';
import { HomeIcon, HomeSpark } from './HomeIcons';
import { HomeMotion } from './HomeLanguage';
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
                <path pathLength={1} d="M4 8C80 4 200 3 296 8" strokeWidth="4" />
                <path pathLength={1} d="M60 20C130 15 200 14 250 18" strokeWidth="3" />
              </svg>
            </span>
          </h1>
          <p className="home-hero-tagline">
            <Bi id="AI Builder: From Literacy to Real-World Solutions" en="AI Builder: From Literacy to Real-World Solutions" />
          </p>
          <p className="home-hero-description">
            <Bi
              id="Program peningkatan literasi AI dan keterampilan digital guru dan siswa SMA/SMK di Indonesia. Peserta belajar memahami AI dan etikanya, mengembangkan aplikasi dengan AI, dan menciptakan solusi nyata untuk mengatasi masalah di sekitar."
              en="A program that builds AI literacy and digital skills for senior high and vocational school teachers and students in Indonesia. Participants learn to understand AI and its ethics, build applications with AI, and create real solutions to problems around them."
            />
          </p>
          <div className="home-hero-actions">
            <a className="home-primary-button" href="#program">
              <Bi id="Kenali programnya" en="Explore the program" /> <span><HomeIcon name="arrow" size={15} /></span>
            </a>
            <a className="home-text-link" href="#showcase">
              <Bi id="Lihat Karya Siswa" en="See Student Projects" /> <HomeIcon name="external" size={15} />
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
    <section className="home-partners" aria-label="Partners / Mitra program">
      <div className="home-container home-partners-row">
        <p>
          <Bi
            id={<>Bersama membangun<br /><strong>generasi siap AI.</strong></>}
            en={<>Building together<br /><strong>an AI-ready generation.</strong></>}
          />
        </p>
        <Image unoptimized src={pjiLogo} alt="Prestasi Junior Indonesia, Member of JA Worldwide" className="home-pji-logo" />
        <span className="home-partner-times" aria-hidden="true">×</span>
        <div className="home-sponsor">
          <span><Bi id="DISPONSORI OLEH" en="SPONSORED BY" /></span>
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
        <div className="home-kicker"><Bi id="Tentang Program" en="About the Program" /></div>
        <div className="home-program-heading">
          <h2 id="home-program-title">
            <Bi
              id={<>MENJANGKAU RATUSAN GURU DAN RIBUAN SISWA <span>DI JAWA BARAT.</span></>}
              en={<>REACHING HUNDREDS OF TEACHERS AND THOUSANDS OF STUDENTS <span>IN WEST JAVA.</span></>}
            />
          </h2>
          <div className="home-program-copy">
            <HomeSpark size={40} />
            <p>
              <Bi
                id="Sejak 2023, AWS dan Prestasi Junior Indonesia (PJI) berkolaborasi melalui STEM Capacity Program untuk meningkatkan kualitas pendidikan STEM. Program ini memperkuat kompetensi pedagogis guru dalam mengintegrasikan pembelajaran digital dan teknologi terkini."
                en="Since 2023, AWS and Prestasi Junior Indonesia (PJI) have partnered through the STEM Capacity Program to improve the quality of STEM education. The program strengthens teachers’ pedagogical competence in integrating digital learning and current technology."
              />
            </p>
            <p>
              <strong>
                <Bi
                  id="Program ini dikembangkan secara bertahap, mengikuti perkembangan teknologi dan kebutuhan pendidikan."
                  en="The program is developed in stages, following advances in technology and the needs of education."
                />
              </strong>
            </p>
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
        <div className="home-kicker"><Bi id="Aktivitas Program" en="Program Activities" /></div>
        <div className="home-activities-heading">
          <h2 id="home-activities-title">
            <Bi
              id={<>MENDUKUNG PEMBELAJARAN STEM<br /><span>BERKELANJUTAN DI SEKOLAH.</span></>}
              en={<>SUPPORTING STEM LEARNING<br /><span>THAT LASTS IN SCHOOLS.</span></>}
            />
          </h2>
          <p>
            <Bi
              id="Selain pelatihan, guru juga dibekali akses ke media pembelajaran praktik seperti BBC micro:bit serta platform pengembangan aplikasi berbasis AI, seperti AWS PartyRock, Amazon Bedrock, dan AWS Kiro."
              en="Beyond training, teachers also get access to hands-on learning tools such as the BBC micro:bit and AI app-building platforms such as AWS PartyRock, Amazon Bedrock, and AWS Kiro."
            />
          </p>
        </div>
        <ol className="home-activity-grid">
          {activities.map(({ title, image, alt, position, description }, index) => (
            <li key={title.id}>
              <Image unoptimized src={image} alt={alt} style={{ objectPosition: position }} />
              <h3>{index + 1}. <T v={title} /></h3>
              <p><T v={description} /></p>
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
        <div className="home-kicker"><Bi id="Curriculum Program" en="Program Curriculum" /></div>
        <div className="home-section-heading">
          <h2 id="home-curriculum-title">
            <Bi
              id={<>MULAI DARI KONSEP.<br /><span>KE INOVASI IDE.</span></>}
              en={<>START WITH THE CONCEPT.<br /><span>END WITH AN INNOVATION.</span></>}
            />
          </h2>
          <p>
            <Bi
              id={<>Siswa belajar mulai dari “AI itu apa?” sampai<br />“Ini aplikasi buatan saya.”</>}
              en={<>Students go from “What is AI?” to<br />“This is the app I built.”</>}
            />
          </p>
        </div>
        <CurriculumTabs />
        <div className="home-curriculum-bottom">
          <p>
            <HomeIcon name="book" />{' '}
            <Bi
              id="Panduan guru, slide presentasi, dan lembar kerja siswa. Pendampingan PJI sepanjang program."
              en="Teacher guide, presentation slides, and student worksheets. PJI mentoring throughout the program."
            />
          </p>
          <a className="home-text-link" href={LMS_URL}>
            <Bi id="Buka ruang belajar LMS" en="Open the LMS learning space" /> <HomeIcon name="external" size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

function Hackathon() {
  return (
    <section id="hackathon" className="home-hackathon home-dark" aria-labelledby="home-hackathon-title">
      <div className="home-container home-section">
        <div className="home-kicker"><Bi id="Tentang AI Hackathon" en="About the AI Hackathon" /></div>
        <div className="home-section-heading">
          <h2 id="home-hackathon-title">CHALLENGE!<br /><span>AI FOR GOOD.</span></h2>
          <p>
            <Bi
              id="Ajang kompetisi inovasi yang mendorong siswa menerapkan pengetahuan dan keterampilan AI untuk menciptakan solusi atas permasalahan nyata di lingkungan sekitar."
              en="An innovation competition that encourages students to apply their AI knowledge and skills to create solutions for real problems in their surroundings."
            />
          </p>
        </div>
        <div className="home-hackathon-grid">
          <div>
            <h3 className="home-kicker"><Bi id="Tahapan Kompetisi" en="Competition Stages" /></h3>
            <ol className="home-competition-stages">
              {competitionStages.map(({ quantity, unit, title, description }, index) => (
                <li key={title.id}>
                  <div className="home-competition-count"><strong>{quantity}</strong><span><T v={unit} /></span></div>
                  <div>
                    <span className="home-competition-meta"><Bi id="TAHAP" en="STAGE" /> 0{index + 1}</span>
                    <h4><T v={title} /></h4>
                    <p><T v={description} /></p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="home-kicker"><Bi id="Kategori Penghargaan" en="Award Categories" /></h3>
            <div className="home-awards">
              <div>
                <h4>Main Awards</h4>
                <p>
                  <Bi
                    id="Penghargaan untuk tiga tim terbaik berdasarkan showcase prototipe, pitching, dan wawancara panel."
                    en="Awards for the three best teams, based on their prototype showcase, pitch, and panel interview."
                  />
                </p>
                <ol>
                  <li><span aria-hidden="true">1st</span> First Place Winner</li>
                  <li><span aria-hidden="true">2nd</span> Second Place Winner</li>
                  <li><span aria-hidden="true">3rd</span> Third Place Winner</li>
                </ol>
              </div>
              <div>
                <h4>Signature Awards</h4>
                <p>
                  <Bi
                    id="Penghargaan khusus bagi inovasi dengan keunggulan tertentu."
                    en="Special awards for innovations that excel in a particular area."
                  />
                </p>
                <ul>
                  {['Sustainability Innovation Award', 'The Most Creative Project', 'Public Choice Award'].map((name) => (
                    <li key={name}><span><HomeSpark size={11} /></span> {name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Teacher Ambassadors <span className="home-competition-meta"><Bi id="5 GURU" en="5 TEACHERS" /></span></h4>
                <p>
                  <Bi
                    id="Lima guru terbaik terpilih sebagai Duta Program STEM Capacity Building untuk mendorong inspirasi dan keberlanjutan implementasi pembelajaran STEM di sekolah."
                    en="The five best teachers are chosen as Ambassadors of the STEM Capacity Building Program to inspire and sustain STEM learning in schools."
                  />
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
        <div className="home-kicker"><Bi id="Showcase Karya" en="Project Showcase" /></div>
        <FeaturedProjectCarousel heading={
          <h2 id="home-showcase-title">
            <Bi
              id={<>KARYA INOVASI SISWA.<br /><span>SOLUSI MASA DEPAN.</span></>}
              en={<>STUDENT INNOVATION.<br /><span>SOLUTIONS FOR THE FUTURE.</span></>}
            />
          </h2>
        }>
          {featuredProjects.map(({ title, image, alt, position, school, award, medal, description, features }) => (
            <li key={title} className="home-featured-card">
              <div className="home-featured-image">
                <Image unoptimized src={image} alt={alt} style={{ objectPosition: position }} />
                <span className="home-award-badge" data-medal={medal}><T v={award} /></span>
              </div>
              <div className="home-featured-body">
                <span className="home-featured-school">{school}</span>
                <h3>{title}</h3>
                <p><T v={description} /></p>
                <ul className="home-project-features" aria-label="Key features / Fitur utama">
                  {features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
            </li>
          ))}
          <li className="home-featured-next">
            <HomeSpark size={30} />
            <h3><Bi id="Karya siswa berikutnya" en="The next student project" /></h3>
            <p><Bi id="Segera hadir setelah ditinjau tim program." en="Coming soon, once the program team has reviewed it." /></p>
            <a className="home-text-link" href="#kirim"><Bi id="Kirim karya" en="Submit a project" /> <HomeIcon name="external" size={15} /></a>
          </li>
        </FeaturedProjectCarousel>
        <div id="karya-terbit" className="home-published">
          <h3><Bi id="Karya Siswa yang Dipublikasikan" en="Published Student Projects" /></h3>
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
          <div className="home-kicker"><Bi id="Kirim Karya" en="Submit a Project" /></div>
          <h2 id="home-submission-title">
            <Bi
              id={<>SATU IDE.<br />LANGKAH<br /><span>SELANJUTNYA.</span></>}
              en={<>ONE IDEA.<br />THE NEXT<br /><span>STEP.</span></>}
            />
          </h2>
          <p>
            <Bi
              id="Tim sekolah peserta dapat mengirimkan proyek atau prototipe AI untuk ditinjau tim program dan ditampilkan di website ini."
              en="Participating school teams can submit an AI project or prototype for the program team to review and feature on this website."
            />
          </p>
          <ol>
            <li><Bi id="Lengkapi cerita di balik karya." en="Tell the story behind your project." /></li>
            <li><Bi id="Kirim proyek langsung ke tim program." en="Send your project straight to the program team." /></li>
            <li><Bi id="Tim program meninjau karya sebelum publikasi." en="The program team reviews it before publication." /></li>
          </ol>
          <a className="home-lms-card" href={LMS_URL}>
            <HomeIcon name="book" size={24} />
            <span>
              <strong><Bi id="Guru pengampu & admin?" en="Teachers & admins?" /></strong>
              <small><Bi id="Masuk ke akun LMS yang telah diaktifkan." en="Sign in to your activated LMS account." /></small>
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
          <div className="home-kicker"><Bi id="Masih Penasaran?" en="Still curious?" /></div>
          <h2 id="home-faq-title">
            <Bi
              id={<>INGIN TAHU<br />LEBIH LANJUT?<br /><span>LET’S TALK.</span></>}
              en={<>WANT TO KNOW<br />MORE?<br /><span>LET’S TALK.</span></>}
            />
          </h2>
          <HomeSpark size={58} />
        </div>
        <div className="home-faq-list">
          {faqs.map(({ question, answer }, index) => (
            <details name="home-faq" key={question.id}>
              <summary>
                <span aria-hidden="true">0{index + 1}</span>
                <strong><T v={question} /></strong>
                <span aria-hidden="true"><HomeIcon name="plus" size={13} /></span>
              </summary>
              <p><T v={answer} /></p>
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
            <a href="#top" aria-label="AI Builder">
              <Image unoptimized src={footerLogo} alt="AI Builder by PJI × AWS" />
            </a>
            <p>
              <Bi
                id="Membangun generasi yang tidak hanya siap menghadapi masa depan, tetapi juga ikut menciptakannya."
                en="Building a generation that is not only ready for the future, but helps create it."
              />
            </p>
          </div>
          <nav aria-label="Explore / Jelajahi">
            <h2><Bi id="Jelajahi" en="Explore" /></h2>
            <a href="#program"><Bi id="Tentang program" en="About the program" /></a>
            <a href="#perjalanan"><Bi id="Aktivitas program" en="Program activities" /></a>
            <a href="#kurikulum"><Bi id="Kurikulum" en="Curriculum" /></a>
            <a href="#hackathon">AI Hackathon</a>
            <a href="#showcase"><Bi id="Showcase karya" en="Project showcase" /></a>
            <a href="#galeri"><Bi id="Galeri kegiatan" en="Activity gallery" /></a>
          </nav>
          <nav aria-label="Links / Tautan">
            <h2><Bi id="Terhubung" en="Connect" /></h2>
            <a href="#faq"><Bi id="Pertanyaan umum" en="FAQ" /></a>
            <a href={LMS_URL}><Bi id="Ruang belajar LMS" en="LMS learning space" /> <HomeIcon name="external" size={12} /></a>
            <a href="https://www.prestasijunior.org" target="_blank" rel="noopener noreferrer">Prestasi Junior Indonesia <HomeIcon name="external" size={12} /></a>
          </nav>
          <div className="home-footer-contact">
            <h2><Bi id="Mari Berkolaborasi" en="Let’s Collaborate" /></h2>
            <p><Bi id="Satu percakapan bisa menjadi awal dari perubahan besar." en="One conversation can be the start of big change." /></p>
            <a href={'mailto:' + PROGRAM_EMAIL}>{PROGRAM_EMAIL} <HomeIcon name="external" size={13} /></a>
          </div>
        </div>
        <div className="home-footer-bottom">
          <span><Bi id="© 2026 Prestasi Junior Indonesia · Anggota JA Worldwide" en="© 2026 Prestasi Junior Indonesia · Member of JA Worldwide" /></span>
          <span><Bi id="STEM Capacity Building · Didukung oleh AWS Indonesia" en="STEM Capacity Building · Supported by AWS Indonesia" /></span>
          <a href="#top"><Bi id="Kembali ke atas ↑" en="Back to top ↑" /></a>
        </div>
      </div>
    </footer>
  );
}

export default function AIBuilderHome({ showcase, gallery, submission }: HomeSlots) {
  return (
    <div id="top" className="stem-home" suppressHydrationWarning>
      <LangInit />
      <a className="home-skip-link" href="#main"><Bi id="Langsung ke konten" en="Skip to content" /></a>
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
            <h2 id="home-gallery-title"><Bi id={<>GALERI <span>KEGIATAN.</span></>} en={<>ACTIVITY <span>GALLERY.</span></>} /></h2>
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
      <HomeMotion />
    </div>
  );
}
