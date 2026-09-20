// Demo fixture data — sample data only, not real reviews or rankings

export type University = {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  founded: number;
  type: "public" | "private" | "technical";
  website: string;
  description: string;
  studentCount: number;
  scores: {
    overall: number;
    teaching: number;
    support: number;
    facilities: number;
    administration: number;
    value: number;
    socialLife: number;
  };
  reviewCount: number;
  tags: string[];
};

export type Course = {
  id: string;
  universityId: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  level: "bachelor" | "master" | "phd";
  semester: string;
  instructorIds: string[];
  scores: {
    overall: number;
    workload: number;
    organisation: number;
    clarity: number;
    assessmentFairness: number;
  };
  reviewCount: number;
  tags: string[];
  description: string;
};

export type Instructor = {
  id: string;
  universityId: string;
  name: string;
  role: string;
  department: string;
  courses: string[];
  scores: {
    overall: number;
    clarity: number;
    support: number;
    expertise: number;
    engagement: number;
  };
  reviewCount: number;
  bio: string;
};

export type Review = {
  id: string;
  targetType: "university" | "course" | "instructor";
  targetId: string;
  authorAlias: string;
  programme?: string;
  year: number;
  rating: number;
  title: string;
  body: string;
  pros?: string;
  cons?: string;
  verified: boolean;
};

export type PendingReview = {
  id: string;
  targetType: "university" | "course" | "instructor";
  targetId: string;
  targetName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};

// ─── Universities ────────────────────────────────────────────────────────────

export const universities: University[] = [
  {
    id: "tum",
    name: "Technical University of Munich",
    city: "Munich",
    country: "Germany",
    countryCode: "DE",
    founded: 1868,
    type: "technical",
    website: "https://www.tum.de",
    description:
      "One of Germany's top technical universities with a strong focus on engineering, natural sciences and technology. Known for industry partnerships and research excellence.",
    studentCount: 50000,
    scores: {
      overall: 4.3,
      teaching: 4.2,
      support: 3.9,
      facilities: 4.6,
      administration: 3.7,
      value: 4.4,
      socialLife: 3.8,
    },
    reviewCount: 312,
    tags: ["Engineering", "Computer Science", "Research", "Industry links"],
  },
  {
    id: "unibo",
    name: "University of Bologna",
    city: "Bologna",
    country: "Italy",
    countryCode: "IT",
    founded: 1088,
    type: "public",
    website: "https://www.unibo.it",
    description:
      "The oldest university in the Western world, offering broad programmes across arts, sciences and law. Strong international presence and vibrant student culture.",
    studentCount: 87000,
    scores: {
      overall: 4.0,
      teaching: 4.1,
      support: 3.6,
      facilities: 3.8,
      administration: 3.2,
      value: 4.3,
      socialLife: 4.5,
    },
    reviewCount: 287,
    tags: ["History", "Law", "Arts", "International"],
  },
  {
    id: "kth",
    name: "KTH Royal Institute of Technology",
    city: "Stockholm",
    country: "Sweden",
    countryCode: "SE",
    founded: 1827,
    type: "technical",
    website: "https://www.kth.se",
    description:
      "Sweden's largest technical university, ranked among Europe's leading engineering schools. Known for innovation, sustainability focus, and English-taught masters.",
    studentCount: 13000,
    scores: {
      overall: 4.4,
      teaching: 4.3,
      support: 4.2,
      facilities: 4.5,
      administration: 4.0,
      value: 4.1,
      socialLife: 3.9,
    },
    reviewCount: 198,
    tags: ["Engineering", "Sustainability", "Innovation", "English programmes"],
  },
  {
    id: "sorbonne",
    name: "Sorbonne University",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    founded: 1257,
    type: "public",
    website: "https://www.sorbonne-universite.fr",
    description:
      "One of Paris's most prestigious universities, renowned for humanities, sciences and medicine. Rich academic tradition in a world-class city.",
    studentCount: 55000,
    scores: {
      overall: 4.1,
      teaching: 4.4,
      support: 3.5,
      facilities: 3.9,
      administration: 3.1,
      value: 3.8,
      socialLife: 4.6,
    },
    reviewCount: 241,
    tags: ["Humanities", "Sciences", "Medicine", "Research"],
  },
  {
    id: "umaastricht",
    name: "Maastricht University",
    city: "Maastricht",
    country: "Netherlands",
    countryCode: "NL",
    founded: 1976,
    type: "public",
    website: "https://www.maastrichtuniversity.nl",
    description:
      "Known for its Problem-Based Learning (PBL) approach. Highly international with over 50% international students. Strong in business, law and health sciences.",
    studentCount: 22000,
    scores: {
      overall: 4.2,
      teaching: 4.0,
      support: 4.3,
      facilities: 4.1,
      administration: 4.0,
      value: 3.9,
      socialLife: 4.2,
    },
    reviewCount: 176,
    tags: ["Problem-Based Learning", "International", "Business", "Law"],
  },
  {
    id: "uhelsinki",
    name: "University of Helsinki",
    city: "Helsinki",
    country: "Finland",
    countryCode: "FI",
    founded: 1640,
    type: "public",
    website: "https://www.helsinki.fi",
    description:
      "Finland's largest university and one of the leading research universities in Europe. Strong in natural sciences, medicine, humanities and social sciences. Known for highly developed student services and welfare.",
    studentCount: 36000,
    scores: {
      overall: 4.3,
      teaching: 4.2,
      support: 4.5,
      facilities: 4.3,
      administration: 4.2,
      value: 4.6,
      socialLife: 3.8,
    },
    reviewCount: 142,
    tags: ["Research", "Natural sciences", "Medicine", "Nordic"],
  },
  {
    id: "lmu",
    name: "Ludwig Maximilian University",
    city: "Munich",
    country: "Germany",
    countryCode: "DE",
    founded: 1472,
    type: "public",
    website: "https://www.lmu.de",
    description:
      "One of Germany's oldest and most prestigious universities with comprehensive faculties. Strong in humanities, social sciences, medicine and natural sciences.",
    studentCount: 52000,
    scores: {
      overall: 4.1,
      teaching: 4.0,
      support: 3.8,
      facilities: 4.0,
      administration: 3.5,
      value: 4.5,
      socialLife: 4.0,
    },
    reviewCount: 228,
    tags: ["Comprehensive", "Medicine", "Humanities", "Research"],
  },
];

