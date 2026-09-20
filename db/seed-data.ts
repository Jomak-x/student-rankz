// Synthetic directory seed data.
//
// All institutions, people, courses and offerings below are fictional
// examples invented for development and demonstration. They describe no real
// university, person, course or offering, and carry no ratings or review
// counts of any kind.
//
// UUIDs are fixed constants so repeated runs produce identical rows.

export const UNIVERSITY_IDS = {
  asterheim: "00000000-0000-4000-8000-000000000001",
  bellenau: "00000000-0000-4000-8000-000000000002",
  vesimaki: "00000000-0000-4000-8000-000000000003",
} as const;

export const PROGRAMME_IDS = {
  asterheimBscInformatics: "00000000-0000-4000-8000-000000000011",
  asterheimMscDataEngineering: "00000000-0000-4000-8000-000000000012",
  bellenauBaEuropeanAffairs: "00000000-0000-4000-8000-000000000013",
  bellenauMscAppliedMathematics: "00000000-0000-4000-8000-000000000014",
  vesimakiMscSustainableSystems: "00000000-0000-4000-8000-000000000015",
  vesimakiBscSoftwareEngineering: "00000000-0000-4000-8000-000000000016",
} as const;

export const COURSE_IDS = {
  asterheimCs101: "00000000-0000-4000-8000-000000000101",
  asterheimCs210: "00000000-0000-4000-8000-000000000102",
  asterheimDe501: "00000000-0000-4000-8000-000000000103",
  asterheimDe560: "00000000-0000-4000-8000-000000000104",
  bellenauEa120: "00000000-0000-4000-8000-000000000105",
  bellenauEa240: "00000000-0000-4000-8000-000000000106",
  bellenauMa310: "00000000-0000-4000-8000-000000000107",
  bellenauMa355: "00000000-0000-4000-8000-000000000108",
  vesimakiSe150: "00000000-0000-4000-8000-000000000109",
  vesimakiSe230: "00000000-0000-4000-8000-000000000110",
  vesimakiSs410: "00000000-0000-4000-8000-000000000111",
  vesimakiSs430: "00000000-0000-4000-8000-000000000112",
} as const;

export const INSTRUCTOR_IDS = {
  asterheimLindqvist: "00000000-0000-4000-8000-000000000201",
  asterheimOkafor: "00000000-0000-4000-8000-000000000202",
  asterheimSteiner: "00000000-0000-4000-8000-000000000203",
  bellenauFontaine: "00000000-0000-4000-8000-000000000204",
  bellenauBenali: "00000000-0000-4000-8000-000000000205",
  vesimakiKorhonen: "00000000-0000-4000-8000-000000000206",
  vesimakiAaltonen: "00000000-0000-4000-8000-000000000207",
} as const;

export const OFFERING_IDS = {
  asterheimCs101Winter2025: "00000000-0000-4000-8000-000000000301",
  asterheimCs210Winter2025: "00000000-0000-4000-8000-000000000302",
  asterheimDe501Summer2026: "00000000-0000-4000-8000-000000000303",
  asterheimDe560Summer2026: "00000000-0000-4000-8000-000000000304",
  bellenauEa120Autumn2025: "00000000-0000-4000-8000-000000000305",
  bellenauEa240Spring2026: "00000000-0000-4000-8000-000000000306",
  bellenauMa310Autumn2025: "00000000-0000-4000-8000-000000000307",
  bellenauMa355Spring2026: "00000000-0000-4000-8000-000000000308",
  vesimakiSe150Autumn2025: "00000000-0000-4000-8000-000000000309",
  vesimakiSe230Spring2026: "00000000-0000-4000-8000-000000000310",
  vesimakiSs410Autumn2025: "00000000-0000-4000-8000-000000000311",
  vesimakiSs430Spring2026: "00000000-0000-4000-8000-000000000312",
} as const;

