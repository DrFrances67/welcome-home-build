// Pure helpers for the worksheet builder: id generation, grid placement,
// element factory, proportional resize scaling, randomization, and
// standard-band lookup. Extracted from the component layer so they can be
// reused and unit-tested independently of the UI.
import { NY_STANDARDS } from "@/data/ny-standards";

export const uid = () => Math.random().toString(36).slice(2, 10);

// 3-col grid placement helpers — paper inner width ≈ 632px
export const COLS = 3;
export const COL_GAP_PCT = 2; // % gap between columns
export const COL_W_PCT = (100 - COL_GAP_PCT * (COLS - 1)) / COLS; // ≈ 32%
export const ROW_HEIGHT = 220; // px per row when auto-placing
export const nextSlot = (count) => {
  const col = count % COLS;
  const row = Math.floor(count / COLS);
  return {
    x: col * (COL_W_PCT + COL_GAP_PCT), // % from left
    y: row * ROW_HEIGHT, // px from top
    widthOverride: Math.round(COL_W_PCT),
  };
};

export const mkEl = (type, slot) => {
  const id = uid();
  const pos = slot || { x: 0, y: 0, widthOverride: Math.round(COL_W_PCT) };
  const map = {
    instruction: { id, type, text: "Look at each item carefully. Follow the directions below." },
    text: {
      id,
      type,
      text: "Enter your text content here. This block will scale with your selected grade level.",
    },
    image: { id, type, url: "", caption: "", size: "medium", align: "center" },
    blank: { id, type, label: "Write your answer:", lines: 3 },
    wordBank: { id, type, title: "📚 Word Bank", words: ["cat", "dog", "fish", "bird", "frog"] },
    matching: {
      id,
      type,
      title: "Draw a line to match!",
      left: ["cat 🐱", "dog 🐶", "fish 🐟"],
      right: ["meow", "woof", "splash"],
    },
    multipleChoice: {
      id,
      type,
      question: "Which answer is correct?",
      note: "Circle the correct answer.",
      choices: ["Option A", "Option B", "Option C", "Option D"],
    },
    truefalse: {
      id,
      type,
      statements: ["The Earth orbits the Sun.", "Fish can breathe air.", "Water is a liquid."],
    },
    shortAnswer: {
      id,
      type,
      question: "Answer the following question in 1–2 complete sentences.",
      lines: 4,
    },
    fillBlank: {
      id,
      type,
      text: "The capital of New York is ______. It is located in ______ County.",
      note: "Use the Word Bank to help you.",
    },
    essay: {
      id,
      type,
      prompt:
        "In a well-developed paragraph, explain your answer using evidence from the text to support your ideas.",
      points: 10,
      lines: 14,
    },
    table: {
      id,
      type,
      title: "Complete the table:",
      headers: ["Name", "Category", "Description"],
      rows: [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ],
    },
    customShape: {
      id,
      type,
      title: "Label each shape:",
      shapes: [
        {
          shape: "rectangle",
          label: "",
          fill: "#FFFFFF",
          border: "#6D28D9",
          borderWidth: 2,
          width: 180,
          height: 120,
          lines: 0,
        },
        {
          shape: "rectangle",
          label: "",
          fill: "#FFFFFF",
          border: "#6D28D9",
          borderWidth: 2,
          width: 180,
          height: 120,
          lines: 0,
        },
      ],
      layout: "2-col",
    },
    successCriteria: {
      id,
      type,
      title: "🎯 Success Criteria",
      intro: "I can…",
      items: [
        "I can look at the picture.",
        "I can read the text.",
        "I can identify the character in the story.",
      ],
      mode: "manual",
    },
    exitTicket: {
      id,
      type,
      title: "🎟️ Exit Ticket",
      intro: "Check off everything you completed today:",
      items: [
        "I participated in class.",
        "I completed the reading assignment.",
        "I participated in at least two center activities.",
      ],
      mode: "manual",
    },
    dokQuestions: {
      id,
      type,
      title: "🧠 DOK Questions",
      intro: "Answer the questions at each level of thinking.",
      topic: "",
      mode: "manual",
      levels: [
        {
          level: 1,
          label: "Recall & Reproduction",
          items: [
            "Who is the main character in the story?",
            "Can you name the character we just read about?",
          ],
        },
        {
          level: 2,
          label: "Skills & Concepts",
          items: [
            "What does the character look like? Describe them.",
            "Is the character happy or sad? How do you know?",
          ],
        },
        {
          level: 3,
          label: "Strategic Thinking",
          items: [
            "Why do you think the character did that?",
            "What do you think the character will do next?",
          ],
        },
        {
          level: 4,
          label: "Extended Thinking",
          items: [
            "If you were the character, what would you do differently? Why?",
            "Tell a new story about the character. What happens next?",
          ],
        },
      ],
    },
    divider: { id, type },
  };
  const base = map[type] || { id, type };
  return { ...pos, ...base };
};

