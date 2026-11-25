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
import { t, type Txt } from './Bi';

export const LMS_URL = 'https://lms.awsinstem.id/';
export const PROGRAM_EMAIL = 'marif.hidayatullah@prestasijunior.org';

export const heroPhotos: { image: typeof hackathonPhoto; alt: Txt; position: string }[] = [
  {
    image: hackathonPhoto,
    alt: t('Tim pemenang AI Hackathon Grand Finale di atas panggung dengan trofi', 'The AI Hackathon Grand Finale winning team on stage with their trophy'),
    position: '52% 50%',
  },
  {
    image: trainingPhoto,
    alt: t('Foto bersama peserta Pembukaan dan Pelatihan Guru STEAM Capacity Building 2025', 'Group photo of participants at the 2025 STEAM Capacity Building teacher training opening'),
    position: '50% 50%',
  },
  {
    image: partyRockPhoto,
    alt: t('Peserta mencoba PartyRock di laptop', 'A participant trying PartyRock on a laptop'),
    position: '62% 50%',
  },
  {
    image: teachersPhoto,
    alt: t('Guru berdiskusi bersama di meja saat pelatihan', 'Teachers discussing together at a table during training'),
    position: '50% 50%',
  },
];

export const programPhases = [
  {
    period: '2023–2024',
    title: t('Automation & Internet of Things (IoT)', 'Automation & Internet of Things (IoT)'),
    description: t(
      'Membangun fondasi pemahaman dan keterampilan guru dalam teknologi otomasi dan Internet of Things (IoT), serta penerapannya dalam pembelajaran STEM.',
      'Building teachers’ foundational understanding and skills in automation and Internet of Things (IoT) technology, and applying them in STEM learning.',
    ),
    students: 3284,
    studentLabel: t('siswa terdampak', 'students reached'),
    schools: 20,
    teachers: 100,
    teacherLabel: t('guru STEM dilibatkan', 'STEM teachers involved'),
    current: false,
  },
  {
    period: '2024–2025',
    title: t('Artificial Intelligence & Machine Learning', 'Artificial Intelligence & Machine Learning'),
    description: t(
      'Memperluas kompetensi guru dalam memahami dan mengintegrasikan kecerdasan buatan (AI) dan Machine Learning ke dalam pembelajaran, sekaligus memperkenalkan potensi teknologi AI untuk menjawab berbagai tantangan di dunia nyata.',
      'Expanding teachers’ competence in understanding and integrating artificial intelligence (AI) and Machine Learning into their teaching, while introducing the potential of AI to address real-world challenges.',
    ),
    students: 5106,
    studentLabel: t('siswa terdampak', 'students reached'),
    schools: 40,
    teachers: 40,
    teacherLabel: t('guru TIK dilatih', 'ICT teachers trained'),
    current: false,
  },
  {
    period: '2026–2027',
    title: t('AI Builder', 'AI Builder'),
    description: t(
      'Mendorong guru dan siswa untuk memahami, menggunakan, dan menciptakan teknologi AI. Melalui pendekatan AI Builder, peserta belajar mengembangkan aplikasi dan solusi digital berbasis AI untuk menjawab permasalahan nyata di lingkungan sekitar.',
      'Encouraging teachers and students to understand, use, and create AI technology. Through the AI Builder approach, participants learn to develop AI-based apps and digital solutions that address real problems in their surroundings.',
    ),
    students: 6000,
    studentLabel: t('siswa menjadi target penerima manfaat', 'students targeted as beneficiaries'),
    schools: 50,
    teachers: 50,
    teacherLabel: t('guru TIK dilatih', 'ICT teachers trained'),
    current: true,
  },
];