export const seedUniversities = [
  {
    id: UNIVERSITY_IDS.asterheim,
    slug: "asterheim-institute-of-technology",
    name: "Asterheim Institute of Technology (fictional example)",
    city: "Asterheim",
    country: "Germany",
    countryCode: "DE",
    foundedYear: 1971,
    type: "technical" as const,
    websiteUrl: "https://example.com/asterheim-it",
    description:
      "Fictional example institution used for development and demonstration of the directory. Invented engineering-focused university with synthetic programmes and courses.",
    studentCount: 9400,
  },
  {
    id: UNIVERSITY_IDS.bellenau,
    slug: "university-of-bellenau",
    name: "University of Bellenau (fictional example)",
    city: "Bellenau",
    country: "France",
    countryCode: "FR",
    foundedYear: 1898,
    type: "public" as const,
    websiteUrl: "https://example.com/bellenau",
    description:
      "Fictional example institution used for development and demonstration of the directory. Invented comprehensive university with synthetic programmes and courses.",
    studentCount: 21500,
  },
  {
    id: UNIVERSITY_IDS.vesimaki,
    slug: "vesimaki-university",
    name: "Vesimäki University (fictional example)",
    city: "Vesimäki",
    country: "Finland",
    countryCode: "FI",
    foundedYear: 1965,
    type: "public" as const,
    websiteUrl: "https://example.com/vesimaki",
    description:
      "Fictional example institution used for development and demonstration of the directory. Invented northern university focused on sustainability and software education.",
    studentCount: 7800,
  },
];

type SeedProgramme = {
  id: string;
  universityId: string;
  slug: string;
  name: string;
  level: "bachelor" | "master";
  description: string;
};

export const seedProgrammes: SeedProgramme[] = [
  {
    id: PROGRAMME_IDS.asterheimBscInformatics,
    universityId: UNIVERSITY_IDS.asterheim,
    slug: "bsc-informatics",
    name: "BSc Informatics",
    level: "bachelor",
    description:
      "Fictional bachelor programme covering programming foundations, algorithms and systems.",
  },
  {
    id: PROGRAMME_IDS.asterheimMscDataEngineering,
    universityId: UNIVERSITY_IDS.asterheim,
    slug: "msc-data-engineering",
    name: "MSc Data Engineering",
    level: "master",
    description:
      "Fictional master programme on distributed data infrastructure and applied machine learning.",
  },
  {
    id: PROGRAMME_IDS.bellenauBaEuropeanAffairs,
    universityId: UNIVERSITY_IDS.bellenau,
    slug: "ba-european-affairs",
    name: "BA European Affairs",
    level: "bachelor",
    description:
      "Fictional bachelor programme combining European law foundations with public policy practice.",
  },
  {
    id: PROGRAMME_IDS.bellenauMscAppliedMathematics,
    universityId: UNIVERSITY_IDS.bellenau,
    slug: "msc-applied-mathematics",
    name: "MSc Applied Mathematics",
    level: "master",
    description:
      "Fictional master programme on optimisation and statistical learning methods.",
  },
  {
    id: PROGRAMME_IDS.vesimakiMscSustainableSystems,
    universityId: UNIVERSITY_IDS.vesimaki,
    slug: "msc-sustainable-systems",
    name: "MSc Sustainable Systems",
    level: "master",
    description:
      "Fictional master programme on energy systems analysis and circular economy engineering.",
  },
  {
    id: PROGRAMME_IDS.vesimakiBscSoftwareEngineering,
    universityId: UNIVERSITY_IDS.vesimaki,
    slug: "bsc-software-engineering",
    name: "BSc Software Engineering",
    level: "bachelor",
    description:
      "Fictional bachelor programme on software construction, testing and team practice.",
  },
];

type SeedCourse = {
  id: string;
  universityId: string;
  code: string;
  name: string;
  department: string;
  credits: string;
  level: "bachelor" | "master";
  description: string;
};

