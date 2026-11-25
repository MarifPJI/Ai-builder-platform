import hackathonPhoto from './home-assets/hero-hackathon.webp';
import trainingPhoto from './home-assets/hero-training.webp';
import partyRockPhoto from './home-assets/hero-partyrock.webp';
import teachersPhoto from './home-assets/hero-teachers.webp';
import curriculumActivity from './home-assets/activity-curriculum.webp';
import trainingActivity from './home-assets/activity-training.webp';
import classroomActivity from './home-assets/activity-classroom.webp';
import hackathonActivity from './home-assets/activity-hackathon.webp';
import learnToEarn from './home-assets/project-learn-to-earn.webp';
import siPintar from './home-assets/project-si-pintar.webp';
import siapIn from './home-assets/project-siap-in.webp';
import surgeon from './home-assets/project-surgeon.webp';

export const LMS_URL = 'https://lms.awsinstem.id/login';
export const PROGRAM_EMAIL = 'marif.hidayatullah@prestasijunior.org';

export const heroPhotos = [
  {
    image: hackathonPhoto,
    alt: 'Tim pemenang AI Hackathon Grand Finale di atas panggung dengan trofi',
    position: '52% 50%',
  },
  {
    image: trainingPhoto,
    alt: 'Foto bersama peserta Pembukaan dan Pelatihan Guru STEAM Capacity Building 2025',
    position: '50% 50%',
  },
  {
    image: partyRockPhoto,
    alt: 'Peserta mencoba PartyRock di laptop',
    position: '62% 50%',
  },
  {
    image: teachersPhoto,
    alt: 'Guru berdiskusi bersama di meja saat pelatihan',
    position: '50% 50%',
  },
];

export const programPhases = [
  {
    period: '2023–2024',
    title: 'Automation & Internet of Things (IoT)',
    description: 'Membangun fondasi pemahaman dan keterampilan guru dalam teknologi otomasi dan Internet of Things (IoT), serta penerapannya dalam pembelajaran STEM.',
    students: 3284,
    studentLabel: 'siswa terdampak',
    schools: 20,
    teachers: 100,
    teacherLabel: 'guru STEM dilibatkan',
  },
  {
    period: '2024–2025',
    title: 'Artificial Intelligence & Machine Learning',
    description: 'Memperluas kompetensi guru dalam memahami dan mengintegrasikan kecerdasan buatan (AI) dan Machine Learning ke dalam pembelajaran, sekaligus memperkenalkan potensi teknologi AI untuk menjawab berbagai tantangan di dunia nyata.',
    students: 5106,
    studentLabel: 'siswa terdampak',
    schools: 40,
    teachers: 40,
    teacherLabel: 'guru TIK dilatih',
  },
  {
    period: '2026–2027',
    title: 'AI Builder',
    description: 'Mendorong guru dan siswa untuk memahami, menggunakan, dan menciptakan teknologi AI. Melalui pendekatan AI Builder, peserta belajar mengembangkan aplikasi dan solusi digital berbasis AI untuk menjawab permasalahan nyata di lingkungan sekitar.',
    students: 6000,
    studentLabel: 'siswa menjadi target penerima manfaat',
    schools: 50,
    teachers: 50,
    teacherLabel: 'guru TIK dilatih',
    current: true,
  },
];

export const activities = [
  {
    title: 'Pengembangan Kurikulum',
    image: curriculumActivity,
    alt: 'Guru membaca modul kurikulum STEAM Capacity Building saat pelatihan',
    position: '62% 50%',
    description: 'AWS dan PJI mengembangkan kurikulum pembelajaran digital yang relevan dengan kebutuhan sekolah dan selaras dengan kurikulum nasional.',
  },
  {
    title: 'Pelatihan Guru',
    image: trainingActivity,
    alt: 'Fasilitator memberikan materi pelatihan kepada para guru',
    position: '60% 40%',
    description: 'Meningkatkan kompetensi pedagogis dan keterampilan digital guru melalui pelatihan intensif.',
  },
  {
    title: 'Implementasi Pembelajaran',
    image: classroomActivity,
    alt: 'Siswa SMA berdiskusi mengerjakan aktivitas di laboratorium komputer',
    position: '45% 50%',
    description: 'Guru menerapkan kurikulum melalui pembelajaran berbasis praktik dan proyek untuk mengembangkan keterampilan digital dan kreativitas siswa.',
  },
  {
    title: 'AI Hackathon',
    image: hackathonActivity,
    alt: 'Tim siswa memamerkan prototipe aplikasi AI di AI Hackathon',
    position: '55% 45%',
    description: 'Siswa berkolaborasi mengembangkan solusi dan aplikasi berbasis AI untuk menjawab permasalahan nyata melalui kompetisi dan tantangan inovasi.',
  },
];