export const activities = [
  {
    title: t('Pengembangan Kurikulum', 'Curriculum Development'),
    image: curriculumActivity,
    alt: 'Guru membaca modul kurikulum STEAM Capacity Building saat pelatihan',
    position: '62% 50%',
    description: t(
      'AWS dan PJI mengembangkan kurikulum pembelajaran digital yang relevan dengan kebutuhan sekolah dan selaras dengan kurikulum nasional.',
      'AWS and PJI develop a digital learning curriculum that fits schools’ needs and aligns with the national curriculum.',
    ),
  },
  {
    title: t('Pelatihan Guru', 'Teacher Training'),
    image: trainingActivity,
    alt: 'Fasilitator memberikan materi pelatihan kepada para guru',
    position: '60% 40%',
    description: t(
      'Meningkatkan kompetensi pedagogis dan keterampilan digital guru melalui pelatihan intensif.',
      'Strengthening teachers’ pedagogical competence and digital skills through intensive training.',
    ),
  },
  {
    title: t('Implementasi Pembelajaran', 'Classroom Implementation'),
    image: classroomActivity,
    alt: 'Siswa SMA berdiskusi mengerjakan aktivitas di laboratorium komputer',
    position: '45% 50%',
    description: t(
      'Guru menerapkan kurikulum melalui pembelajaran berbasis praktik dan proyek untuk mengembangkan keterampilan digital dan kreativitas siswa.',
      'Teachers apply the curriculum through hands-on, project-based learning that builds students’ digital skills and creativity.',
    ),
  },
  {
    title: t('AI Hackathon', 'AI Hackathon'),
    image: hackathonActivity,
    alt: 'Tim siswa memamerkan prototipe aplikasi AI di AI Hackathon',
    position: '55% 45%',
    description: t(
      'Siswa berkolaborasi mengembangkan solusi dan aplikasi berbasis AI untuk menjawab permasalahan nyata melalui kompetisi dan tantangan inovasi.',
      'Students collaborate to build AI-based solutions and apps that tackle real problems through competitions and innovation challenges.',
    ),
  },
];

type CurriculumTrack = {
  label: Txt;
  count: Txt;
  title: Txt;
  icon: 'brain' | 'code';
  description: Txt;
  tools: Txt;
  lessons: { title: Txt; detail?: Txt }[];
};

export const curriculum: CurriculumTrack[] = [
  {
    label: t('Literasi AI', 'AI Literacy'),
    count: t('5 pelajaran', '5 lessons'),
    title: t('Sesi 1. Fondasi AI', 'Session 1. AI Foundations'),
    icon: 'brain',
    description: t(
      'Siswa memahami apa itu AI, bagaimana cara kerjanya, etika penggunaannya, dan dampaknya bagi masyarakat melalui 5 pelajaran terstruktur.',
      'Students learn what AI is, how it works, how to use it ethically, and how it affects society through 5 structured lessons.',
    ),
    tools: t('Berpikir kritis · Eksplorasi · Diskusi', 'Critical thinking · Exploration · Discussion'),
    lessons: [
      { title: t('Apa itu artificial intelligence?', 'What is artificial intelligence?') },
      { title: t('Bagaimana cara kerja AI?', 'How does AI work?') },
      { title: t('Mengenal generative AI', 'Getting to know generative AI') },
      { title: t('Etika & penggunaan AI yang bertanggung jawab', 'Ethics & responsible use of AI') },
      { title: t('Dampak AI bagi masyarakat', 'The impact of AI on society') },
    ],
  },
  {
    label: t('Vibe Coding dengan AWS Kiro', 'Vibe Coding with AWS Kiro'),
    count: t('5 topik', '5 topics'),
    title: t('Sesi 2. Mengembangkan Aplikasi AI', 'Session 2. Building AI Applications'),
    icon: 'code',
    description: t(
      'Siswa praktik langsung memakai platform AI untuk merancang dan membangun situs web atau aplikasi, lalu mengintegrasikan model AI melalui API berbasis cloud seperti Amazon Bedrock.',
      'Students get hands-on with AI platforms to design and build websites or apps, then integrate AI models through cloud APIs such as Amazon Bedrock.',
    ),
    tools: t('AWS Kiro · AWS PartyRock · Amazon Bedrock', 'AWS Kiro · AWS PartyRock · Amazon Bedrock'),
    lessons: [
      {
        title: t('Pengantar Vibe Coding', 'Introduction to Vibe Coding'),
        detail: t('Proyek: Aplikasi Ide Spark & WebApp Quiz Nusantara', 'Projects: Ide Spark app & Quiz Nusantara web app'),
      },
      {
        title: t('Pengenalan AWS Kiro', 'Introduction to AWS Kiro'),
        detail: t('Proyek: Website Portofolio', 'Project: Portfolio website'),
      },
      {
        title: t('Aplikasi Chatbot AI sebagai Asisten Belajar', 'AI Chatbot App as a Study Assistant'),
        detail: t('Tools: AWS Kiro & Amazon Bedrock', 'Tools: AWS Kiro & Amazon Bedrock'),
      },
      {
        title: t('Aplikasi Manajemen Kelas (Planning & Front-end)', 'Class Management App (Planning & Front-end)'),
        detail: t('Tools: AWS Kiro & Amazon Bedrock', 'Tools: AWS Kiro & Amazon Bedrock'),
      },
      {
        title: t('Aplikasi Manajemen Kelas (Backend & Deployment)', 'Class Management App (Backend & Deployment)'),
        detail: t('Tools: AWS Kiro & Amazon Bedrock', 'Tools: AWS Kiro & Amazon Bedrock'),
      },
    ],
  },
];