export const seedCourses: SeedCourse[] = [
  {
    id: COURSE_IDS.asterheimCs101,
    universityId: UNIVERSITY_IDS.asterheim,
    code: "AIT-CS101",
    name: "Foundations of Programming",
    department: "Informatics",
    credits: "5.00",
    level: "bachelor",
    description:
      "Fictional introductory course on programming concepts, structure and small projects.",
  },
  {
    id: COURSE_IDS.asterheimCs210,
    universityId: UNIVERSITY_IDS.asterheim,
    code: "AIT-CS210",
    name: "Algorithms and Data Structures",
    department: "Informatics",
    credits: "10.00",
    level: "bachelor",
    description:
      "Fictional core course on algorithm analysis, classic data structures and complexity.",
  },
  {
    id: COURSE_IDS.asterheimDe501,
    universityId: UNIVERSITY_IDS.asterheim,
    code: "AIT-DE501",
    name: "Distributed Data Systems",
    department: "Informatics",
    credits: "7.50",
    level: "master",
    description:
      "Fictional master course on replication, partitioning and stream processing systems.",
  },
  {
    id: COURSE_IDS.asterheimDe560,
    universityId: UNIVERSITY_IDS.asterheim,
    code: "AIT-DE560",
    name: "Applied Machine Learning",
    department: "Informatics",
    credits: "6.00",
    level: "master",
    description:
      "Fictional master course on supervised learning pipelines and model evaluation.",
  },
  {
    id: COURSE_IDS.bellenauEa120,
    universityId: UNIVERSITY_IDS.bellenau,
    code: "UB-EA120",
    name: "Foundations of European Law",
    department: "Law and Politics",
    credits: "6.00",
    level: "bachelor",
    description:
      "Fictional introductory course on EU institutions, legal sources and case reasoning.",
  },
  {
    id: COURSE_IDS.bellenauEa240,
    universityId: UNIVERSITY_IDS.bellenau,
    code: "UB-EA240",
    name: "Public Policy in Practice",
    department: "Law and Politics",
    credits: "6.00",
    level: "bachelor",
    description:
      "Fictional project course simulating policy drafting, negotiation and evaluation.",
  },
  {
    id: COURSE_IDS.bellenauMa310,
    universityId: UNIVERSITY_IDS.bellenau,
    code: "UB-MA310",
    name: "Optimisation Methods",
    department: "Mathematics",
    credits: "7.50",
    level: "master",
    description:
      "Fictional master course on convex optimisation, duality and numerical methods.",
  },
  {
    id: COURSE_IDS.bellenauMa355,
    universityId: UNIVERSITY_IDS.bellenau,
    code: "UB-MA355",
    name: "Statistical Learning",
    department: "Mathematics",
    credits: "6.00",
    level: "master",
    description:
      "Fictional master course on regression, regularisation and model selection theory.",
  },
  {
    id: COURSE_IDS.vesimakiSe150,
    universityId: UNIVERSITY_IDS.vesimaki,
    code: "VU-SE150",
    name: "Introduction to Software Engineering",
    department: "Software Engineering",
    credits: "5.00",
    level: "bachelor",
    description:
      "Fictional introductory course on version control, testing and collaborative development.",
  },
  {
    id: COURSE_IDS.vesimakiSe230,
    universityId: UNIVERSITY_IDS.vesimaki,
    code: "VU-SE230",
    name: "Software Architecture and Quality",
    department: "Software Engineering",
    credits: "5.00",
    level: "bachelor",
    description:
      "Fictional course on architectural styles, quality attributes and refactoring practice.",
  },
  {
    id: COURSE_IDS.vesimakiSs410,
    universityId: UNIVERSITY_IDS.vesimaki,
    code: "VU-SS410",
    name: "Energy Systems Analysis",
    department: "Sustainability",
    credits: "5.00",
    level: "master",
    description:
      "Fictional master course modelling electricity markets and renewable integration.",
  },
  {
    id: COURSE_IDS.vesimakiSs430,
    universityId: UNIVERSITY_IDS.vesimaki,
    code: "VU-SS430",
    name: "Circular Economy Engineering",
    department: "Sustainability",
    credits: "5.00",
    level: "master",
    description:
      "Fictional master course on material cycles, lifecycle assessment and design.",
  },
];

type SeedProgrammeCourse = {
  programmeId: string;
  courseId: string;
  universityId: string;
  status: "required" | "elective";
};

