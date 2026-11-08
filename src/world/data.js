// Everything the visitor can discover. Each stop sits on the globe at lat/lng.
// Home and DePaul are real places; the project stops are made-up islands.
export const CONTACT = {
  email: 'chawaphongk@gmail.com',
  phoneDisplay: '+66 82 283 9157',
  phoneHref: '+66822839157',
  instagram: 'https://instagram.com/earth_cha',
  github: 'https://github.com/earthchawa',
};

export const RESUME_URL = '/chawaphong-resume-2026.pdf';

export const SKILL_GROUPS = [
  { label: 'Frontend', items: ['HTML / CSS', 'JavaScript', 'React', 'Tailwind CSS', 'Three.js / WebGL', 'PWA'] },
  { label: 'Backend', items: ['Node.js', 'Python', 'Java', 'Google Apps Script', 'GitHub Actions'] },
  { label: 'AI', items: ['Gemini API', 'Agentic Workflows', 'AI-assisted Development'] },
  { label: 'Design', items: ['UI/UX Design', 'Figma', 'Prototyping'] },
];

// model: which little 3D landmark to build (see landmarks.js)
// color: beacon + chip color
export const STOPS = [
  {
    id: 'home',
    model: 'academy',
    color: '#e8a35a',
    lat: 14.53, lng: 100.91,
    place: 'Saraburi, Thailand',
    title: 'Home Base',
    kicker: 'Hi, I’m Earth',
    image: '/nkrafa.jpg',
    imageAlt: 'NKRAFA campus from above',
    body: [
      'Chawaphong on paper, Earth to everyone else. I’m a frontend developer, UX/UI designer and lecturer at the Navaminda Kasatriyadhiraj Royal Air Force Academy (NKRAFA).',
      'I earned my BS in Computer Science here, and now I teach air cadets in the Department of Computer Science and Mathematics.',
    ],
    skills: true,
  },
  {
    id: 'depaul',
    model: 'city',
    color: '#5ea7e8',
    lat: 41.88, lng: -87.63,
    place: 'Chicago, USA',
    title: 'DePaul University',
    kicker: 'Level up abroad',
    image: '/mastergrad.jpg',
    imageAlt: 'Graduation by the Chicago River',
    body: [
      'I flew to Chicago for a Master’s in Software Engineering at DePaul University, and graduated in 2024.',
      'Studying abroad widened how I think about technology, teamwork and user-centred design.',
    ],
  },
  {
    id: 'veha',
    model: 'hangar',
    color: '#7cc576',
    lat: 11, lng: 87,
    place: 'Hangar Island',
    title: 'V.E.H.A.',
    kicker: 'Project · In progress',
    tags: ['Next.js', 'PostgreSQL', 'EdTech'],
    body: [
      'Virtual Educational Hangar for Air-cadets: NKRAFA’s self-hosted online classroom.',
      'Course materials, assignments with Thai-aware similarity checks, a weighted gradebook, and online quizzes with anti-cheat and Safe Exam Browser support. Phase 4 of 5 is done.',
    ],
    links: [{ label: 'Code on GitHub', url: 'https://github.com/earthchawa/nkrafa-ai-classroom' }],
  },
  {
    id: 'nidnoi',
    model: 'elephant',
    color: '#f08ca8',
    lat: 4, lng: 121,
    place: 'Elephant Atoll',
    title: 'Nidnoi App',
    kicker: 'Project · PWA + Agentic AI',
    tags: ['PWA', 'Gemini API', 'Automation'],
    image: '/projects/nidnoi.jpg',
    imageAlt: 'Nidnoi app screenshot',
    contain: true,
    body: ['A mobile-first app for learning Thai in bite-sized daily lessons, with fresh content generated every morning by Gemini.'],
    links: [{ label: 'Open the app', url: 'https://nidnoi-app.vercel.app/' }],
  },
  {
    id: 'namu',
    model: 'ship',
    color: '#f2c94c',
    lat: 26, lng: -152,
    place: 'Mid-Pacific',
    title: 'Consult Namu',
    kicker: 'Project · Client website',
    tags: ['Web Design', 'Frontend'],
    image: '/projects/consultnamu.jpg',
    imageAlt: 'Consult Namu website screenshot',
    contain: true,
    body: ['Website for a sourcing consultancy that helps American brands produce and inspect their goods in Asia.'],
    links: [{ label: 'Visit consultnamu.com', url: 'https://consultnamu.com/' }],
  },
  {
    id: 'l9',
    model: 'castle',
    color: '#a98be8',
    lat: -34, lng: 68,
    place: 'Guild Keep',
    title: 'L9 Check-in Bot',
    kicker: 'Project · Discord bot',
    tags: ['Google Apps Script', 'Sheets', 'Discord'],
    image: '/projects/discord-checkin-bot.jpg',
    imageAlt: 'Check-in dashboard screenshot',
    contain: true,
    body: ['I play games too. This bot tracks my guild’s attendance from Discord voice channels into a live dashboard, running serverless on Google Apps Script and Sheets.'],
    links: [{ label: 'Code on GitHub', url: 'https://github.com/earthchawa/L9-discord-checkin-bot' }],
  },
  {
    id: 'camera',
    model: 'camera',
    color: '#ef7d6b',
    lat: -24, lng: 136,
    place: 'Darkroom Bay',
    title: 'Shot on 35mm',
    kicker: 'Off duty',
    gallery: [
      { src: '/film.jpg', caption: 'Chicago skyline on film' },
      { src: '/winter.jpg', caption: 'Midwest road trip' },
      { src: '/thaitea.jpg', caption: 'Cha Yen, always' },
      { src: '/flyingtraining.jpg', caption: 'Flight training days' },
    ],
    body: ['When I’m not coding I’m shooting film, travelling, or holding a Thai tea.'],
  },
  {
    id: 'contact',
    model: 'lighthouse',
    color: '#ff6b5e',
    lat: 37, lng: -33,
    place: 'Signal Point',
    title: 'Say hello',
    kicker: 'Let’s build something',
    body: ['Open to collaborations, freelance work and teaching. The fastest way to reach me is email.'],
    contact: true,
  },
];

export const START = { lat: -16, lng: 74, toward: 'home' };