export const competitionStages = [
  {
    quantity: 50,
    unit: t('sekolah', 'schools'),
    title: t('Penyisihan', 'Qualifying Round'),
    description: t(
      'Sebanyak 50 sekolah mengajukan gagasan inovasi dengan satu tim per sekolah.',
      '50 schools submit their innovation ideas, with one team per school.',
    ),
  },
  {
    quantity: 20,
    unit: t('gagasan', 'ideas'),
    title: t('Semifinal', 'Semifinal'),
    description: t(
      '20 gagasan terbaik terpilih mengikuti mentoring dan pengembangan prototipe.',
      'The 20 best ideas are selected for mentoring and prototype development.',
    ),
  },
  {
    quantity: 10,
    unit: t('tim', 'teams'),
    title: t('Final', 'Final'),
    description: t(
      '10 tim terbaik mendapatkan pendampingan lanjutan untuk menyempurnakan inovasi mereka.',
      'The 10 best teams receive further guidance to refine their innovations.',
    ),
  },
  {
    quantity: 10,
    unit: t('finalis', 'finalists'),
    title: t('Culminating Events', 'Culminating Events'),
    description: t(
      '10 finalis mempresentasikan gagasan dan mengikuti sesi wawancara di hadapan dewan juri untuk menentukan para pemenang.',
      'The 10 finalists present their ideas and are interviewed by a panel of judges, who decide the winners.',
    ),
  },
];

export const featuredProjects = [
  {
    title: 'Learn to Earn',
    image: learnToEarn,
    alt: 'Tampilan aplikasi Study Buddy AI Agent dari proyek Learn to Earn',
    position: '50% 30%',
    school: 'SMAN 2 Cibinong — So Learn Team',
    award: t('Juara 1 · AI Hackathon 2025', '1st Place · AI Hackathon 2025'),
    medal: 'gold',
    description: t(
      'Aplikasi berbasis web yang mengintegrasikan AI, gamifikasi, dan pembelajaran interaktif untuk mempermudah administrasi guru serta meningkatkan kemandirian dan motivasi belajar siswa.',
      'A web app that combines AI, gamification, and interactive learning to ease teachers’ administrative work and boost students’ independence and motivation to learn.',
    ),
    features: ['SolveWise AI', 'Gamified Learning', 'Interactive Learning Designer'],
  },
  {
    title: 'Si Pintar',
    image: siPintar,
    alt: 'Tampilan deteksi wajah di kelas oleh aplikasi Si Pintar',
    position: '50% 40%',
    school: 'SMKN 1 Cimahi — JSC Team',
    award: t('Juara 2 · AI Hackathon 2025', '2nd Place · AI Hackathon 2025'),
    medal: 'silver',
    description: t(
      'Aplikasi berbasis AI yang terintegrasi dengan CCTV sekolah untuk mengotomatisasi absensi dan memantau aktivitas siswa selama kegiatan belajar di sekolah.',
      'An AI app connected to school CCTV that automates attendance and monitors student activity during lessons.',
    ),
    features: ['Automated Attendance', 'Behavior Monitoring', 'WhatsApp Integration'],
  },
  {
    title: 'Siap.In',
    image: siapIn,
    alt: 'Tampilan beranda platform Siap.In',
    position: '50% 20%',
    school: 'SMAN 4 Depok — STEVIA Team',
    award: t('Juara 3 · AI Hackathon 2025', '3rd Place · AI Hackathon 2025'),
    medal: 'bronze',
    description: t(
      'Platform informasi pendidikan tinggi yang terintegrasi dengan sekolah untuk membantu siswa mengeksplorasi jalur masuk perguruan tinggi, universitas, program studi, dan informasi alumni.',
      'A higher-education information platform connected to schools that helps students explore university admission pathways, universities, study programs, and alumni information.',
    ),
    features: ['Admission Pathways', 'Universities Directory', 'Study Programs', 'News Updates', 'Alumni Database'],
  },
  {
    title: 'Surgeon',
    image: surgeon,
    alt: 'Siswa memperagakan sarung tangan penerjemah bahasa isyarat Surgeon',
    position: '50% 40%',
    school: 'Cahaya Rancamaya Islamic Boarding School, Bogor — Gorillas Team',
    award: t('Juara 1 · STEAMInFest 2023', '1st Place · STEAMInFest 2023'),
    medal: 'gold',
    description: t(
      'Perangkat penerjemah bahasa isyarat berbasis Arduino Nano dan sensor gerak untuk membantu penyandang tunarungu berkomunikasi, mendukung komunikasi inklusif, dan memperluas kesempatan kerja bagi komunitas tunarungu.',
      'A sign-language translation device built on Arduino Nano and motion sensors that helps deaf people communicate, supports inclusive communication, and widens job opportunities for the deaf community.',
    ),
    features: ['Motion Detection', 'Inclusive Communication', 'Future Development'],
  },
];