export const seedProgrammeCourses: SeedProgrammeCourse[] = [
  {
    programmeId: PROGRAMME_IDS.asterheimBscInformatics,
    courseId: COURSE_IDS.asterheimCs101,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.asterheimBscInformatics,
    courseId: COURSE_IDS.asterheimCs210,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.asterheimBscInformatics,
    courseId: COURSE_IDS.asterheimDe560,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "elective",
  },
  {
    programmeId: PROGRAMME_IDS.asterheimMscDataEngineering,
    courseId: COURSE_IDS.asterheimDe501,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.asterheimMscDataEngineering,
    courseId: COURSE_IDS.asterheimDe560,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.asterheimMscDataEngineering,
    courseId: COURSE_IDS.asterheimCs210,
    universityId: UNIVERSITY_IDS.asterheim,
    status: "elective",
  },
  {
    programmeId: PROGRAMME_IDS.bellenauBaEuropeanAffairs,
    courseId: COURSE_IDS.bellenauEa120,
    universityId: UNIVERSITY_IDS.bellenau,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.bellenauBaEuropeanAffairs,
    courseId: COURSE_IDS.bellenauEa240,
    universityId: UNIVERSITY_IDS.bellenau,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.bellenauMscAppliedMathematics,
    courseId: COURSE_IDS.bellenauMa310,
    universityId: UNIVERSITY_IDS.bellenau,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.bellenauMscAppliedMathematics,
    courseId: COURSE_IDS.bellenauMa355,
    universityId: UNIVERSITY_IDS.bellenau,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.bellenauMscAppliedMathematics,
    courseId: COURSE_IDS.bellenauEa240,
    universityId: UNIVERSITY_IDS.bellenau,
    status: "elective",
  },
  {
    programmeId: PROGRAMME_IDS.vesimakiMscSustainableSystems,
    courseId: COURSE_IDS.vesimakiSs410,
    universityId: UNIVERSITY_IDS.vesimaki,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.vesimakiMscSustainableSystems,
    courseId: COURSE_IDS.vesimakiSs430,
    universityId: UNIVERSITY_IDS.vesimaki,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.vesimakiBscSoftwareEngineering,
    courseId: COURSE_IDS.vesimakiSe150,
    universityId: UNIVERSITY_IDS.vesimaki,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.vesimakiBscSoftwareEngineering,
    courseId: COURSE_IDS.vesimakiSe230,
    universityId: UNIVERSITY_IDS.vesimaki,
    status: "required",
  },
  {
    programmeId: PROGRAMME_IDS.vesimakiBscSoftwareEngineering,
    courseId: COURSE_IDS.vesimakiSs430,
    universityId: UNIVERSITY_IDS.vesimaki,
    status: "elective",
  },
];

type SeedInstructor = {
  id: string;
  universityId: string;
  slug: string;
  fullName: string;
  title: string;
  department: string;
  bio: string;
};

