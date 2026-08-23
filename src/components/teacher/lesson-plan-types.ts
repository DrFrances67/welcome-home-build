// Local, intentionally loose types for LessonPlanGenerator.tsx.
// The AI-generated lesson plan / slide-deck payloads are dynamic JSON blobs,
// so these types describe the well-known shape while allowing extra fields.

export interface LessonPlanAssessment {
  formative?: string;
  exitTicket?: string;
  summative?: string;
  [key: string]: unknown;
}

export interface LessonPlanDifferentiation {
  ell?: string;
  iep?: string;
  gifted?: string;
  universal?: string;
  [key: string]: unknown;
}

export interface DokLevel {
  level: number;
  label?: string;
  items?: string[];
  [key: string]: unknown;
}

export interface LessonSection {
  name: string;
  duration?: string;
  description?: string;
  teacherMoves?: string;
  studentActions?: string;
  udlNotes?: string;
  [key: string]: unknown;
}

export interface LessonPlanResult {
  title?: string;
  gradeSubject?: string;
  duration?: string;
  standard?: string;
  objectives?: string[];
  successCriteria?: string[];
  materials?: string[];
  vocabulary?: string[];
  sections?: LessonSection[];
  assessment?: LessonPlanAssessment;
  dokQuestions?: DokLevel[];
  differentiation?: LessonPlanDifferentiation;
  homework?: string;
  extension?: string;
  teacherNotes?: string;
  [key: string]: unknown;
}

export interface DeckSlide {
  title?: string;
  bullets?: string[];
  kind?: string;
  imagePrompt?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface DeckData {
  title?: string;
  subtitle?: string;
  slides: DeckSlide[];
  [key: string]: unknown;
}

export interface LessonPlanForm {
  grade: string;
  subject: string;
  topic: string;
  duration: string;
  model: string;
  objectives: string;
  materials: string;
  standard: string;
  diff: string[];
  notes: string;
  [key: string]: unknown;
}

export interface ExemplarFileInfo {
  name: string;
  preview: string | null;
}