export const faqs: { question: Txt; answer: Txt }[] = [
  {
    question: t('Siapa yang dapat mengikuti program ini?', 'Who can join this program?'),
    answer: t(
      'Guru dan siswa SMA/SMK dari 50 sekolah peserta. Sebanyak 40 sekolah berada di Jawa Barat dan 10 sekolah lainnya di DKI Jakarta, Banten, Jawa Tengah, DI Yogyakarta, dan Jawa Timur. Sekolah peserta ditetapkan melalui koordinasi PJI dengan pemerintah daerah.',
      'Teachers and students from 50 participating senior high and vocational schools. 40 schools are in West Java and the other 10 are in DKI Jakarta, Banten, Central Java, DI Yogyakarta, and East Java. Participating schools are set through PJI’s coordination with local governments.',
    ),
  },
  {
    question: t('Apakah peserta harus bisa coding?', 'Do participants need to know how to code?'),
    answer: t(
      'Tidak. Pembelajaran dimulai dari literasi AI, mulai dari konsep, cara kerja, hingga etika penggunaannya. Setelah itu siswa praktik membangun situs web atau aplikasi dengan bantuan platform AI.',
      'No. Learning starts with AI literacy: the concepts, how AI works, and how to use it ethically. Students then practice building websites or apps with the help of AI platforms.',
    ),
  },
  {
    question: t('Seperti apa kegiatan belajarnya?', 'What do the learning activities look like?'),
    answer: t(
      'Guru yang telah dilatih menerapkan kurikulum di kelas pada Oktober–Desember 2026. Siswa mempelajari konsep literasi AI dan mengerjakan proyek berbasis AI, dengan observasi bulanan dari PJI.',
      'Trained teachers apply the curriculum in class from October to December 2026. Students learn AI literacy concepts and work on AI-based projects, with monthly observation by PJI.',
    ),
  },
  {
    question: t('Apa yang didapatkan oleh guru?', 'What do teachers receive?'),
    answer: t(
      'Pelatihan luring (Training of Teachers) di Bandung, paket kurikulum berisi panduan guru, slide presentasi, dan lembar kerja siswa, serta pendampingan dari PJI. Lima guru terbaik dipilih menjadi Ambassador Program STEM Capacity Building.',
      'In-person training (Training of Teachers) in Bandung, a curriculum package with a teacher guide, presentation slides, and student worksheets, plus mentoring from PJI. The five best teachers are chosen as Ambassadors of the STEM Capacity Building Program.',
    ),
  },
  {
    question: t('Bagaimana alur AI Hackathon?', 'How does the AI Hackathon work?'),
    answer: t(
      'Pada penyisihan (Februari–Maret 2027), 50 sekolah mengirim concept paper. Pada semifinal (April–Mei 2027), 20 tim mengikuti mentoring PJI dan AWS, membuat prototipe, serta menyiapkan video pitch 3 menit. Pada final (Juni 2027), 10 tim mempresentasikan karya dan diwawancarai juri dari AWS dan profesional teknologi digital.',
      'In the qualifying round (February–March 2027), 50 schools send in a concept paper. In the semifinal (April–May 2027), 20 teams get mentoring from PJI and AWS, build a prototype, and prepare a 3-minute video pitch. In the final (June 2027), 10 teams present their work and are interviewed by judges from AWS and digital technology professionals.',
    ),
  },
  {
    question: t('Bagaimana cara mengirimkan karya?', 'How do we submit a project?'),
    answer: t(
      'Tim sekolah peserta mengisi formulir di bagian Kirim Karya dengan nama tim, asal sekolah, judul proyek, kategori, dan ringkasan solusi AI. Tim program meninjau setiap kiriman sebelum dipublikasikan di showcase.',
      'Participating school teams fill in the form in the Submit Project section with the team name, school, project title, category, and a summary of the AI solution. The program team reviews every submission before it is published in the showcase.',
    ),
  },
];