type CurriculumTrack = {
  label: string;
  count: string;
  title: string;
  icon: 'brain' | 'code';
  description: string;
  tools: string;
  lessons: { title: string; detail?: string }[];
};

export const curriculum: CurriculumTrack[] = [
  {
    label: 'Literasi AI',
    count: '5 pelajaran',
    title: 'Sesi 1. Fondasi AI',
    icon: 'brain',
    description: 'Siswa memahami apa itu AI, bagaimana cara kerjanya, etika penggunaannya, dan dampaknya bagi masyarakat melalui 5 pelajaran terstruktur.',
    tools: 'Berpikir kritis · Eksplorasi · Diskusi',
    lessons: [
      { title: 'Apa itu artificial intelligence?' },
      { title: 'Bagaimana cara kerja AI?' },
      { title: 'Mengenal generative AI' },
      { title: 'Etika & penggunaan AI yang bertanggung jawab' },
      { title: 'Dampak AI bagi masyarakat' },
    ],
  },
  {
    label: 'Vibe Coding dengan AWS Kiro',
    count: '5 topik',
    title: 'Sesi 2. Mengembangkan Aplikasi AI',
    icon: 'code',
    description: 'Siswa praktik langsung memakai platform AI untuk merancang dan membangun situs web atau aplikasi, lalu mengintegrasikan model AI melalui API berbasis cloud seperti Amazon Bedrock.',
    tools: 'AWS Kiro · AWS PartyRock · Amazon Bedrock',
    lessons: [
      { title: 'Pengantar Vibe Coding', detail: 'Proyek: Aplikasi Ide Spark & WebApp Quiz Nusantara' },
      { title: 'Pengenalan AWS Kiro', detail: 'Proyek: Website Portofolio' },
      { title: 'Aplikasi Chatbot AI sebagai Asisten Belajar', detail: 'Tools: AWS Kiro & Amazon Bedrock' },
      { title: 'Aplikasi Manajemen Kelas (Planning & Front-end)', detail: 'Tools: AWS Kiro & Amazon Bedrock' },
      { title: 'Aplikasi Manajemen Kelas (Backend & Deployment)', detail: 'Tools: AWS Kiro & Amazon Bedrock' },
    ],
  },
];

export const competitionStages = [
  {
    quantity: 50,
    unit: 'sekolah',
    title: 'Penyisihan',
    description: 'Sebanyak 50 sekolah mengajukan gagasan inovasi dengan satu tim per sekolah.',
  },
  {
    quantity: 20,
    unit: 'gagasan',
    title: 'Semifinal',
    description: '20 gagasan terbaik terpilih mengikuti mentoring dan pengembangan prototipe.',
  },
  {
    quantity: 10,
    unit: 'tim',
    title: 'Final',
    description: '10 tim terbaik mendapatkan pendampingan lanjutan untuk menyempurnakan inovasi mereka.',
  },
  {
    quantity: 10,
    unit: 'finalis',
    title: 'Culminating Events',
    description: '10 finalis mempresentasikan gagasan dan mengikuti sesi wawancara di hadapan dewan juri untuk menentukan para pemenang.',
  },
];

