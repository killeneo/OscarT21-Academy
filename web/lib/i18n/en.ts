import type { Messages } from "./ru";

// English UI strings. Brand name and sample cards are PLACEHOLDERS until real content is approved.
export const en: Messages = {
  meta: {
    title: "Mozaika — training, search and certification for tutors and social workers",
    description:
      "Online inclusion courses, a catalog of verified tutors and social workers, and certificates with qualification checks.",
  },
  common: {
    brand: "Mozaika",
    skipToContent: "Skip to main content",
  },
  nav: {
    label: "Main navigation",
    langLabel: "Choose language",
    about: "About",
    courses: "Courses",
    specialists: "Specialists",
    roles: "Who it is for",
    login: "Log in",
    signup: "Sign up",
  },
  hero: {
    titleA: "Training and search for",
    titleB: "verified",
    titleC: "tutors!",
    subtitle:
      "Inclusion courses, a catalog of specialists with verified qualifications and certificates you can confirm online. For parents, specialists and organizations.",
    primary: "Find a specialist",
    secondary: "Browse courses",
    imageLabel: "Illustration: a specialist helps a child during a lesson.",
    badges: {
      verify: { title: "Document checks", text: "manually, by a moderator" },
      certs: { title: "Certificates", text: "verified by QR code" },
      format: { title: "Online and offline", text: "pick a convenient format" },
    },
  },
  audience: {
    label: "A platform for",
    items: [
      "Tutors",
      "Social workers",
      "Psychologists",
      "Teachers",
      "Assistants for children with special needs",
      "Parents",
      "Schools and centers",
      "NGOs and foundations",
    ],
  },
  categories: {
    kicker: "Learning",
    title: "Programs for practice",
    subtitle: "Seminars, trainings and courses: from inclusion basics to working with parents.",
    items: [
      { title: "Inclusive education", text: "Basics, approaches and practice" },
      { title: "Sensory integration", text: "Understanding sensory needs" },
      { title: "Supporting children", text: "Tutoring work step by step" },
      { title: "Working with parents", text: "Dialogue, trust and soft skills" },
    ],
  },
  value: {
    kicker: "Quality",
    title: "Trust starts with verification",
    text: "We combine learning and specialist search in one system, so parents can choose with confidence and specialists can confirm their qualifications.",
    points: [
      "A moderator checks documents and certificates",
      "“Verified specialist” badge on the profile",
      "Quality rating and reviews",
      "Filters by city, experience and work format",
      "Quick requests to a specialist",
    ],
    cta: "About the platform",
    imageLabel: "Illustration: a specialist takes a course on a laptop.",
    badgeA: "Verified specialist",
    badgeB: "Learning progress",
  },
  catalog: {
    kicker: "Catalog",
    title: "Find a specialist",
    subtitle: "A profile is published after its documents are checked. Pick the filters you need.",
    filtersLabel: "Catalog filters",
    filters: ["City", "Specialization", "Experience", "Rating", "Certificates", "Online / offline"],
    sampleNote: "Sample card",
    verified: "Verified specialist",
    cta: "Open the catalog",
    items: [
      { role: "Tutor", format: "Online and offline", tags: ["Support", "School"] },
      { role: "Social worker", format: "Offline", tags: ["Family", "Consulting"] },
      { role: "Psychologist", format: "Online", tags: ["Special needs", "Parents"] },
    ],
  },
  courses: {
    kicker: "Courses",
    title: "Learn at your own pace",
    subtitle: "Video lessons, tests and assignments. A certificate after the course.",
    badgeSoon: "Soon",
    cta: "Details",
    items: [
      {
        type: "Course",
        title: "Foundations of inclusive education",
        text: "What inclusion is and how to organize support for a child.",
        meta: "Video lessons · Test · Certificate",
      },
      {
        type: "Training",
        title: "Sensory integration in practice",
        text: "Observation, exercises and recommendations for sessions.",
        meta: "Practice · Assignments",
      },
      {
        type: "Webinar",
        title: "Soft skills for tutors",
        text: "Talking with parents and the school team without conflict.",
        meta: "Webinar · Recording · Test",
      },
    ],
  },
  stats: {
    kicker: "Platform",
    title: "What you will find inside",
    items: [
      { value: "4", label: "account types", text: "Specialist, parent, organization and administrator" },
      { value: "7", label: "learning topics", text: "From inclusion to soft skills" },
      { value: "6", label: "catalog filters", text: "City, experience, rating, format and more" },
    ],
  },
  roles: {
    kicker: "Sign up",
    title: "Choose your role",
    subtitle: "Each role sees only the parts of the account it needs.",
    items: [
      { title: "Specialist", text: "Profile, certificates, learning and requests from families.", cta: "I am a specialist" },
      { title: "Parent", text: "Find specialists, read reviews and send quick requests.", cta: "I am a parent" },
      { title: "Organization", text: "School, center or NGO: vacancies and team training.", cta: "I am an organization" },
    ],
  },
  cta: {
    title: "Shall we start together?",
    subtitle: "Create an account and choose where to begin: a course or a specialist search.",
    button: "Create an account",
  },
  footer: {
    navLabel: "Footer navigation",
    about: "A platform for training, searching and certifying tutors and social workers.",
    columns: {
      platform: {
        title: "Platform",
        links: [
          { label: "About", href: "#about" },
          { label: "Courses", href: "#courses" },
          { label: "Specialist catalog", href: "#specialists" },
        ],
      },
      help: {
        title: "Help",
        links: [
          { label: "Sign up", href: "#roles" },
          { label: "FAQ", href: "#" },
          { label: "Contacts", href: "#" },
        ],
      },
      legal: {
        title: "Legal",
        links: [
          { label: "Privacy", href: "#" },
          { label: "Terms of use", href: "#" },
          { label: "Accessibility", href: "#" },
        ],
      },
    },
    rights: "All rights reserved.",
  },
};