// ─── Courses ─────────────────────────────────────────────────────────────────

export const courses: Course[] = [
  {
    id: "tum-cs101",
    universityId: "tum",
    code: "IN0001",
    name: "Introduction to Informatics",
    department: "Informatics",
    credits: 5,
    level: "bachelor",
    semester: "Winter 2024/25",
    instructorIds: ["prof-mueller"],
    scores: {
      overall: 4.2,
      workload: 3.8,
      organisation: 4.4,
      clarity: 4.1,
      assessmentFairness: 4.0,
    },
    reviewCount: 78,
    tags: ["Foundational", "Programming", "Algorithms"],
    description:
      "Core informatics concepts including algorithms, data structures and programming fundamentals. Entry-level course for all Informatics students.",
  },
  {
    id: "tum-ml401",
    universityId: "tum",
    code: "IN2064",
    name: "Machine Learning",
    department: "Informatics",
    credits: 8,
    level: "master",
    semester: "Summer 2024",
    instructorIds: ["prof-mueller", "prof-wagner"],
    scores: {
      overall: 4.5,
      workload: 3.5,
      organisation: 4.3,
      clarity: 4.4,
      assessmentFairness: 4.6,
    },
    reviewCount: 65,
    tags: ["Machine Learning", "Statistics", "Python", "Challenging"],
    description:
      "Covers supervised and unsupervised learning, deep learning foundations and practical application. Students should have solid maths and programming background.",
  },
  {
    id: "kth-sys301",
    universityId: "kth",
    code: "EL2520",
    name: "Control Theory and Practice",
    department: "Electrical Engineering",
    credits: 7.5,
    level: "master",
    semester: "Period 1 2024",
    instructorIds: ["prof-lindqvist"],
    scores: {
      overall: 4.1,
      workload: 3.6,
      organisation: 4.0,
      clarity: 3.9,
      assessmentFairness: 4.3,
    },
    reviewCount: 42,
    tags: ["Control Systems", "Mathematics", "Lab work"],
    description:
      "Classical and modern control design. Combines lectures with hands-on laboratory sessions. Part of the Systems, Control and Robotics track.",
  },
  {
    id: "unibo-law201",
    universityId: "unibo",
    code: "14986",
    name: "European Constitutional Law",
    department: "Law",
    credits: 12,
    level: "master",
    semester: "Spring 2024",
    instructorIds: ["prof-rossi"],
    scores: {
      overall: 4.3,
      workload: 3.7,
      organisation: 4.2,
      clarity: 4.5,
      assessmentFairness: 4.1,
    },
    reviewCount: 55,
    tags: ["EU Law", "Constitutional", "Reading-heavy"],
    description:
      "Analysis of EU constitutional structures, fundamental rights and member state relations. Oral examination-based assessment.",
  },
  {
    id: "umaastricht-bus301",
    universityId: "umaastricht",
    code: "EBC2050",
    name: "Strategic Management",
    department: "Business & Economics",
    credits: 6.5,
    level: "bachelor",
    semester: "Period 3 2024",
    instructorIds: ["prof-janssen"],
    scores: {
      overall: 4.0,
      workload: 3.9,
      organisation: 4.3,
      clarity: 4.0,
      assessmentFairness: 3.8,
    },
    reviewCount: 61,
    tags: ["PBL", "Case studies", "Group work"],
    description:
      "Problem-Based Learning course covering corporate strategy, competitive dynamics and decision-making. Taught in small tutorial groups.",
  },
  {
    id: "sorbonne-inf201",
    universityId: "sorbonne",
    code: "LI301",
    name: "Advanced Algorithms",
    department: "Informatics",
    credits: 6,
    level: "master",
    semester: "S1 2024",
    instructorIds: ["prof-bernard"],
    scores: {
      overall: 4.4,
      workload: 3.4,
      organisation: 4.1,
      clarity: 4.3,
      assessmentFairness: 4.5,
    },
    reviewCount: 38,
    tags: ["Algorithms", "Complexity", "Theoretical"],
    description:
      "Advanced analysis of algorithms and computational complexity. Strong mathematical foundations required. Mixture of lectures and TD (directed work) sessions.",
  },
];

