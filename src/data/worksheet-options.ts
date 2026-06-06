// Static option lists for the worksheet builder (image styles, the block
// palette, font choices, shape types, DOK level definitions, version labels).

export const IMG_STYLES = [
  {
    id: "cartoon",
    label: "🎨 Cartoon",
    prompt: "colorful cartoon illustration, child-friendly, bright colors, clean lines, simple",
  },
  {
    id: "photo",
    label: "📷 Photograph",
    prompt: "realistic educational photograph, clear, professional quality, well-lit",
  },
  {
    id: "lineart",
    label: "✏️ Line Art",
    prompt:
      "black and white line drawing coloring page, simple clean outlines, no fill, educational worksheet",
  },
  {
    id: "clipart",
    label: "🎭 Clipart",
    prompt: "flat design clipart, simple vector illustration, solid colors, clean, educational",
  },
  {
    id: "diagram",
    label: "📐 Diagram",
    prompt:
      "educational labeled diagram, clear and simple, textbook style, professional illustration",
  },
];

export const PALETTE = [
  { type: "instruction", label: "Instructions", emoji: "📋" },
  { type: "text", label: "Text Block", emoji: "📝" },
  { type: "image", label: "Image", emoji: "🖼️" },
  { type: "blank", label: "Write Lines", emoji: "✏️" },
  { type: "wordBank", label: "Word Bank", emoji: "📚" },
  { type: "matching", label: "Matching", emoji: "🔗" },
  { type: "multipleChoice", label: "Multiple Choice", emoji: "🔘" },
  { type: "truefalse", label: "True / False", emoji: "✅" },
  { type: "shortAnswer", label: "Short Answer", emoji: "💬" },
  { type: "fillBlank", label: "Fill in Blank", emoji: "📌" },
  { type: "essay", label: "Essay Prompt", emoji: "📜" },
  { type: "table", label: "Table / Chart", emoji: "📊" },
  { type: "customShape", label: "Custom Shapes", emoji: "🔷" },
  { type: "successCriteria", label: "Success Criteria", emoji: "🎯" },
  { type: "exitTicket", label: "Exit Ticket", emoji: "🎟️" },
  { type: "dokQuestions", label: "DOK Questions", emoji: "🧠" },
  { type: "divider", label: "Section Break", emoji: "〰️" },
];

export const WORKSHEET_FONTS = [
  { value: "default", label: "Default (grade font)" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Nunito', sans-serif", label: "Nunito (Friendly)" },
  { value: "Georgia, serif", label: "Georgia (Serif)" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Comic Sans MS', cursive", label: "Comic Sans" },
  { value: "'Courier New', monospace", label: "Courier (Mono)" },
  { value: "'OpenDyslexic', sans-serif", label: "OpenDyslexic (Accessibility)" },
];

export const SHAPE_TYPES = [
  { id: "rectangle", label: "Rectangle" },
  { id: "rounded", label: "Rounded Box" },
  { id: "circle", label: "Circle" },
  { id: "oval", label: "Oval" },
  { id: "triangle", label: "Triangle" },
  { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" },
  { id: "star", label: "Star" },
  { id: "speech", label: "Speech Bubble" },
  { id: "cloud", label: "Cloud" },
  { id: "arrow", label: "Arrow (Right)" },
  { id: "heart", label: "Heart" },
];

export const DOK_LEVEL_DEFS = [
  { level: 1, label: "Recall & Reproduction", desc: "identify, name, point to, tell" },
  { level: 2, label: "Skills & Concepts", desc: "describe, show, sort, match" },
  { level: 3, label: "Strategic Thinking", desc: "explain, why, predict, support with evidence" },
  {
    level: 4,
    label: "Extended Thinking",
    desc: "create, design, compare, act out, tell your own story",
  },
];

export const VERSION_LABELS = ["A", "B", "C", "D"];