export const featuredProjects = [
  {
    title: 'Learn to Earn',
    image: learnToEarn,
    alt: 'Tampilan aplikasi Study Buddy AI Agent dari proyek Learn to Earn',
    position: '50% 30%',
    school: 'SMAN 2 Cibinong — So Learn Team',
    award: 'Juara 1 · AI Hackathon 2025',
    medal: 'gold',
    description: 'Aplikasi berbasis web yang mengintegrasikan AI, gamifikasi, dan pembelajaran interaktif untuk mempermudah administrasi guru serta meningkatkan kemandirian dan motivasi belajar siswa.',
    features: ['SolveWise AI', 'Gamified Learning', 'Interactive Learning Designer'],
  },
  {
    title: 'Si Pintar',
    image: siPintar,
    alt: 'Tampilan deteksi wajah di kelas oleh aplikasi Si Pintar',
    position: '50% 40%',
    school: 'SMKN 1 Cimahi — JSC Team',
    award: 'Juara 2 · AI Hackathon 2025',
    medal: 'silver',
    description: 'Aplikasi berbasis AI yang terintegrasi dengan CCTV sekolah untuk mengotomatisasi absensi dan memantau aktivitas siswa selama kegiatan belajar di sekolah.',
    features: ['Automated Attendance', 'Behavior Monitoring', 'WhatsApp Integration'],
  },
  {
    title: 'Siap.In',
    image: siapIn,
    alt: 'Tampilan beranda platform Siap.In',
    position: '50% 20%',
    school: 'SMAN 4 Depok — STEVIA Team',
    award: 'Juara 3 · AI Hackathon 2025',
    medal: 'bronze',
    description: 'Platform informasi pendidikan tinggi yang terintegrasi dengan sekolah untuk membantu siswa mengeksplorasi jalur masuk perguruan tinggi, universitas, program studi, dan informasi alumni.',
    features: ['Admission Pathways', 'Universities Directory', 'Study Programs', 'News Updates', 'Alumni Database'],
  },
  {
    title: 'Surgeon',
    image: surgeon,
    alt: 'Siswa memperagakan sarung tangan penerjemah bahasa isyarat Surgeon',
    position: '50% 40%',
    school: 'Cahaya Rancamaya Islamic Boarding School, Bogor — Gorillas Team',
    award: 'Juara 1 · STEAMInFest 2023',
    medal: 'gold',
    description: 'Perangkat penerjemah bahasa isyarat berbasis Arduino Nano dan sensor gerak untuk membantu penyandang tunarungu berkomunikasi, mendukung komunikasi inklusif, dan memperluas kesempatan kerja bagi komunitas tunarungu.',
    features: ['Motion Detection', 'Inclusive Communication', 'Future Development'],
  },
];

export const faqs = [
  {
    question: 'Siapa yang dapat mengikuti program ini?',
    answer: 'Guru dan siswa SMA/SMK dari 50 sekolah peserta. Sebanyak 40 sekolah berada di Jawa Barat dan 10 sekolah lainnya di DKI Jakarta, Banten, Jawa Tengah, DI Yogyakarta, dan Jawa Timur. Sekolah peserta ditetapkan melalui koordinasi PJI dengan pemerintah daerah.',
  },
  {
    question: 'Apakah peserta harus bisa coding?',
    answer: 'Tidak. Pembelajaran dimulai dari literasi AI, mulai dari konsep, cara kerja, hingga etika penggunaannya. Setelah itu siswa praktik membangun situs web atau aplikasi dengan bantuan platform AI.',
  },
  {
    question: 'Seperti apa kegiatan belajarnya?',
    answer: 'Guru yang telah dilatih menerapkan kurikulum di kelas pada Oktober–Desember 2026. Siswa mempelajari konsep literasi AI dan mengerjakan proyek berbasis AI, dengan observasi bulanan dari PJI.',
  },
  {
    question: 'Apa yang didapatkan oleh guru?',
    answer: 'Pelatihan luring (Training of Teachers) di Bandung, paket kurikulum berisi panduan guru, slide presentasi, dan lembar kerja siswa, serta pendampingan dari PJI. Lima guru terbaik dipilih menjadi Ambassador Program STEM Capacity Building.',
  },
  {
    question: 'Bagaimana alur AI Hackathon?',
    answer: 'Pada penyisihan (Februari–Maret 2027), 50 sekolah mengirim concept paper. Pada semifinal (April–Mei 2027), 20 tim mengikuti mentoring PJI dan AWS, membuat prototipe, serta menyiapkan video pitch 3 menit. Pada final (Juni 2027), 10 tim mempresentasikan karya dan diwawancarai juri dari AWS dan profesional teknologi digital.',
  },
  {
    question: 'Bagaimana cara mengirimkan karya?',
    answer: 'Tim sekolah peserta mengisi formulir di bagian Kirim Karya dengan nama tim, asal sekolah, judul proyek, kategori, dan ringkasan solusi AI. Tim program meninjau setiap kiriman sebelum dipublikasikan di showcase.',
  },
];