// ─── Instructors ─────────────────────────────────────────────────────────────

export const instructors: Instructor[] = [
  {
    id: "prof-mueller",
    universityId: "tum",
    name: "Prof. Dr. Anna Müller",
    role: "Full Professor",
    department: "Informatics",
    courses: ["tum-cs101", "tum-ml401"],
    scores: {
      overall: 4.4,
      clarity: 4.5,
      support: 4.2,
      expertise: 4.7,
      engagement: 4.3,
    },
    reviewCount: 89,
    bio: "Researches machine learning systems and their applications. Has led the ML course for six years and is known for clear explanations and extensive office hours.",
  },
  {
    id: "prof-wagner",
    universityId: "tum",
    name: "Dr. Tobias Wagner",
    role: "Assistant Professor",
    department: "Informatics",
    courses: ["tum-ml401"],
    scores: {
      overall: 4.1,
      clarity: 4.0,
      support: 4.4,
      expertise: 4.3,
      engagement: 3.9,
    },
    reviewCount: 45,
    bio: "Specialist in deep learning and neural network architectures. Co-teaches the Machine Learning course and leads project supervision.",
  },
  {
    id: "prof-lindqvist",
    universityId: "kth",
    name: "Prof. Erik Lindqvist",
    role: "Associate Professor",
    department: "Electrical Engineering",
    courses: ["kth-sys301"],
    scores: {
      overall: 4.2,
      clarity: 4.1,
      support: 4.3,
      expertise: 4.5,
      engagement: 4.0,
    },
    reviewCount: 52,
    bio: "Control systems specialist with industry background at Ericsson. Brings practical perspective to theoretical content. Known for responsive feedback.",
  },
  {
    id: "prof-rossi",
    universityId: "unibo",
    name: "Prof.ssa Elena Rossi",
    role: "Full Professor",
    department: "Law",
    courses: ["unibo-law201"],
    scores: {
      overall: 4.5,
      clarity: 4.7,
      support: 4.1,
      expertise: 4.8,
      engagement: 4.4,
    },
    reviewCount: 71,
    bio: "Leading EU constitutional law expert and author of several academic textbooks. Lectures are highly structured and engaging; oral exam preparation sessions are recommended.",
  },
  {
    id: "prof-janssen",
    universityId: "umaastricht",
    name: "Dr. Lotte Janssen",
    role: "Assistant Professor",
    department: "Business & Economics",
    courses: ["umaastricht-bus301"],
    scores: {
      overall: 3.9,
      clarity: 4.0,
      support: 4.2,
      expertise: 4.1,
      engagement: 3.8,
    },
    reviewCount: 47,
    bio: "Specialises in corporate strategy and organisational behaviour. Uses PBL format to facilitate case-based learning in small groups.",
  },
  {
    id: "prof-bernard",
    universityId: "sorbonne",
    name: "Prof. Jean-Luc Bernard",
    role: "Full Professor",
    department: "Informatics",
    courses: ["sorbonne-inf201"],
    scores: {
      overall: 4.3,
      clarity: 4.2,
      support: 3.8,
      expertise: 4.6,
      engagement: 4.1,
    },
    reviewCount: 38,
    bio: "Computational complexity theorist with publications in top CS venues. The course is demanding but rewards effort; TD sessions clarify lecture material significantly.",
  },
];

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews: Review[] = [
  // TUM university reviews
  {
    id: "r-tum-1",
    targetType: "university",
    targetId: "tum",
    authorAlias: "M.Sc. student, 2nd year",
    programme: "Informatics M.Sc.",
    year: 2024,
    rating: 5,
    title: "Excellent research infrastructure",
    body: "The labs and computing resources are world-class. Access to GPU clusters for my thesis was straightforward. Munich is expensive but the university experience more than makes up for it.",
    pros: "Facilities, industry connections, research opportunities",
    cons: "Bureaucracy can be slow, Munich cost of living",
    verified: true,
  },
  {
    id: "r-tum-2",
    targetType: "university",
    targetId: "tum",
    authorAlias: "Exchange student, Winter 2023",
    year: 2023,
    rating: 4,
    title: "Great technical focus, navigation takes time",
    body: "Came from the Netherlands for one semester. The academic level is genuinely high and professors are accessible. The campus is spread out and finding the right office for admin tasks took a few weeks to figure out.",
    pros: "Technical depth, professor accessibility",
    cons: "Admin navigation, campus spread",
    verified: true,
  },
  {
    id: "r-tum-3",
    targetType: "university",
    targetId: "tum",
    authorAlias: "Bachelor graduate, class of 2024",
    year: 2024,
    rating: 4,
    title: "Strong foundation, busy workload",
    body: "The bachelor programme is demanding in a good way. You leave with real skills. I found the support services helpful once I knew they existed — onboarding could be clearer for first-year students.",
    pros: "Rigorous curriculum, career services",
    cons: "First-year onboarding could be clearer",
    verified: true,
  },
  // KTH university reviews
  {
    id: "r-kth-1",
    targetType: "university",
    targetId: "kth",
    authorAlias: "M.Sc. student, international",
    programme: "Systems, Control and Robotics",
    year: 2024,
    rating: 5,
    title: "Best decision I made for my Master's",
    body: "English-taught masters, friendly international community, and genuinely impressive faculty. Stockholm is expensive but KTH is worth it. The sustainability focus is integrated into courses in a real way, not just a label.",
    pros: "English instruction, international community, sustainability",
    cons: "High cost of living in Stockholm",
    verified: true,
  },
  {
    id: "r-kth-2",
    targetType: "university",
    targetId: "kth",
    authorAlias: "Exchange student",
    year: 2023,
    rating: 4,
    title: "Well-organised and welcoming",
    body: "The admin for my exchange application was clearer than at many universities I looked at. Courses are project-heavy which suits me. The library and study spaces are excellent.",
    pros: "Organisation, study spaces, project work",
    cons: "Dark winters take adjustment",
    verified: true,
  },
  // Sorbonne reviews
  {
    id: "r-sorbonne-1",
    targetType: "university",
    targetId: "sorbonne",
    authorAlias: "L3 student, Informatics",
    year: 2024,
    rating: 4,
    title: "Demanding but rewarding academic environment",
    body: "Paris is incredible and the faculty are experts. The teaching style is very lecture-based — you need self-motivation. Administration is the weak point; getting a certificate took 6 weeks.",
    pros: "Academic prestige, Paris, expert faculty",
    cons: "Admin very slow, large lecture halls",
    verified: true,
  },
  // Maastricht reviews
  {
    id: "r-um-1",
    targetType: "university",
    targetId: "umaastricht",
    authorAlias: "3rd year bachelor student",
    programme: "Economics and Business Economics",
    year: 2024,
    rating: 4,
    title: "PBL actually works",
    body: "I was sceptical about problem-based learning before arriving. Three years in, I genuinely learn more from small-group discussion than from big lectures. The international mix in tutorials is a bonus.",
    pros: "PBL method, international student body, city size",
    cons: "Some tutors are better than others — quality varies",
    verified: true,
  },
  // Helsinki reviews
  {
    id: "r-uhelsinki-1",
    targetType: "university",
    targetId: "uhelsinki",
    authorAlias: "M.Sc. Data Science",
    year: 2024,
    rating: 5,
    title: "Outstanding student welfare and learning environment",
    body: "Finland has a completely different approach to university — the welfare support is exceptional and the tuition is free for EU students. Staff are approachable and the research facilities for natural sciences are impressive.",
    pros: "Student welfare, free tuition (EU), research quality",
    cons: "Winters are very dark; takes adjustment if you are from southern Europe",
    verified: true,
  },
  // Course reviews
  {
    id: "r-ml401-1",
    targetType: "course",
    targetId: "tum-ml401",
    authorAlias: "M.Sc. student",
    year: 2024,
    rating: 5,
    title: "Best ML course I've taken",
    body: "Prof. Müller's explanations are genuinely clear — she builds intuition before formalism. The exercises are challenging but well-calibrated. The exam was fair and matched lecture content.",
    pros: "Clear lectures, fair exam, good exercises",
    cons: "Heavy workload in the second half",
    verified: true,
  },
  {
    id: "r-ml401-2",
    targetType: "course",
    targetId: "tum-ml401",
    authorAlias: "International exchange student",
    year: 2024,
    rating: 4,
    title: "Solid course, brush up your linear algebra",
    body: "Make sure your linear algebra is strong before starting. The content is excellent and practical assignments use real datasets. Dr. Wagner is more responsive on the forum than in office hours.",
    pros: "Practical assignments, good online support",
    cons: "Prerequisites assumed rather than stated",
    verified: true,
  },
  {
    id: "r-kth-ctrl-1",
    targetType: "course",
    targetId: "kth-sys301",
    authorAlias: "M.Sc. SCR student",
    year: 2024,
    rating: 4,
    title: "Lab sessions make all the difference",
    body: "The lectures are dense but Prof. Lindqvist's lab sessions bring everything together. Attendance at lab is basically essential. The final exam format was a bit ambiguous but the grade distribution was reasonable.",
    pros: "Lab sessions, practical focus",
    cons: "Lecture pace is fast, exam instructions unclear",
    verified: true,
  },
  // Instructor reviews
  {
    id: "r-mueller-1",
    targetType: "instructor",
    targetId: "prof-mueller",
    authorAlias: "M.Sc. student",
    year: 2024,
    rating: 5,
    title: "Exceptional lecturer and mentor",
    body: "Prof. Müller is one of those rare lecturers who makes complex topics feel accessible. Office hours are well-attended because she actually engages with individual questions. Highly recommend taking any course she teaches.",
    pros: "Clarity, accessibility, genuine interest in students",
    cons: "Hard to get a thesis spot — popular supervisor",
    verified: true,
  },
  {
    id: "r-rossi-1",
    targetType: "instructor",
    targetId: "prof-rossi",
    authorAlias: "LL.M. student",
    year: 2024,
    rating: 5,
    title: "Sets a very high bar — in a good way",
    body: "Prof. Rossi's lectures are structured and dense with case law. She holds students to a high standard but gives clear guidance on what to study. Her own textbook is the best reference.",
    pros: "Expertise, structure, high expectations",
    cons: "Oral exam is intimidating; preparation sessions help",
    verified: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getUniversity(id: string): University | undefined {
  return universities.find((u) => u.id === id);
}

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function getInstructor(id: string): Instructor | undefined {
  return instructors.find((i) => i.id === id);
}

export function getCoursesByUniversity(universityId: string): Course[] {
  return courses.filter((c) => c.universityId === universityId);
}

export function getInstructorsByUniversity(universityId: string): Instructor[] {
  return instructors.filter((i) => i.universityId === universityId);
}

export function getReviewsByTarget(targetType: Review["targetType"], targetId: string): Review[] {
  return reviews.filter((r) => r.targetType === targetType && r.targetId === targetId);
}

export function getInstructorsByIds(ids: string[]): Instructor[] {
  return instructors.filter((i) => ids.includes(i.id));
}

export const countries = [...new Set(universities.map((u) => u.country))].sort();
export const allTags = [...new Set(universities.flatMap((u) => u.tags))].sort();