export const seedInstructors: SeedInstructor[] = [
  {
    id: INSTRUCTOR_IDS.asterheimLindqvist,
    universityId: UNIVERSITY_IDS.asterheim,
    slug: "mara-lindqvist",
    fullName: "Prof. Mara Lindqvist",
    title: "Full Professor",
    department: "Informatics",
    bio: "Fictional instructor profile for demonstration. Invented distributed-systems researcher who leads the data engineering curriculum.",
  },
  {
    id: INSTRUCTOR_IDS.asterheimOkafor,
    universityId: UNIVERSITY_IDS.asterheim,
    slug: "jonas-okafor",
    fullName: "Dr. Jonas Okafor",
    title: "Senior Lecturer",
    department: "Informatics",
    bio: "Fictional instructor profile for demonstration. Invented teacher of algorithms known for structured exercise sessions.",
  },
  {
    id: INSTRUCTOR_IDS.asterheimSteiner,
    universityId: UNIVERSITY_IDS.asterheim,
    slug: "petra-steiner",
    fullName: "Dr. Petra Steiner",
    title: "Lecturer",
    department: "Informatics",
    bio: "Fictional instructor profile for demonstration. Invented applied machine learning lecturer and project supervisor.",
  },
  {
    id: INSTRUCTOR_IDS.bellenauFontaine,
    universityId: UNIVERSITY_IDS.bellenau,
    slug: "claire-fontaine",
    fullName: "Prof. Claire Fontaine",
    title: "Full Professor",
    department: "Law and Politics",
    bio: "Fictional instructor profile for demonstration. Invented European law scholar coordinating the affairs programme.",
  },
  {
    id: INSTRUCTOR_IDS.bellenauBenali,
    universityId: UNIVERSITY_IDS.bellenau,
    slug: "malik-benali",
    fullName: "Dr. Malik Benali",
    title: "Associate Professor",
    department: "Mathematics",
    bio: "Fictional instructor profile for demonstration. Invented optimisation researcher and lecturer.",
  },
  {
    id: INSTRUCTOR_IDS.vesimakiKorhonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    slug: "aino-korhonen",
    fullName: "Dr. Aino Korhonen",
    title: "University Lecturer",
    department: "Software Engineering",
    bio: "Fictional instructor profile for demonstration. Invented software engineering educator focused on team-based courses.",
  },
  {
    id: INSTRUCTOR_IDS.vesimakiAaltonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    slug: "timo-aaltonen",
    fullName: "Prof. Timo Aaltonen",
    title: "Full Professor",
    department: "Sustainability",
    bio: "Fictional instructor profile for demonstration. Invented energy systems analyst teaching the sustainability curriculum.",
  },
];

type SeedOffering = {
  id: string;
  courseId: string;
  universityId: string;
  academicYear: number;
  term: string;
  startsOn: string;
  endsOn: string;
};

export const seedOfferings: SeedOffering[] = [
  {
    id: OFFERING_IDS.asterheimCs101Winter2025,
    courseId: COURSE_IDS.asterheimCs101,
    universityId: UNIVERSITY_IDS.asterheim,
    academicYear: 2025,
    term: "winter",
    startsOn: "2025-10-01",
    endsOn: "2026-01-31",
  },
  {
    id: OFFERING_IDS.asterheimCs210Winter2025,
    courseId: COURSE_IDS.asterheimCs210,
    universityId: UNIVERSITY_IDS.asterheim,
    academicYear: 2025,
    term: "winter",
    startsOn: "2025-10-01",
    endsOn: "2026-02-28",
  },
  {
    id: OFFERING_IDS.asterheimDe501Summer2026,
    courseId: COURSE_IDS.asterheimDe501,
    universityId: UNIVERSITY_IDS.asterheim,
    academicYear: 2026,
    term: "summer",
    startsOn: "2026-04-01",
    endsOn: "2026-07-15",
  },
  {
    id: OFFERING_IDS.asterheimDe560Summer2026,
    courseId: COURSE_IDS.asterheimDe560,
    universityId: UNIVERSITY_IDS.asterheim,
    academicYear: 2026,
    term: "summer",
    startsOn: "2026-04-01",
    endsOn: "2026-06-30",
  },
  {
    id: OFFERING_IDS.bellenauEa120Autumn2025,
    courseId: COURSE_IDS.bellenauEa120,
    universityId: UNIVERSITY_IDS.bellenau,
    academicYear: 2025,
    term: "autumn",
    startsOn: "2025-09-01",
    endsOn: "2025-12-19",
  },
  {
    id: OFFERING_IDS.bellenauEa240Spring2026,
    courseId: COURSE_IDS.bellenauEa240,
    universityId: UNIVERSITY_IDS.bellenau,
    academicYear: 2026,
    term: "spring",
    startsOn: "2026-01-05",
    endsOn: "2026-04-30",
  },
  {
    id: OFFERING_IDS.bellenauMa310Autumn2025,
    courseId: COURSE_IDS.bellenauMa310,
    universityId: UNIVERSITY_IDS.bellenau,
    academicYear: 2025,
    term: "autumn",
    startsOn: "2025-09-01",
    endsOn: "2026-01-16",
  },
  {
    id: OFFERING_IDS.bellenauMa355Spring2026,
    courseId: COURSE_IDS.bellenauMa355,
    universityId: UNIVERSITY_IDS.bellenau,
    academicYear: 2026,
    term: "spring",
    startsOn: "2026-01-05",
    endsOn: "2026-05-29",
  },
  {
    id: OFFERING_IDS.vesimakiSe150Autumn2025,
    courseId: COURSE_IDS.vesimakiSe150,
    universityId: UNIVERSITY_IDS.vesimaki,
    academicYear: 2025,
    term: "autumn",
    startsOn: "2025-09-01",
    endsOn: "2025-12-12",
  },
  {
    id: OFFERING_IDS.vesimakiSe230Spring2026,
    courseId: COURSE_IDS.vesimakiSe230,
    universityId: UNIVERSITY_IDS.vesimaki,
    academicYear: 2026,
    term: "spring",
    startsOn: "2026-01-05",
    endsOn: "2026-05-08",
  },
  {
    id: OFFERING_IDS.vesimakiSs410Autumn2025,
    courseId: COURSE_IDS.vesimakiSs410,
    universityId: UNIVERSITY_IDS.vesimaki,
    academicYear: 2025,
    term: "autumn",
    startsOn: "2025-09-01",
    endsOn: "2025-12-19",
  },
  {
    id: OFFERING_IDS.vesimakiSs430Spring2026,
    courseId: COURSE_IDS.vesimakiSs430,
    universityId: UNIVERSITY_IDS.vesimaki,
    academicYear: 2026,
    term: "spring",
    startsOn: "2026-01-05",
    endsOn: "2026-05-08",
  },
];

