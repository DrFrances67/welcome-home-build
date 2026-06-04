// Static option data for the Professional Communication (email) assistant.

export const EMAIL_RECIPIENTS = [
  { id:"administrator", label:"Administrator",    icon:"🏫", desc:"Principal, VP, district staff" },
  { id:"colleague",     label:"Colleague",        icon:"👩‍🏫", desc:"Fellow teachers, support staff" },
  { id:"parent",        label:"Parent / Guardian", icon:"👨‍👩‍👧", desc:"Families of students" },
  { id:"student",       label:"Student",          icon:"🎒", desc:"Direct messages to students — always student-friendly language" },
  { id:"grant",         label:"Grant",            icon:"💰", desc:"Foundations, donors, funders for classroom resources" },
];
export const EMAIL_TONES = [
  { id:"formal",           label:"Formal",             desc:"Structured & highly professional" },
  { id:"warm-professional",label:"Warm & Professional", desc:"Friendly but polished" },
  { id:"direct",           label:"Direct & Clear",      desc:"Concise and to the point" },
  { id:"academic",         label:"Academic",            desc:"Scholarly, precise & evidence-informed" },
];
export const EMAIL_SITUATIONS = [
  "Reporting a concern","Sharing good news","Requesting a meeting",
  "Following up","Responding to a complaint","Providing an update",
  "Asking for help / resources","Scheduling / logistics",
  "Request for grades","Request for tutoring","Classwork / homework support",
  "Grant writing","Other",
];
export const STUDENT_GRADE_LEVELS = [
  { id:"k-2",  label:"K–2",        desc:"Ages 5–8 · very simple words, very short sentences", tier:"elementary" },
  { id:"3-5",  label:"Grades 3–5", desc:"Upper elementary · clear & friendly",                tier:"elementary" },
  { id:"6-8",  label:"Grades 6–8", desc:"Middle school · everyday vocabulary",                tier:"secondary" },
  { id:"9-12", label:"Grades 9–12",desc:"High school · clear but more mature",                tier:"secondary" },
];
export const STUDENT_COMPLEXITY = [
  { id:"simple",   label:"Simple",   desc:"Plain language, shorter sentences" },
  { id:"medium",   label:"Medium",   desc:"Balanced — clear with some richer vocabulary" },
  { id:"advanced", label:"Advanced", desc:"Stronger vocabulary while still student-friendly" },
];

// Situation compatibility rules. Each rule flags a combination that tends to
// produce a confused or contradictory email and offers a cleaner alternative.
export interface SituationConflict { when: string[]; reason?: string; suggest?: string[]; allowed?: boolean; soft?: boolean; }
export const SITUATION_MAX = 3;
export const SITUATION_CONFLICTS: SituationConflict[] = [
  {
    when: ["Sharing good news", "Reporting a concern"],
    reason: "Good news and a concern in one email muddles the message — recipients often miss the concern.",
    suggest: ["Reporting a concern"],
  },
  {
    when: ["Sharing good news", "Responding to a complaint"],
    reason: "Celebratory tone clashes with addressing a complaint.",
    suggest: ["Responding to a complaint"],
  },
  {
    when: ["Responding to a complaint", "Grant writing"],
    reason: "A grant request should never be paired with a complaint response — they need different audiences and tones.",
    suggest: ["Grant writing"],
  },
  {
    when: ["Grant writing", "Reporting a concern"],
    reason: "Grant asks should stay focused on funding impact, not classroom concerns.",
    suggest: ["Grant writing"],
  },
  {
    when: ["Grant writing", "Scheduling / logistics"],
    reason: "Logistics distract from a grant pitch — send scheduling separately.",
    suggest: ["Grant writing"],
  },
  {
    when: ["Request for grades", "Request for tutoring"],
    // not a conflict — these pair well; example of an explicitly allowed combo
    allowed: true,
  },
  {
    when: ["Other", "Other"], // placeholder so "Other" with anything else is gently flagged
    soft: true,
  },
];