export const BASELINE_WIDTH_PCT = 32; // matches default widthOverride for new elements
export const BASELINE_HEIGHT_PX = 80;

// Compute proportional scale factors for an element. Scale is allowed to go
// BELOW 1 when the user shrinks the box, so inner content (text, pills,
// boxes, lines) stays inside the wrapper instead of overflowing. A floor of
// 0.55 prevents content from becoming unreadable. Default widthOverride=32
// gives sx=1 (no change at default size).
export const SCALE_MIN = 0.55;
export const SCALE_MAX = 4;
export const clampScale = (v) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));
export const resizeScaleFor = (el) => {
  // Width scale is the source of truth for typography/spacing. Dividing the
  // height override by a fixed BASELINE_HEIGHT_PX (80) used to inflate `sy`
  // to SCALE_MAX for any moderately tall box, which made inner content
  // render at maximum size no matter how the box was actually sized. Now
  // both `sy` and the unified `s` track the width scale, so content always
  // scales proportionally to the box's current width. Vertical fit is
  // handled separately by ScaledContent's measured transform.
  const sx = clampScale((el.widthOverride ?? BASELINE_WIDTH_PCT) / BASELINE_WIDTH_PCT);
  return { sx, sy: sx, s: sx };
};

export const gradeIdToStdBand = (gradeId, subj) => {
  const bands = Object.keys(NY_STANDARDS[subj] || {});
  if (subj === "ELA") {
    const map = {
      pk: "Pre-Kindergarten",
      k: "Kindergarten",
      "1": "Grade 1",
      "2": "Grade 2",
      "3": "Grade 3",
      "4": "Grade 4",
      "5": "Grade 5",
      "6": "Grade 6",
      "7": "Grade 7",
      "8": "Grade 8",
      "9": "Grades 9-10",
      "10": "Grades 9-10",
      "11": "Grades 11-12",
      "12": "Grades 11-12",
    };
    return bands.includes(map[gradeId]) ? map[gradeId] : bands[0] || "";
  }
  if (["pk", "k", "1", "2"].includes(gradeId))
    return bands.find((b) => /Pre-?K|K\b|– 2|to 2|1[-–]2/i.test(b)) || bands[0] || "";
  if (["3", "4", "5"].includes(gradeId))
    return bands.find((b) => /3[-–]5|3 ?– ?5/i.test(b)) || bands[0] || "";
  if (["6", "7", "8"].includes(gradeId))
    return bands.find((b) => /6[-–]8|6 ?– ?8/i.test(b)) || bands[0] || "";
  if (["9", "10", "11", "12"].includes(gradeId))
    return bands.find((b) => /9[-–]12|9 ?– ?12/i.test(b)) || bands[0] || "";
  return bands[0] || "";
};

// Shuffle helper
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Identify "question" elements eligible for randomization
export const isQuestion = (el) =>
  ["multipleChoice", "truefalse", "shortAnswer", "fillBlank", "blank", "matching"].includes(
    el.type,
  );

export function elSummary(el, idx) {
  const n = `${idx + 1}.`;
  if (!el) return n;
  if (el.type === "instruction") return `${n} 📋 Directions — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "text") return `${n} 📄 Passage — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "multipleChoice") return `${n} 🔘 MC — ${(el.question || "").slice(0, 70)}`;
  if (el.type === "truefalse") return `${n} ✅ True/False (${(el.statements || []).length} items)`;
  if (el.type === "shortAnswer")
    return `${n} ✍️ Short Answer — ${(el.question || "").slice(0, 70)}`;
  if (el.type === "fillBlank") return `${n} ✏️ Fill-in — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "blank") return `${n} 📝 Response — ${(el.label || "").slice(0, 70)}`;
  if (el.type === "essay") return `${n} 📖 Essay — ${(el.prompt || "").slice(0, 70)}`;
  if (el.type === "matching") return `${n} 🔗 Matching — ${el.title || ""}`;
  if (el.type === "wordBank") return `${n} 📚 ${el.title || "Word Bank"}`;
  if (el.type === "successCriteria") return `${n} 🎯 Success Criteria`;
  if (el.type === "exitTicket") return `${n} 🎟️ Exit Ticket`;
  if (el.type === "dokQuestions") return `${n} 🧠 DOK Questions`;
  if (el.type === "image") return `${n} 🖼️ Image`;
  if (el.type === "table") return `${n} 📊 Table`;
  if (el.type === "divider") return `${n} ─── Divider`;
  return `${n} ${el.type}`;
}