type SeedOfferingInstructor = {
  offeringId: string;
  instructorId: string;
  universityId: string;
  role: string;
};

export const seedOfferingInstructors: SeedOfferingInstructor[] = [
  {
    offeringId: OFFERING_IDS.asterheimCs101Winter2025,
    instructorId: INSTRUCTOR_IDS.asterheimOkafor,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.asterheimCs210Winter2025,
    instructorId: INSTRUCTOR_IDS.asterheimOkafor,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.asterheimCs210Winter2025,
    instructorId: INSTRUCTOR_IDS.asterheimSteiner,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "teaching_assistant",
  },
  {
    offeringId: OFFERING_IDS.asterheimDe501Summer2026,
    instructorId: INSTRUCTOR_IDS.asterheimLindqvist,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.asterheimDe560Summer2026,
    instructorId: INSTRUCTOR_IDS.asterheimSteiner,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.asterheimDe560Summer2026,
    instructorId: INSTRUCTOR_IDS.asterheimLindqvist,
    universityId: UNIVERSITY_IDS.asterheim,
    role: "co_lecturer",
  },
  {
    offeringId: OFFERING_IDS.bellenauEa120Autumn2025,
    instructorId: INSTRUCTOR_IDS.bellenauFontaine,
    universityId: UNIVERSITY_IDS.bellenau,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.bellenauEa240Spring2026,
    instructorId: INSTRUCTOR_IDS.bellenauFontaine,
    universityId: UNIVERSITY_IDS.bellenau,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.bellenauMa310Autumn2025,
    instructorId: INSTRUCTOR_IDS.bellenauBenali,
    universityId: UNIVERSITY_IDS.bellenau,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.bellenauMa355Spring2026,
    instructorId: INSTRUCTOR_IDS.bellenauBenali,
    universityId: UNIVERSITY_IDS.bellenau,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.vesimakiSe150Autumn2025,
    instructorId: INSTRUCTOR_IDS.vesimakiKorhonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.vesimakiSe230Spring2026,
    instructorId: INSTRUCTOR_IDS.vesimakiKorhonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.vesimakiSs410Autumn2025,
    instructorId: INSTRUCTOR_IDS.vesimakiAaltonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    role: "lecturer",
  },
  {
    offeringId: OFFERING_IDS.vesimakiSs430Spring2026,
    instructorId: INSTRUCTOR_IDS.vesimakiAaltonen,
    universityId: UNIVERSITY_IDS.vesimaki,
    role: "lecturer",
  },
];
