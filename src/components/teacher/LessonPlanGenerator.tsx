/* eslint-disable */
// @ts-nocheck
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse, setActiveTool as setActiveToolName } from "@/lib/tracking";
import { callAiRaw, generateImage } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

import { GRADES, gradeIdToStdBand } from "./shared";
import { getActiveStandards, getActiveStateInfo } from "@/data/state-standards";
import { useAppState } from "@/contexts/AppStateContext";
import { LP_DURATIONS, LP_MODELS, LP_DIFF } from "@/data/lesson-plan";

export function LessonPlanGenerator({
  onBuildWorksheets,
}: {
  onBuildWorksheets?: (payload: {
    name: string;
    raw: string;
    topic: string;
    gradeId: string;
  }) => void;
} = {}) {
  const BRAND = "#CF27F5";
  const LIGHT = "#FDF4FF";
  const { hasStandards: stHasStandards, info: stInfo } = useAppState();

  const [form, setForm] = useState({
    grade: "k",
    subject: "",
    topic: "",
    duration: "45 minutes",
    model: "Direct Instruction",
    objectives: "",
    materials: "",
    standard: "",
    diff: [],
    notes: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCopyBox, setShowCopyBox] = useState(false);
  const [showGdocsBox, setShowGdocsBox] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStdPicker, setShowStdPicker] = useState(false);

  // AI Idea Helper
  const [aiHelperOpen, setAiHelperOpen] = useState(false);
  const [aiHelperField, setAiHelperField] = useState("objectives"); // which field to fill
  const [aiHelperLoading, setAiHelperLoading] = useState(false);
  const [aiHelperResult, setAiHelperResult] = useState("");

  // Exemplar
  const [exMode, setExMode] = useState("file");
  const [exemplarFile, setExemplarFile] = useState(null);
  const [exemplarUrl, setExemplarUrl] = useState("");
  const [exemplarText, setExemplarText] = useState("");
  const [exemplarDesc, setExemplarDesc] = useState("");
  const [exemplarRaw, setExemplarRaw] = useState(""); // full text extracted from file/url/paste
  const [analyzingEx, setAnalyzingEx] = useState(false);
  const [exError, setExError] = useState("");
  const dropRef = useRef(null);
  const [draggingOver, setDraggingOver] = useState(false);

  // Slide deck generation state
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesError, setSlidesError] = useState("");
  const [deckData, setDeckData] = useState(null); // cached AI-generated deck
  const [exportingFmt, setExportingFmt] = useState(""); // which format is being exported

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleDiff = (d) =>
    setF("diff", form.diff.includes(d) ? form.diff.filter((x) => x !== d) : [...form.diff, d]);

  // ── Shared Claude call ─────────────────────────────────────────────
  // Network-resilient: retries once on transient "Failed to fetch" / abort,
  // uses an AbortController with a generous timeout, and surfaces clear errors.
  const callClaude = (system, userContent, maxTokens = 600) =>
    callAiRaw({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    });

  // ── AI Idea Helper ─────────────────────────────────────────────────
  const runAiHelper = async () => {
    if (!form.subject.trim() && !form.topic.trim()) {
      setAiHelperResult("Please fill in at least a subject or topic first.");
      return;
    }
    setAiHelperLoading(true);
    setAiHelperResult("");
    const fieldLabels = {
      objectives: "3 specific SWBAT learning objectives",
      materials: "a list of materials and resources needed",
      notes: "teacher preparation notes, tips, and things to watch out for",
    };
    try {
      const text = await callClaude(
        "You are a helpful curriculum assistant. Respond concisely and practically — no preamble.",
        `Generate ${fieldLabels[aiHelperField]} for a ${form.grade} grade ${form.subject || "ELA"} lesson on "${form.topic || form.subject}". Model: ${form.model}. Duration: ${form.duration}. Be specific and ready to use.`,
        500,
      );
      setAiHelperResult(text);
    } catch (e) {
      setAiHelperResult(`Error: ${e.message}`);
    }
    setAiHelperLoading(false);
  };

  const applyAiHelper = () => {
    if (!aiHelperResult) return;
    setF(aiHelperField, aiHelperResult);
    setAiHelperResult("");
  };

  // ── DOK Questions helpers (mirror worksheet builder DOK structure) ──
  const DOK_DEFS = [
    { level: 1, label: "Recall & Reproduction" },
    { level: 2, label: "Skills & Concepts" },
    { level: 3, label: "Strategic Thinking" },
    { level: 4, label: "Extended Thinking" },
  ];
  const DOK_LEVEL_COLORS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];

  const dokOk = (arr) =>
    Array.isArray(arr) &&
    arr.length >= 4 &&
    DOK_DEFS.every((d) => {
      const lv = arr.find((x) => Number(x?.level) === d.level);
      return (
        lv && Array.isArray(lv.items) && lv.items.filter((s) => s && String(s).trim()).length >= 1
      );
    });

  const normalizeDok = (arr) =>
    DOK_DEFS.map((d) => {
      const found = (Array.isArray(arr) ? arr : []).find((x) => Number(x?.level) === d.level) || {};
      const items = (Array.isArray(found.items) ? found.items : [])
        .map((s) => String(s || "").trim())
        .filter(Boolean);
      return {
        level: d.level,
        label: found.label || d.label,
        items: items.length ? items : ["(Add a question)"],
      };
    });

  // Generate a fresh DOK question set aligned to the lesson's objectives.
  // Mirrors the worksheet builder DOK generator: 2–3 student-facing questions
  // per level, every level required, never "N/A".
  const generateDokFromObjectives = async (objectives, lessonTitle) => {
    const objsBlock =
      (objectives || [])
        .filter(Boolean)
        .map((o, i) => `${i + 1}. ${o}`)
        .join("\n") || "(no objectives provided)";
    const sys = `You design Depth of Knowledge (DOK) question sets for K–12 lessons based on Norman Webb's framework. DOK measures the depth of cognitive complexity, NOT difficulty. Output ONLY a valid JSON array — no markdown, no fences. Start with [ and end with ].\n\nDOK levels:\n• DOK 1 — Recall & Reproduction (recall facts, define, identify, list)\n• DOK 2 — Skills & Concepts (summarize, compare, classify, explain relationships)\n• DOK 3 — Strategic Thinking (justify, cite evidence, draw conclusions, hypothesize)\n• DOK 4 — Extended Thinking (synthesize across sources, design, critique, transfer to new context)\n\nRules: EVERY level (1, 2, 3, 4) MUST have 2–3 non-empty student-facing questions. Use grade-appropriate language for ${form.grade}. Tie every question directly to the lesson objectives. NEVER write "N/A".`;
    const user = `Lesson: ${lessonTitle || form.topic || form.subject}\nGrade: ${form.grade} | Subject: ${form.subject}\n\nLearning objectives:\n${objsBlock}\n\nReturn this JSON shape ONLY:\n[\n  {"level":1,"label":"Recall & Reproduction","items":["...","..."]},\n  {"level":2,"label":"Skills & Concepts","items":["...","..."]},\n  {"level":3,"label":"Strategic Thinking","items":["...","..."]},\n  {"level":4,"label":"Extended Thinking","items":["...","..."]}\n]`;
    const raw = await callClaude(sys, user, 1400);
    let clean = (raw || "").trim();
    if (clean.startsWith("```"))
      clean = clean
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    const s = clean.indexOf("["),
      e = clean.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("DOK response was not valid JSON");
    return JSON.parse(clean.slice(s, e + 1));
  };

  const [regeneratingDok, setRegeneratingDok] = useState(false);
  const regenerateDok = async () => {
    if (!result) return;
    setRegeneratingDok(true);
    try {
      const dok = await generateDokFromObjectives(result.objectives || [], result.title);
      setResult((prev) => (prev ? { ...prev, dokQuestions: normalizeDok(dok) } : prev));
    } catch (e) {
      setError(`DOK regeneration failed: ${e.message}`);
    }
    setRegeneratingDok(false);
  };

  // ── Exemplar handlers ──────────────────────────────────────────────
  const readFileAsB64 = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  const readFileAsText = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = rej;
      r.readAsText(f);
    });

  const ANALYZE_Q =
    "Analyze this exemplar lesson plan. In 3 sentences describe: (1) sections and their order, (2) level of detail, (3) formatting style (bullets/tables/numbered steps). This will guide format replication.";

  const extractPdfText = async (file) => {
    // Lazy-load pdfjs only when needed; configure the worker from the same package.
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, 15); // cap pages to keep prompt small
    let text = "";
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
    }
    return text.trim();
  };

  const extractDocxText = async (file) => {
    const mammoth = await import("mammoth/mammoth.browser.js");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || "").trim();
  };

  const handleExemplarFile = async (file) => {
    if (!file) return;
    setExError("");
    setExemplarDesc("");
    setAnalyzingEx(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isDocx =
        /\.docx$/i.test(file.name) ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isTxt = /\.(txt|md|rtf)$/i.test(file.name) || file.type === "text/plain";
      let preview = null;
      let desc = "";
      let raw = "";
      if (isImage) {
        const dataUrl = await readFileAsB64(file);
        preview = dataUrl;
        const b64 = dataUrl.split(",")[1];
        desc = await callClaude("Analyze lesson plan images briefly.", [
          { type: "image", source: { type: "base64", media_type: file.type, data: b64 } },
          { type: "text", text: ANALYZE_Q },
        ]);
      } else if (isPdf) {
        raw = await extractPdfText(file);
        if (!raw)
          throw new Error(
            "Could not read text from PDF (it may be scanned images). Try the Paste Text tab.",
          );
        desc = await callClaude(
          "Analyze lesson plan text briefly.",
          `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0, 8000)}`,
        );
      } else if (isDocx) {
        raw = await extractDocxText(file);
        if (!raw)
          throw new Error("Could not read text from this Word document. Try the Paste Text tab.");
        desc = await callClaude(
          "Analyze lesson plan text briefly.",
          `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0, 8000)}`,
        );
      } else if (isTxt) {
        raw = await readFileAsText(file);
        desc = await callClaude(
          "Analyze lesson plan text briefly.",
          `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0, 8000)}`,
        );
      } else {
        desc = `"${file.name}" uploaded but its format isn't supported here. Try uploading a PDF, DOCX, image, or paste the text.`;
      }
      setExemplarFile({ name: file.name, preview });
      setExemplarDesc(desc);
      setExemplarRaw(raw);
    } catch (e) {
      setExError(`Could not analyze: ${e.message}. Try the Paste Text tab.`);
    }
    setAnalyzingEx(false);
  };

  const handleUrlAnalyze = async () => {
    const url = exemplarUrl.trim();
    if (!url) return;
    setExError("");
    setExemplarDesc("");
    setExemplarRaw("");
    setAnalyzingEx(true);
    if (/docs\.google\.com/.test(url)) {
      setExemplarDesc(
        "Google Docs: File → Download → Plain Text (.txt) then upload — or Select All, Copy, and use the Paste Text tab.",
      );
      setAnalyzingEx(false);
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const desc = await callClaude(
        "Analyze lesson plan text briefly.",
        `${ANALYZE_Q}\n\nCONTENT:\n${text.slice(0, 8000)}`,
      );
      setExemplarDesc(desc);
      setExemplarRaw(text);
    } catch (e) {
      setExError(`Could not load URL: ${e.message}. Try the Paste Text tab.`);
    }
    setAnalyzingEx(false);
  };

  const handleTextAnalyze = async () => {
    if (!exemplarText.trim()) return;
    setExError("");
    setExemplarDesc("");
    setAnalyzingEx(true);
    try {
      const desc = await callClaude(
        "Analyze lesson plan text briefly.",
        `${ANALYZE_Q}\n\nPLAN:\n${exemplarText.slice(0, 8000)}`,
      );
      setExemplarDesc(desc);
      setExemplarRaw(exemplarText);
    } catch (e) {
      setExError(`Analysis failed: ${e.message}`);
    }
    setAnalyzingEx(false);
  };

  const clearExemplar = () => {
    setExemplarFile(null);
    setExemplarUrl("");
    setExemplarText("");
    setExemplarDesc("");
    setExemplarRaw("");
    setExError("");
    setAnalyzingEx(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDraggingOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setExMode("file");
      handleExemplarFile(f);
    }
  };

  // ── MAIN GENERATE ─────────────────────────────────────────────────
  const generate = async () => {
    if (!form.subject.trim() || !form.topic.trim()) {
      setError("Please fill in Subject and Topic before generating.");
      return;
    }
    void trackToolUse("Lesson Plan Generator");
    setLoading(true);
    setResult(null);
    setError(null);

    const diffList = form.diff.length ? form.diff.join(", ") : "General education";
    const isGradualRelease = form.model.toLowerCase().includes("gradual");
    const is5E = form.model.toLowerCase().includes("5e");
    const isNeurodiverse = form.diff.includes(
      "Neurodiverse Students (Autism / Multiple Disabilities)",
    );

    // Concise per-need instructions — no bullet points or special chars that bloat JSON responses
    const diffNotes = [];
    if (form.diff.includes("ELL / Language Learners"))
      diffNotes.push(
        "ELL/Language Learners (apply ELL best practices throughout EVERY section, activity, and material — not just one note): (1) Embed visuals, realia, photos, diagrams, illustrated word banks, and graphic organizers (Frayer model, T-charts, Venn diagrams, story maps) in every activity. (2) Provide sentence frames, sentence starters, and sentence stems for every speaking and writing task (e.g., 'I think ___ because ___', 'First ___, next ___, finally ___'). (3) Include explicit language instruction embedded in content: phonology (sound patterns), morphology (prefixes/suffixes/roots), syntax (sentence structure), and semantics (word meaning in context) — call these out by name in instruction. (4) Build in SWIRL activities — Speak, Write, Interact, Read, Listen — through structured partner talk, think-pair-share, small group work, and turn-and-talk in every section. (5) Reference word walls, bilingual labels (English + home language where possible), and require closed captioning on any video resource. (6) Specify slow, expressive teacher read-alouds; offer audiobook/text-to-speech support; build in vocabulary assimilation/processing time before requiring output. (7) Use informal assessment (exit tickets, observation checklists, thumbs up/down) and limit feedback to 1–2 focused language or content concepts at a time. (8) Encourage native/home language use for conceptual discussion and brainstorming; suggest family/community engagement connections. (9) Recommend tech supports: text-to-speech, speech-to-text, translation tools (Google Translate, Microsoft Translator), live captions. (10) Protect emotional safety, honor the silent period (do not force early verbal output), and affirm students' cultures and linguistic identities. Every activity description, material list, and assessment MUST visibly reflect these supports.",
      );
    if (form.diff.includes("Students with IEPs"))
      diffNotes.push(
        "Students with IEPs (apply IEP best practices throughout EVERY section, activity, and material — not just one note): (1) Provide specially designed instruction (SDI) that addresses unique academic and functional needs — explicitly call out how each task is adapted (e.g., chunked steps, modeled examples, guided notes). (2) Embed supplementary aids and services: extended time, assistive technology (speech-to-text, text-to-speech, word prediction, switch access), and modified materials (large print, simplified/leveled text, visual supports, manipulatives). (3) Design for the Least Restrictive Environment (LRE) — inclusion-first activities students can do alongside peers, with paraprofessional support roles defined and sensory tools (fidgets, noise-reducing headphones, wobble cushions) integrated naturally. (4) Include collaborative planning supports for general education teachers implementing IEP goals: co-teaching cues, suggested goal alignment, and quick reference for accommodations vs modifications. (5) Embed accommodations into activities WITHOUT lowering core academic expectations — same rigor, different access. (6) Reflect awareness of related services (speech-language, OT, PT, counseling) in task design — e.g., fine-motor alternatives for writing, communication device options, movement breaks. (7) Use flexible grouping (small group, partner, 1:1), scaffolded multi-step instructions (visual + verbal + written), and multiple means of expression (draw, dictate, type, build, point). (8) Build in progress monitoring aligned to common IEP goal areas (reading fluency, math computation, written expression, behavior, communication) with focused, individualized feedback on 1–2 targets at a time. Every activity description, material list, and assessment MUST visibly reflect these supports.",
      );
    if (form.diff.includes("504 Accommodations"))
      diffNotes.push(
        "504 Accommodations (apply 504 best practices throughout EVERY section, activity, and material — not just one note): (1) Embed preferential seating, scheduled sensory breaks, visual schedules of the lesson flow, and organizational tools (color-coding by subject/task type, planners, checklists, folders) into the lesson structure itself. (2) Multi-sensory instruction in every section: provide audio recordings, written outlines, study guides, simplified/chunked directions, and visual supports alongside verbal instruction. (3) Build in peer note-taking support and alternative information formats (graphic organizers, audio summaries, video clips). (4) Assessment flexibility: extended time, oral or recorded responses, reduced problem sets (same rigor, fewer items), quiet/reduced-distraction testing environment. (5) Behavioral supports embedded in routines: positive reinforcement systems, agreed-upon nonverbal redirection cues, scheduled movement breaks, and clear behavior contracts/expectations posted visually. (6) Reflect home-school communication strategies in progress monitoring (weekly check-ins, communication logs, shared trackers). (7) CRITICAL: All accommodations change HOW students access content and demonstrate learning — academic standards, content, and curriculum expectations remain UNMODIFIED. (8) Distinguish from IEP modifications: 504 plans provide ACCESS supports only, NEVER reduced expectations or alternate curriculum. Every activity description, material list, and assessment MUST visibly reflect these access supports while preserving full grade-level rigor.",
      );
    if (form.diff.includes("Gifted & Advanced"))
      diffNotes.push(
        "Gifted & Advanced (apply gifted best practices throughout EVERY section, activity, and material — not just one note): (1) Curriculum compacting — pre-assess and skip already-mastered content; replace with advanced projects, independent study contracts, or mentorship opportunities. (2) Embed acceleration options in tasks: above-grade-level texts and problems, subject-specific acceleration, dual-enrollment-style challenges, and early exposure to complexity. (3) Enrichment through critical thinking, creative problem-solving, design challenges, academic competitions (Math Olympiad, Science Olympiad, debate, writing contests), and strength-based learning paths. (4) REUSABLE HIGHER-ORDER QUESTION STEMS — every gifted activity section MUST include at least 2 question stems drawn from these banks, explicitly labeled by cognitive level: ANALYZE ('What patterns do you notice between ___ and ___?', 'How does ___ contrast with ___?', 'What evidence supports ___?', 'What assumptions underlie ___?', 'Break down ___ into its essential components.'); EVALUATE ('Critique the strength of ___ using ___ criteria.', 'Defend or refute the claim that ___.', 'Which solution is most effective and why?', 'Judge the validity of ___ based on ___.', 'Rank ___ from most to least ___ and justify.'); SYNTHESIZE/CREATE ('Design a ___ that solves ___.', 'Combine ideas from ___ and ___ to propose ___.', 'Hypothesize what would happen if ___.', 'Construct an original ___ that demonstrates ___.', 'Develop a new theory/model that explains ___.'). Embed DOK 3–4 throughout. (5) Flexible grouping by interest and ability for deeper intellectual collaboration — cluster grouping, like-ability partnerships, cross-grade collaboration. (6) Social-emotional supports: normalize productive failure, emphasize process over product, address perfectionism explicitly, build psychological safety for risk-taking. (7) Direct instruction in self-regulation, empathy, and grit to support asynchronous development (intellectual age vs. emotional age). (8) GIEP awareness — provide holistic support for twice-exceptional (2e) students who are gifted AND have a disability; pair enrichment with appropriate scaffolds. (9) Reflect community/university partnerships, specialized workshops, expert mentors, and real-world audiences in extension tasks. (10) Teacher-facilitated but student-driven inquiry — open-ended driving questions, independent exploration, choice in topic/product/audience. Every activity description, material list, and assessment MUST visibly reflect these supports and include the labeled higher-order question stems.",
      );
    if (form.diff.includes("Multiple Learning Styles"))
      diffNotes.push(
        "Multiple Learning Styles / UDL (apply UDL best practices throughout EVERY section, activity, and material — not just one note): (1) Multiple means of representation in every section — visuals (charts, diagrams, infographics, anchor charts), audio (discussions, lectures, podcasts, read-alouds), text (handouts, transcripts, leveled readings), and kinesthetic activities (hands-on manipulatives, role-play, movement, building). (2) Flexible assessment options: students may demonstrate mastery via written report, oral presentation, model building, digital simulation, video, infographic, or performance — same rigor, multiple modalities. (3) Blended learning structures: microlearning chunks, interactive online modules, and a balance of solitary AND collaborative tasks within each lesson. (4) Technology integration: LMS pathways (Google Classroom, Canvas, Schoology), closed captions on all videos, interactive elements (Nearpod, Pear Deck, Padlet), and student self-assessment tools (rubrics, checklists, reflection prompts). (5) Embed meaningful student CHOICE throughout activities — choice in topic, process, product, grouping, or pacing — to maximize accessibility and engagement. (6) Frame instruction around multiple MODES of engagement (action/expression, representation, engagement per UDL guidelines) rather than fixed/outdated 'learning style' labels (no VAK/VARK matching). Every activity description, material list, and assessment MUST visibly offer multi-modal access and at least one student choice point.",
      );
    if (isNeurodiverse)
      diffNotes.push(
        "Neurodiverse (Autism/Multiple Disabilities): simplify language to short concrete phrases, use field-of-3 picture choices for responses, embed visual aids in every section, allow AAC devices and assistive technology as primary response modes, no independent writing required, use real objects and tactile materials, include sensory breaks, connect all content to concrete real-world examples",
      );

    const multiGroupDirective =
      form.diff.length > 1
        ? ` MULTI-GROUP DIFFERENTIATION REQUIRED: The teacher selected ${form.diff.length} differentiation groups (${form.diff.join(", ")}). Every section, activity, material list, and assessment MUST incorporate best practices for ALL selected groups simultaneously. Where a single blended approach works, embed supports for every group together. Where groups need distinct supports, include clearly labeled per-group sub-bullets (e.g., "For ELL:", "For IEP:", "For Gifted:", "For 504:", "For UDL/Multiple Learning Styles:") within the relevant section so the teacher can implement each group's accommodations side-by-side. Do NOT favor one group over another and do NOT collapse groups together in a way that loses any group's required supports.`
        : "";

    const diffSection =
      diffNotes.length > 0
        ? "Differentiation strategies to embed throughout every lesson section: " +
          diffNotes.join(" | ") +
          multiGroupDirective
        : "No specific differentiation required.";

    const sectionNames = is5E
      ? "Engage, Explore, Explain, Elaborate, Evaluate (5E Model — sections MUST use these exact 5 names in this order; Engage hooks curiosity, Explore is hands-on inquiry, Explain consolidates concepts/vocabulary, Elaborate applies learning to new contexts, Evaluate measures mastery)"
      : isGradualRelease
        ? isNeurodiverse
          ? "Do Now/Hook, I Do (Focused Instruction — teacher explicitly models the skill using think-alouds and introduces content in small steps to minimize cognitive overload), We Do (Guided Instruction — teacher and students collaborate; teacher provides scaffolding, immediate feedback, and corrective guidance), You Do (Independent Practice — students apply the skill autonomously while the teacher monitors via formative assessment; for neurodiverse learners this combines collaborative and independent practice into a single supported phase using AAC, visuals, and adult/peer support), Closure. ALL phases are REQUIRED — generate every phase fully with concrete teacher moves, student actions, timing, and check-for-understanding."
          : "Do Now/Hook, I Do (Focused Instruction — teacher explicitly models the skill using think-alouds and introduces content in small steps to minimize cognitive overload), We Do (Guided Instruction — teacher and students collaborate; teacher provides scaffolding, immediate feedback, and corrective guidance), You Do Together (Collaborative Practice — students work in pairs or small groups using peer support before independent work), You Do (Independent Practice — students apply the skill autonomously while the teacher monitors via formative assessment), Closure. ALL four GRR phases (I Do, We Do, You Do Together, You Do) are REQUIRED — generate every phase fully with concrete teacher moves, student actions, timing, and check-for-understanding. Do NOT omit, merge, or shorten any phase."
        : "Do Now/Hook, Direct Instruction, Guided Practice, Independent Work, Closure";

    const extras = [
      form.objectives ? `Objectives: ${form.objectives}` : "",
      form.materials ? `Materials: ${form.materials}` : "",
      form.notes.trim() ? `Teacher notes: ${form.notes}` : "",
      exemplarDesc ? `Format analysis of teacher's exemplar: ${exemplarDesc.slice(0, 600)}` : "",
      exemplarRaw
        ? `Exemplar lesson plan to mimic in structure, tone, and section detail (replicate this format closely):\n${exemplarRaw.slice(0, 4000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Build the candidate NYS standards list to constrain the AI.
    // CRITICAL: We only allow standards from our NY_STANDARDS dataset (NYS Next Gen).
    // Never let the model invent CCLS / Common Core codes when no standard is picked.
    const gradeNameMap: Record<string, string> = {
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
      "9": "Grade 9",
      "10": "Grade 10",
      "11": "Grade 11",
      "12": "Grade 12",
    };
    const gradeBandKey = gradeNameMap[form.grade] || form.grade;
    const stdInfo = getActiveStateInfo();
    const STD = getActiveStandards();
    const hasStds = Object.keys(STD).length > 0;
    const collectStandards = () => {
      const out: string[] = [];
      const subjGuess = (form.subject || "").toLowerCase();
      const subjects = Object.keys(STD);
      const matchSubj =
        subjects.find((s) => s.toLowerCase() === subjGuess) ||
        subjects.find(
          (s) => subjGuess.includes(s.toLowerCase()) || s.toLowerCase().includes(subjGuess),
        );
      const subjList = matchSubj ? [matchSubj] : subjects;
      for (const s of subjList) {
        const bands = STD[s] || {};
        // Try exact grade-band first, fall back to all bands of subject
        const bandKeys = Object.keys(bands);
        const exact = bandKeys.find((b) => b === gradeBandKey);
        const useBands = exact ? [exact] : bandKeys;
        for (const b of useBands) {
          for (const std of bands[b] || []) out.push(`${std.code} (${s} · ${b}): ${std.desc}`);
        }
      }
      return out.slice(0, 60);
    };
    const candidateStds = collectStandards();
    const standardsBlock = form.standard
      ? `Standard chosen by the teacher (use exactly): ${form.standard}`
      : hasStds
        ? `No standard was selected. You MUST pick the single best-fit standard from this approved ${stdInfo.standardsName} list (do NOT invent codes — only use entries from this list). Copy the chosen entry verbatim into the "standard" field:\n${candidateStds.join("\n")}`
        : `No state standards are loaded for ${stdInfo.name}. Leave the "standard" field as a brief, generic alignment note (e.g. grade-appropriate ${form.subject} skills) and do NOT invent specific standard codes.`;

    const systemPrompt = `You are an expert ${stdInfo.name} curriculum designer.${hasStds ? ` You ONLY align lessons to the ${stdInfo.standardsName} (the codes contained in the user prompt). You NEVER invent standard codes. If the teacher did not pick a standard, you MUST select one from the provided list and copy it verbatim into the "standard" field.` : ` No specific state standards are provided, so do NOT invent standard codes — describe alignment in plain language only.`} Respond with ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON. Start with { and end with }. Keep all field values concise — under 80 words each — so the full response fits within the token limit. CRITICAL: Always provide a real, concrete homework activity AND a real, concrete extension activity. Never write "N/A", "None", "Not applicable", or leave them blank — even for Kindergarten, propose a developmentally-appropriate at-home family activity (e.g. drawing, sorting objects at home, reading with a caregiver) for homework, and a deeper challenge or enrichment task for extension.`;

    const userPrompt = `Create a lesson plan for:
Grade: ${form.grade} | Subject: ${form.subject} | Topic: ${form.topic}
Duration: ${form.duration} | Model: ${form.model}
${standardsBlock}
Differentiation: ${diffList}
${diffSection}
Sections: ${sectionNames}
${extras}

REQUIRED for homework and extension:
- "homework" MUST be a specific, grade-appropriate at-home activity tied to today's objective. For Kindergarten and early grades, suggest a short hands-on family activity (10-15 min) such as drawing, sorting household objects, reading aloud with a caregiver, or a scavenger hunt. NEVER write "N/A" or "None".
- "extension" MUST be a specific enrichment / challenge activity for students who finish early or need a deeper push. NEVER write "N/A" or "None".

REQUIRED for successCriteria:
- "successCriteria" MUST be an array of 3-5 specific, observable, student-facing "I can…" statements directly aligned to the learning objectives. Each statement is what a student must be able to do/say/produce by the end of the lesson to demonstrate mastery. Use student-friendly language (e.g. "I can identify the main idea of a paragraph and support it with one detail."). NEVER write "N/A".

REQUIRED for dokQuestions (Depth of Knowledge — Norman Webb framework):
- "dokQuestions" MUST be an array of EXACTLY 4 objects, one per DOK level (1, 2, 3, 4). EVERY level MUST have 2-3 student-facing questions in "items" — never skip a level, never write "N/A".
- Questions MUST be directly tied to the learning objectives above and use grade-appropriate language for ${form.grade}.
- DOK measures cognitive complexity, not difficulty. Use these definitions:
  • DOK 1 — Recall & Reproduction (recall facts, define, identify, list)
  • DOK 2 — Skills & Concepts (summarize, compare, classify, explain relationships)
  • DOK 3 — Strategic Thinking (justify, cite evidence, draw conclusions, hypothesize)
  • DOK 4 — Extended Thinking (synthesize across sources, design, critique, transfer to new context)

Return this JSON (replace all placeholder text with real content, keep values concise):
{
  "title": "...",
  "gradeSubject": "...",
  "duration": "...",
  "standard": "...",
  "objectives": ["...", "...", "..."],
  "successCriteria": ["I can ...", "I can ...", "I can ..."],
  "materials": ["...", "...", "..."],
  "vocabulary": ["...", "...", "..."],
  "sections": [
    {"name": "...", "duration": "...", "description": "...", "teacherMoves": "...", "studentActions": "...", "udlNotes": "..."}
  ],
  "assessment": {"formative": "...", "summative": "...", "exitTicket": "..."},
  "dokQuestions": [
    {"level": 1, "label": "Recall & Reproduction", "items": ["...", "..."]},
    {"level": 2, "label": "Skills & Concepts", "items": ["...", "..."]},
    {"level": 3, "label": "Strategic Thinking", "items": ["...", "..."]},
    {"level": 4, "label": "Extended Thinking", "items": ["...", "..."]}
  ],
  "differentiation": {"ell": "...", "iep": "...", "gifted": "...", "universal": "..."},
  "homework": "...",
  "extension": "...",
  "teacherNotes": "..."
}`;

    try {
      const raw = await callClaude(systemPrompt, userPrompt, 8000);
      if (!raw || !raw.trim()) throw new Error("No response received. Please try again.");

      // Strip any accidental fences
      let clean = raw.trim();
      if (clean.startsWith("```")) {
        clean = clean
          .replace(/^```json?\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
      }

      // Find the JSON object boundaries
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start === -1) throw new Error("Response was not valid JSON. Please try again.");
      clean = end > start ? clean.slice(start, end + 1) : clean.slice(start);

      // Use defensive parser that repairs truncation, trailing commas, control chars.
      let parsed: any;
      try {
        parsed = JSON.parse(clean);
      } catch {
        parsed = repairAndParse(clean, { container: "object" });
      }

      // Scrub "N/A"-style answers from homework/extension and ask AI to retry just those if needed
      const isEmpty = (v) =>
        !v || /^(n\/?a|none|not applicable|tbd|n\.a\.?)\.?$/i.test(String(v).trim());
      if (isEmpty(parsed.homework) || isEmpty(parsed.extension)) {
        try {
          const fixPrompt = `For a ${form.grade} ${form.subject} lesson on "${form.topic}" (${form.duration}), suggest:
1. ONE specific, grade-appropriate homework activity (10-15 min, family-friendly for early grades)
2. ONE specific extension/enrichment activity for students who need a deeper challenge
Return ONLY this JSON: {"homework":"...","extension":"..."}`;
          const fixRaw = await callClaude("Return only valid JSON.", fixPrompt, 400);
          const fStart = fixRaw.indexOf("{"),
            fEnd = fixRaw.lastIndexOf("}");
          if (fStart !== -1 && fEnd !== -1) {
            const fixObj = JSON.parse(fixRaw.slice(fStart, fEnd + 1));
            if (!isEmpty(fixObj.homework)) parsed.homework = fixObj.homework;
            if (!isEmpty(fixObj.extension)) parsed.extension = fixObj.extension;
          }
        } catch (_) {
          /* fall through with whatever we have */
        }
      }

      // Ensure successCriteria exists — derive from objectives if AI omitted it
      if (!Array.isArray(parsed.successCriteria) || parsed.successCriteria.length === 0) {
        const objs = Array.isArray(parsed.objectives) ? parsed.objectives : [];
        if (objs.length > 0) {
          parsed.successCriteria = objs.map((o) => {
            const t = String(o)
              .replace(/^(students will be able to|swbat|tlw|the learner will)\s*/i, "")
              .trim();
            return `I can ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
          });
        } else {
          parsed.successCriteria = ["I can demonstrate understanding of today's lesson objective."];
        }
      }

      // Ensure dokQuestions exists and has all 4 levels populated. If missing
      // or incomplete, ask the AI to generate them from the objectives.
      if (!dokOk(parsed.dokQuestions)) {
        try {
          const objsForDok = (Array.isArray(parsed.objectives) ? parsed.objectives : []).filter(
            Boolean,
          );
          const dok = await generateDokFromObjectives(objsForDok, parsed.title || form.topic);
          if (dokOk(dok)) parsed.dokQuestions = dok;
        } catch (_) {
          /* keep whatever the model gave */
        }
      }
      parsed.dokQuestions = normalizeDok(parsed.dokQuestions);

      // Final guard: if the AI ignored instructions and emitted a CCLS / Common Core code,
      // or invented a code not in NY_STANDARDS, fall back to the closest entry from candidateStds.
      if (!form.standard) {
        const stdStr = String(parsed.standard || "");
        const looksLikeCcls = /CCSS|CCLS|Common\s*Core|ELA-Literacy|Math\.Content/i.test(stdStr);
        const matchesAllowed = candidateStds.some(
          (c) => stdStr && c.toLowerCase().startsWith(stdStr.toLowerCase().slice(0, 6)),
        );
        if (looksLikeCcls || (!matchesAllowed && candidateStds.length)) {
          parsed.standard = candidateStds[0];
        }
      }

      // Ensure the Gifted differentiation field is NEVER empty — always provide
      // enrichment, extension, or advanced engagement strategies appropriate to the lesson.
      if (!parsed.differentiation || typeof parsed.differentiation !== "object")
        parsed.differentiation = {};
      const giftedTxt = String(parsed.differentiation.gifted || "").trim();
      if (!giftedTxt) {
        const topic = form.topic || parsed.topic || "the lesson topic";
        parsed.differentiation.gifted = `Enrichment & extension for advanced learners on ${topic}: (1) Curriculum compacting — pre-assess and replace mastered content with an independent study contract or advanced project. (2) Higher-order tasks using ANALYZE ("What patterns/assumptions underlie ${topic}?"), EVALUATE ("Critique competing approaches to ${topic} and defend your choice."), and SYNTHESIZE/CREATE ("Design an original product/model that applies ${topic} to a real-world problem.") prompts at DOK 3–4. (3) Acceleration — above-grade-level texts, problems, or dual-enrollment-style challenges. (4) Choice of product, audience, and process; option to pursue a competition, expert mentor, or community/university partnership. (5) Flexible cluster grouping for deeper intellectual collaboration. (6) Social-emotional supports: normalize productive failure, address perfectionism, and build self-regulation, empathy, and grit; include 2e scaffolds where needed.`;
      }

      // Validation: if Gifted & Advanced is selected, every section MUST contain
      // analyze + evaluate + synthesize/create question stems. Auto-augment any
      // section that is missing one or more cognitive levels.
      if (form.diff.includes("Gifted & Advanced") && Array.isArray(parsed.sections)) {
        const STEM_BANK = {
          analyze: [
            "What patterns do you notice between ___ and ___?",
            "How does ___ contrast with ___?",
            "What evidence supports ___?",
          ],
          evaluate: [
            "Critique the strength of ___ using ___ criteria.",
            "Defend or refute the claim that ___.",
            "Which solution is most effective and why?",
          ],
          synthesize: [
            "Design a ___ that solves ___.",
            "Combine ideas from ___ and ___ to propose ___.",
            "Hypothesize what would happen if ___.",
          ],
        };
        const detect = (text: string) => {
          const t = (text || "").toLowerCase();
          return {
            analyze: /\banalyze|analyse|patterns?|contrast|evidence|assumption|break down\b/.test(
              t,
            ),
            evaluate: /\bevaluate|critique|defend|refute|judge|justify|rank|most effective\b/.test(
              t,
            ),
            synthesize:
              /\bsynthesi[sz]e|create|design|combine|hypothesize|construct|develop a (new|model)\b/.test(
                t,
              ),
          };
        };
        const missingReport: string[] = [];
        parsed.sections = parsed.sections.map((sec: any, idx: number) => {
          const blob = [sec.description, sec.teacherMoves, sec.studentActions, sec.udlNotes]
            .filter(Boolean)
            .join(" ");
          const has = detect(blob);
          const missing = (Object.keys(has) as Array<keyof typeof has>).filter((k) => !has[k]);
          if (missing.length === 0) return sec;
          missingReport.push(
            `Section ${idx + 1} "${sec.name || ""}" missing: ${missing.join(", ")}`,
          );
          const additions = missing
            .map((level) => {
              const label =
                level === "synthesize"
                  ? "Synthesize/Create"
                  : level.charAt(0).toUpperCase() + level.slice(1);
              const stem = STEM_BANK[level][idx % STEM_BANK[level].length];
              return `${label}: ${stem}`;
            })
            .join(" • ");
          return {
            ...sec,
            studentActions:
              `${sec.studentActions || ""}\n\nHigher-Order Question Stems (Gifted) — ${additions}`.trim(),
          };
        });
        if (missingReport.length) {
          console.warn(
            "[Gifted Validation] Auto-augmented sections missing higher-order stems:\n" +
              missingReport.join("\n"),
          );
        } else {
          console.info(
            "[Gifted Validation] ✓ All sections contain analyze/evaluate/synthesize stems.",
          );
        }
      }

      // UDL compliance check: when Multiple Learning Styles is selected, every
      // section MUST offer Representation, Engagement, and Action/Expression.
      if (form.diff.includes("Multiple Learning Styles") && Array.isArray(parsed.sections)) {
        const UDL_BANK = {
          representation: [
            "Provide a visual anchor chart or diagram",
            "Offer an audio version or read-aloud",
            "Share a written transcript or leveled text",
          ],
          engagement: [
            "Offer student choice of topic or partner",
            "Connect content to a real-world relevance prompt",
            "Include a collaborative turn-and-talk",
          ],
          action: [
            "Allow response via writing, drawing, speaking, or building",
            "Provide a digital tool option (slides, video, infographic)",
            "Offer a hands-on/kinesthetic demonstration option",
          ],
        };
        const detectUdl = (text: string) => {
          const t = (text || "").toLowerCase();
          return {
            representation:
              /\b(visual|diagram|chart|infographic|audio|listen|read[- ]aloud|transcript|handout|video|caption)\b/.test(
                t,
              ),
            engagement:
              /\b(choice|choose|partner|group|collaborat|discuss|relevan|real[- ]world|interest|engage)\b/.test(
                t,
              ),
            action:
              /\b(write|draw|speak|present|build|model|create|demonstrate|record|act out|role[- ]play|digital|slides|infographic)\b/.test(
                t,
              ),
          };
        };
        const udlMissingReport: string[] = [];
        parsed.sections = parsed.sections.map((sec: any, idx: number) => {
          const blob = [sec.description, sec.teacherMoves, sec.studentActions, sec.udlNotes]
            .filter(Boolean)
            .join(" ");
          const has = detectUdl(blob);
          const missing = (Object.keys(has) as Array<keyof typeof has>).filter((k) => !has[k]);
          if (missing.length === 0) return sec;
          udlMissingReport.push(
            `Section ${idx + 1} "${sec.name || ""}" missing UDL: ${missing.join(", ")}`,
          );
          const additions = missing
            .map((principle) => {
              const label =
                principle === "action"
                  ? "Action & Expression"
                  : principle.charAt(0).toUpperCase() + principle.slice(1);
              const opt = UDL_BANK[principle][idx % UDL_BANK[principle].length];
              return `${label}: ${opt}`;
            })
            .join(" • ");
          return { ...sec, udlNotes: `${sec.udlNotes || ""}\n\nUDL Options — ${additions}`.trim() };
        });
        if (udlMissingReport.length) {
          console.warn(
            "[UDL Validation] Auto-augmented sections missing UDL principles:\n" +
              udlMissingReport.join("\n"),
          );
        } else {
          console.info(
            "[UDL Validation] ✓ All sections include representation, engagement, and action options.",
          );
        }
      }

      setResult(parsed);
      setDeckData(null); // invalidate cached deck so next export regenerates from new plan
      setSlidesError("");
    } catch (e) {
      setError(`Generation failed: ${e.message}`);
    }
    setLoading(false);
  };

  const buildPlanText = () => {
    if (!result) return "";
    return [
      `LESSON PLAN: ${result.title}`,
      `${result.gradeSubject} | ${result.duration}`,
      `Standard: ${result.standard}`,
      "",
      "OBJECTIVES:",
      ...(result.objectives || []).map((o) => `  - ${o}`),
      "",
      "SUCCESS CRITERIA (Students):",
      ...(result.successCriteria || []).map((s) => `  - ${s}`),
      "",
      "MATERIALS:",
      ...(result.materials || []).map((m) => `  - ${m}`),
      "",
      "KEY VOCABULARY:",
      (result.vocabulary || []).join(", "),
      "",
      ...(result.sections || []).flatMap((s) => [
        `=== ${s.name.toUpperCase()} (${s.duration}) ===`,
        s.description,
        `Teacher: ${s.teacherMoves}`,
        `Students: ${s.studentActions}`,
        s.udlNotes ? `UDL: ${s.udlNotes}` : "",
        "",
      ]),
      "ASSESSMENT:",
      `  Formative: ${result.assessment?.formative || ""}`,
      `  Exit Ticket: ${result.assessment?.exitTicket || ""}`,
      `  Summative: ${result.assessment?.summative || ""}`,
      "",
      ...(Array.isArray(result.dokQuestions) && result.dokQuestions.length
        ? [
            "DOK QUESTIONS (aligned to objectives):",
            ...result.dokQuestions.flatMap((lv) => [
              `  -- DOK ${lv.level} · ${lv.label} --`,
              ...(lv.items || []).map((q) => `    • ${q}`),
            ]),
            "",
          ]
        : []),
      "DIFFERENTIATION:",
      `  ELL: ${result.differentiation?.ell || ""}`,
      `  IEP: ${result.differentiation?.iep || ""}`,
      `  Gifted: ${result.differentiation?.gifted || ""}`,
      `  Universal: ${result.differentiation?.universal || ""}`,
      "",
      `HOMEWORK: ${result.homework || ""}`,
      "",
      `EXTENSION ACTIVITY: ${result.extension || ""}`,
      "",
      `TEACHER NOTES: ${result.teacherNotes || ""}`,
    ].join("\n");
  };

  // Copy: show selectable text box as fallback (works in all iframes/CSP)
  const copyPlan = async () => {
    if (!result) return;
    const text = buildPlanText();
    let success = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (e) {}
    if (!success) {
      // execCommand fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta);
        ta.select();
        success = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {}
    }
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // Final fallback: show selectable text box
      setShowCopyBox(true);
    }
  };

  // Print: write into a hidden iframe to avoid popup blockers and blob: CSP issues
  const printPlan = () => {
    if (!result) return;
    const safeHtml = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const sectionColors = ["#1E3A5F", "#CF27F5", "#0369A1", "#B45309", "#374151", "#166534"];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeHtml(result.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:820px}
h1{color:#CF27F5;font-size:22px;margin-bottom:4px}
.meta{font-size:12px;color:#666;margin-bottom:12px}
.std{background:#fdf4ff;border-left:4px solid #CF27F5;padding:8px 12px;font-size:12px;margin-bottom:16px}
h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
ul{padding-left:16px}li{margin-bottom:3px;font-size:12px}
.sec{margin-bottom:12px;border-radius:4px;overflow:hidden;border:1px solid #ddd;page-break-inside:avoid}
.sec-h{padding:6px 12px;color:white;font-weight:700;font-size:11px;display:flex;justify-content:space-between}
.sec-b{padding:10px 12px;font-size:12px;line-height:1.5}
.sec-b p{margin:0 0 4px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px}
.box{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;padding:8px 10px}
.box-l{font-size:9px;font-weight:700;text-transform:uppercase;color:#CF27F5;margin-bottom:3px}
.box p{font-size:11px;color:#333}
.hw{background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:10px 12px;font-size:12px;margin-bottom:10px}
.notes{background:#fefce8;border:1px solid #fde68a;border-radius:4px;padding:10px 12px;font-size:12px}
@media print{@page{margin:1.5cm}body{padding:0}}</style></head><body>
<h1>${safeHtml(result.title)}</h1>
<div class="meta">${safeHtml(result.gradeSubject)} | ${safeHtml(result.duration)}</div>
<div class="std"><strong>Standard:</strong> ${safeHtml(result.standard)}</div>
<h2>Objectives</h2><ul>${(result.objectives || []).map((o) => `<li>${safeHtml(o)}</li>`).join("")}</ul>
<h2>Success Criteria</h2><div class="hw" style="background:#f5f3ff;border-color:#ddd6fe">${(result.successCriteria || []).map((s) => `<div style="margin-bottom:4px">✓ ${safeHtml(s)}</div>`).join("")}</div>
<div class="g2"><div><h2 style="margin-top:0">Materials</h2><ul>${(result.materials || []).map((m) => `<li>${safeHtml(m)}</li>`).join("")}</ul></div>
<div><h2 style="margin-top:0">Key Vocabulary</h2><p style="font-size:12px">${(result.vocabulary || []).map((v) => safeHtml(v)).join(" · ")}</p></div></div>
<h2>Lesson Sequence</h2>
${(result.sections || []).map((s, i) => `<div class="sec"><div class="sec-h" style="background:${sectionColors[i] || "#374151"}"><span>${safeHtml(s.name)}</span><span style="opacity:0.75;font-weight:400">${safeHtml(s.duration)}</span></div><div class="sec-b"><p>${safeHtml(s.description)}</p><p><strong>Teacher:</strong> ${safeHtml(s.teacherMoves)}</p><p><strong>Students:</strong> ${safeHtml(s.studentActions)}</p>${s.udlNotes ? `<p style="color:#0369A1;font-size:11px">UDL: ${safeHtml(s.udlNotes)}</p>` : ""}</div></div>`).join("")}
<h2>Assessment</h2><div class="g3">
<div class="box"><div class="box-l">Formative</div><p>${safeHtml(result.assessment?.formative)}</p></div>
<div class="box"><div class="box-l">Exit Ticket</div><p>${safeHtml(result.assessment?.exitTicket)}</p></div>
<div class="box"><div class="box-l">Summative</div><p>${safeHtml(result.assessment?.summative)}</p></div></div>
${
  Array.isArray(result.dokQuestions) && result.dokQuestions.length
    ? `<h2>DOK Questions</h2><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">${result.dokQuestions
        .map((lv, li) => {
          const c =
            ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"][(lv.level || li + 1) - 1] || "#374151";
          return `<div style="background:${c}10;border:1.5px solid ${c}55;border-left:5px solid ${c};border-radius:6px;padding:8px 10px"><p style="font-size:11px;font-weight:800;color:${c};margin:0 0 5px;text-transform:uppercase;letter-spacing:0.5px">DOK ${lv.level} · ${safeHtml(lv.label)}</p><ul style="padding-left:16px;margin:0">${(lv.items || []).map((q) => `<li style="font-size:12px;color:#1F2937;margin-bottom:3px">${safeHtml(q)}</li>`).join("")}</ul></div>`;
        })
        .join("")}</div>`
    : ""
}
<h2>Differentiation</h2><div class="g2">
<div class="box"><div class="box-l">ELL</div><p>${safeHtml(result.differentiation?.ell)}</p></div>
<div class="box"><div class="box-l">IEP</div><p>${safeHtml(result.differentiation?.iep)}</p></div>
<div class="box"><div class="box-l">Gifted</div><p>${safeHtml(result.differentiation?.gifted)}</p></div>
<div class="box"><div class="box-l">Universal Design</div><p>${safeHtml(result.differentiation?.universal)}</p></div></div>
${result.homework ? `<h2>Homework</h2><div class="hw">${safeHtml(result.homework)}</div>` : ""}
${result.extension ? `<h2>Extension Activity</h2><div class="hw" style="background:#f0fdf4;border-color:#bbf7d0">${safeHtml(result.extension)}</div>` : ""}
${result.teacherNotes ? `<h2>Teacher Notes</h2><div class="notes">${safeHtml(result.teacherNotes)}</div>` : ""}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

    // Use hidden iframe — avoids popup blockers AND blob: CSP restrictions
    let iframe = document.getElementById("__lp_print_frame__");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "__lp_print_frame__";
      iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none;top:0;left:0";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        alert("Print blocked by browser. Please use Ctrl+P / Cmd+P to print.");
      }
    }, 600);
  };

  // ── Slide deck generation ─────────────────────────────────────────
  // Generates the deck JSON ONCE (caches in deckData) so all export formats
  // share the same content. Each export format renders the cached deck.
  const ensureDeck = async () => {
    if (deckData) return deckData;
    const lessonContext = buildPlanText().slice(0, 6000);
    const sys = `You are an instructional slide designer. Output ONLY a valid JSON object — no markdown, no fences. Start with { and end with }. Build a clear, classroom-ready slide deck from the provided lesson plan. Aim for 9–15 slides total. Each slide should have a short title and 2–6 concise bullet points. Cover (in order): Title slide, Objectives, Success Criteria ("I can…" statements for students), Standard, Key Vocabulary, one slide per lesson section (Do Now, I Do/Direct Instruction, We Do/Guided Practice, You Do/Independent, Closure — OR for the 5E model: Engage, Explore, Explain, Elaborate, Evaluate), Assessment / Exit Ticket, Differentiation highlights, Homework, and Extension Activity. Do NOT write "N/A". For EVERY slide, also include an "imagePrompt" field (8–18 words) describing a single classroom-friendly illustration that VISUALLY MATCHES that specific slide's content (use concrete nouns from the slide title/bullets; no text-in-image; no real people).`;
    const userMsg = `Build a slide deck from this lesson plan:\n\n${lessonContext}\n\nReturn this JSON shape:\n{\n  "title": "...",\n  "subtitle": "...",\n  "slides": [\n    {"title": "...", "bullets": ["...","..."], "kind": "title|content|section|closing", "imagePrompt": "..."}\n  ]\n}`;

    const raw = await callClaude(sys, userMsg, 3500);
    let clean = (raw || "").trim();
    if (clean.startsWith("```"))
      clean = clean
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    const s = clean.indexOf("{"),
      e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("AI response was not valid JSON.");
    const deck = JSON.parse(clean.slice(s, e + 1));
    if (!deck.slides || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      throw new Error("No slides were returned. Try again.");
    }

    // Generate one image per slide that visually matches that slide's content.
    // Limited concurrency so we don't overload the image gateway.
    setSlidesError("Generating slide images…");
    const concurrency = 3;
    let cursor = 0;
    const worker = async () => {
      while (cursor < deck.slides.length) {
        const idx = cursor++;
        const sl = deck.slides[idx];
        const promptBase =
          sl.imagePrompt || `${sl.title || ""} — ${(sl.bullets || []).slice(0, 2).join("; ")}`;
        const fullPrompt = `${promptBase}. Educational classroom illustration that visually represents this slide's topic. No text in image.`;
        try {
          const url = await generateImage({ prompt: fullPrompt, style: "clipart" });
          if (url) sl.imageUrl = url;
        } catch {
          /* skip image on failure */
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    setSlidesError("");

    setDeckData(deck);
    return deck;
  };

  // Build the standalone HTML deck string (used for HTML and PDF exports)
  const buildDeckHtml = (deck) => {
    const safe = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const slidesHtml = deck.slides
      .map((sl, i) => {
        const isTitle = sl.kind === "title" || i === 0;
        const bullets = Array.isArray(sl.bullets) ? sl.bullets : [];
        const imgTag = sl.imageUrl
          ? `<img class="slide-img" src="${sl.imageUrl}" alt="${safe(sl.title || "")}" />`
          : "";
        return `<section class="slide ${isTitle ? "slide-title" : ""}" data-i="${i}">
        <div class="slide-inner">
          ${
            isTitle
              ? `<div class="title-block">${imgTag}<h1>${safe(sl.title || deck.title)}</h1>${deck.subtitle ? `<p class="subtitle">${safe(deck.subtitle)}</p>` : ""}</div>`
              : `<h2>${safe(sl.title)}</h2><div class="slide-body">${imgTag ? `<div class="slide-text"><ul>${bullets.map((b) => `<li>${safe(b)}</li>`).join("")}</ul></div>${imgTag}` : `<ul>${bullets.map((b) => `<li>${safe(b)}</li>`).join("")}</ul>`}</div>`
          }
          <div class="slide-num">${i + 1} / ${deck.slides.length}</div>
        </div>
      </section>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safe(deck.title || result.title)} — Slide Deck</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#0F0A1A;font-family:'Inter','Segoe UI',sans-serif;color:#1F2937;overflow:hidden}
.deck{position:relative;width:100vw;height:100vh}
.slide{position:absolute;inset:0;display:none;background:linear-gradient(135deg,#FFFFFF 0%,#FDF4FF 100%);padding:6vh 8vw;animation:fadeIn .25s ease}
.slide.active{display:flex;flex-direction:column;justify-content:center}
.slide-title{background:linear-gradient(135deg,#8B0AB0 0%,#CF27F5 60%,#E05BFF 100%);color:white}
.slide-inner{max-width:1100px;margin:0 auto;width:100%;position:relative;height:100%;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Playfair Display',serif;font-size:clamp(36px,6vw,68px);font-weight:800;line-height:1.1;margin-bottom:18px}
.title-block{text-align:center}
.subtitle{font-size:clamp(16px,2vw,22px);font-weight:500;opacity:0.9;letter-spacing:0.5px}
h2{font-family:'Playfair Display',serif;font-size:clamp(28px,4vw,46px);font-weight:700;color:#8B0AB0;margin-bottom:28px;border-bottom:3px solid #CF27F5;padding-bottom:12px;display:inline-block}
ul{list-style:none;display:flex;flex-direction:column;gap:14px}
li{font-size:clamp(16px,2vw,24px);line-height:1.5;padding-left:34px;position:relative;color:#1F2937}
li::before{content:"●";position:absolute;left:0;color:#CF27F5;font-size:0.9em;top:0.15em}
.slide-body{display:flex;gap:32px;align-items:center}
.slide-text{flex:1;min-width:0}
.slide-img{max-width:38%;max-height:60vh;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,0.15);object-fit:contain;background:white}
.slide-title .slide-img{display:block;margin:0 auto 22px;max-width:340px;max-height:38vh;border-radius:18px}
.slide-num{position:absolute;bottom:-3vh;right:0;font-size:13px;color:#9CA3AF;font-weight:600;letter-spacing:1px}
.slide-title .slide-num{color:rgba(255,255,255,0.7)}
.controls{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);padding:8px 14px;border-radius:30px;z-index:10}
.controls button{background:transparent;border:none;color:white;cursor:pointer;font-size:14px;font-weight:600;padding:6px 12px;border-radius:20px;transition:background .15s;font-family:inherit}
.controls button:hover{background:rgba(255,255,255,0.18)}
.controls .pill{padding:6px 12px;color:rgba(255,255,255,0.8);font-size:13px;font-weight:600}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media print{
  html,body{background:white;overflow:visible;height:auto}
  .deck{height:auto}
  .slide{position:relative;display:flex !important;page-break-after:always;width:100vw;height:100vh;animation:none}
  .controls{display:none}
  @page{size:landscape;margin:0}
}
</style></head>
<body><div class="deck">${slidesHtml}</div>
<div class="controls">
  <button id="prev">◀ Prev</button>
  <span class="pill" id="pos">1 / ${deck.slides.length}</span>
  <button id="next">Next ▶</button>
  <button id="print">🖨️ Print / Save as PDF</button>
</div>
<script>
const slides=document.querySelectorAll('.slide');let i=0;
function show(n){slides[i].classList.remove('active');i=(n+slides.length)%slides.length;slides[i].classList.add('active');document.getElementById('pos').textContent=(i+1)+' / '+slides.length;}
slides[0].classList.add('active');
document.getElementById('next').onclick=()=>show(i+1);
document.getElementById('prev').onclick=()=>show(i-1);
document.getElementById('print').onclick=()=>window.print();
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown')show(i+1);
  else if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);
  else if(e.key==='Home')show(0);
  else if(e.key==='End')show(slides.length-1);
});
<\/script></body></html>`;
  };

  const deckBaseName = (deck) =>
    (deck?.title || result?.title || "lesson")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "lesson";

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // ── Export: HTML (interactive deck in new tab) ────────────────────
  const exportSlidesHTML = async () => {
    if (!result) return;
    setSlidesError("");
    setExportingFmt("html");
    setSlidesLoading(true);
    try {
      const deck = await ensureDeck();
      const html = buildDeckHtml(deck);
      const win = window.open("", "_blank");
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        triggerDownload(
          new Blob([html], { type: "text/html" }),
          `${deckBaseName(deck)}_slides.html`,
        );
      }
    } catch (err) {
      setSlidesError(`Could not generate slides: ${err.message}`);
    }
    setSlidesLoading(false);
    setExportingFmt("");
  };

  // ── Export: Plain text outline ────────────────────────────────────
  const exportSlidesText = async () => {
    if (!result) return;
    setSlidesError("");
    setExportingFmt("text");
    setSlidesLoading(true);
    try {
      const deck = await ensureDeck();
      const lines = [];
      lines.push(deck.title || result.title);
      if (deck.subtitle) lines.push(deck.subtitle);
      lines.push("=".repeat(60), "");
      deck.slides.forEach((sl, i) => {
        lines.push(`SLIDE ${i + 1}: ${sl.title || ""}`);
        lines.push("-".repeat(40));
        (sl.bullets || []).forEach((b) => lines.push(`  • ${b}`));
        lines.push("");
      });
      triggerDownload(
        new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
        `${deckBaseName(deck)}_slides.txt`,
      );
    } catch (err) {
      setSlidesError(`Could not generate slides: ${err.message}`);
    }
    setSlidesLoading(false);
    setExportingFmt("");
  };

  // ── Export: PDF (open the HTML deck and trigger print) ────────────
  const exportSlidesPDF = async () => {
    if (!result) return;
    setSlidesError("");
    setExportingFmt("pdf");
    setSlidesLoading(true);
    try {
      const deck = await ensureDeck();
      const html = buildDeckHtml(deck);
      // Open the deck in a new tab and auto-trigger the print dialog
      // so the user can pick "Save as PDF". Falls back to HTML download if popup-blocked.
      const printHtml = html.replace(
        "<\/script></body></html>",
        "setTimeout(()=>window.print(),500);<\/script></body></html>",
      );
      const win = window.open("", "_blank");
      if (win) {
        win.document.open();
        win.document.write(printHtml);
        win.document.close();
      } else {
        triggerDownload(
          new Blob([html], { type: "text/html" }),
          `${deckBaseName(deck)}_slides.html`,
        );
        setSlidesError("Popup blocked — downloaded as HTML. Open it and use Print → Save as PDF.");
      }
    } catch (err) {
      setSlidesError(`Could not generate slides: ${err.message}`);
    }
    setSlidesLoading(false);
    setExportingFmt("");
  };

  // Build a .pptx Blob from a deck (shared by PPTX + Google Slides exports)
  const buildPptxBlob = async (deck) => {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inch
    pptx.title = deck.title || result.title || "Lesson Slides";
    pptx.author = "The Tech Savvy Teacher";

    const PPTX_BRAND = "8B0AB0";
    const PPTX_ACCENT = "CF27F5";
    const PPTX_DARK = "1F2937";
    const PPTX_MUTED = "9CA3AF";

    deck.slides.forEach((sl, i) => {
      const isTitle = sl.kind === "title" || i === 0;
      const slide = pptx.addSlide();

      if (isTitle) {
        slide.background = { color: PPTX_BRAND };
        slide.addText(sl.title || deck.title || "Lesson", {
          x: 0.5,
          y: 2.4,
          w: 12.33,
          h: 1.6,
          fontSize: 54,
          bold: true,
          fontFace: "Calibri",
          color: "FFFFFF",
          align: "center",
          valign: "middle",
        });
        if (deck.subtitle) {
          slide.addText(deck.subtitle, {
            x: 0.5,
            y: 4.2,
            w: 12.33,
            h: 0.8,
            fontSize: 22,
            fontFace: "Calibri",
            color: "FDE7FF",
            align: "center",
            valign: "middle",
          });
        }
      } else {
        slide.background = { color: "FFFFFF" };
        slide.addText(sl.title || `Slide ${i + 1}`, {
          x: 0.6,
          y: 0.4,
          w: 12.13,
          h: 0.9,
          fontSize: 32,
          bold: true,
          fontFace: "Calibri",
          color: PPTX_BRAND,
        });
        slide.addShape("rect", {
          x: 0.6,
          y: 1.28,
          w: 1.6,
          h: 0.06,
          fill: { color: PPTX_ACCENT },
          line: { color: PPTX_ACCENT },
        });
        const bullets = (sl.bullets || []).map((b) => ({
          text: String(b),
          options: { bullet: { code: "25CF" }, color: PPTX_DARK, fontSize: 20 },
        }));
        const hasImg = typeof sl.imageUrl === "string" && sl.imageUrl.startsWith("data:image");
        const textW = hasImg ? 7.4 : 12.0;
        if (bullets.length) {
          slide.addText(bullets, {
            x: 0.7,
            y: 1.7,
            w: textW,
            h: 5.2,
            fontFace: "Calibri",
            lineSpacingMultiple: 1.3,
            valign: "top",
          });
        }
        if (hasImg) {
          slide.addImage({
            data: sl.imageUrl,
            x: 8.4,
            y: 1.7,
            w: 4.4,
            h: 4.4,
            sizing: { type: "contain", w: 4.4, h: 4.4 },
          });
        }
      }
      // For title slide, also add image (smaller, above title) if available
      if (isTitle && typeof sl.imageUrl === "string" && sl.imageUrl.startsWith("data:image")) {
        slide.addImage({
          data: sl.imageUrl,
          x: 5.17,
          y: 0.5,
          w: 3.0,
          h: 1.8,
          sizing: { type: "contain", w: 3.0, h: 1.8 },
        });
      }

      slide.addText(`${i + 1} / ${deck.slides.length}`, {
        x: 11.5,
        y: 7.05,
        w: 1.5,
        h: 0.35,
        fontSize: 11,
        fontFace: "Calibri",
        color: isTitle ? "FFFFFF" : PPTX_MUTED,
        align: "right",
      });
    });

    // pptxgenjs returns a Blob when output type is "blob"
    return await pptx.write({ outputType: "blob" });
  };

  // ── Export: PowerPoint (.pptx) ────────────────────────────────────
  const exportSlidesPPTX = async () => {
    if (!result) return;
    setSlidesError("");
    setExportingFmt("pptx");
    setSlidesLoading(true);
    try {
      const deck = await ensureDeck();
      const blob = await buildPptxBlob(deck);
      triggerDownload(blob, `${deckBaseName(deck)}_slides.pptx`);
    } catch (err) {
      setSlidesError(`Could not generate slides: ${err.message}`);
    }
    setSlidesLoading(false);
    setExportingFmt("");
  };

  // ── Export: Google Slides ─────────────────────────────────────────
  // Frontend-only browsers cannot create Google Slides without OAuth.
  // Best UX: download a .pptx (Slides imports it natively) and open the
  // Google Slides import flow in a new tab.
  const exportSlidesGoogle = async () => {
    if (!result) return;
    setSlidesError("");
    setExportingFmt("google");
    setSlidesLoading(true);
    try {
      const deck = await ensureDeck();
      const blob = await buildPptxBlob(deck);
      triggerDownload(blob, `${deckBaseName(deck)}_slides.pptx`);
      window.open("https://docs.google.com/presentation/u/0/?tgif=d", "_blank");
      setSlidesError(
        "✓ PowerPoint file downloaded. Google Slides opened in a new tab — go to File → Import slides → Upload, and pick the .pptx you just downloaded.",
      );
    } catch (err) {
      setSlidesError(`Could not generate slides: ${err.message}`);
    }
    setSlidesLoading(false);
    setExportingFmt("");
  };

  // Google Docs — open a new Google Doc synchronously (avoids popup blockers),
  // then copy the lesson plan to the clipboard as BOTH rich HTML and plain text
  // so a single Ctrl/Cmd+V in the new doc pastes the full formatted lesson.
  // (Per-user OAuth would be required to insert content programmatically; we
  // give the next best UX: one-click open + one-keystroke paste of rich content.)
  const exportToGoogleDocs = async () => {
    if (!result) return;
    setShowExportMenu(false);
    // CRITICAL: open the window SYNCHRONOUSLY in the click handler — any await
    // before window.open() will trigger Chrome/Safari popup blockers.
    const win = window.open("https://docs.google.com/document/create", "_blank");

    const plainText = buildPlanText();
    const richHtml = buildPlanHtml();
    let copiedOk = false;

    // Prefer rich HTML clipboard so formatting (headings, bullets, bold) survives the paste.
    try {
      if ((window as any).ClipboardItem && navigator.clipboard?.write) {
        const item = new (window as any).ClipboardItem({
          "text/html": new Blob([richHtml], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
        copiedOk = true;
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
        copiedOk = true;
      }
    } catch {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(plainText);
          copiedOk = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (!win || win.closed) {
      setShowGdocsBox(true);
      setShowCopyBox(false);
      return;
    }
    if (copiedOk) {
      setTimeout(
        () =>
          alert(
            "✓ Lesson plan (with formatting) copied to clipboard.\n\nA new Google Doc opened in another tab — click into it and press Ctrl+V (Cmd+V on Mac) to paste the full lesson.",
          ),
        300,
      );
    } else {
      setShowGdocsBox(true);
      setShowCopyBox(false);
    }
  };

  // Helper: trigger download of a Blob
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const safeFileName = () =>
    (result?.title || "Lesson Plan")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_") || "Lesson_Plan";

  // Build the same rich HTML used for Print — reused for PDF + Word
  const buildPlanHtml = () => {
    const safeHtml = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const sectionColors = ["#1E3A5F", "#CF27F5", "#0369A1", "#B45309", "#374151", "#166534"];
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeHtml(result.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:820px}
h1{color:#CF27F5;font-size:22px;margin-bottom:4px}
.meta{font-size:12px;color:#666;margin-bottom:12px}
.std{background:#fdf4ff;border-left:4px solid #CF27F5;padding:8px 12px;font-size:12px;margin-bottom:16px}
h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
ul{padding-left:18px}li{margin-bottom:3px;font-size:12px}
.sec{margin-bottom:12px;border:1px solid #ddd}
.sec-h{padding:6px 12px;color:white;font-weight:700;font-size:11px}
.sec-b{padding:10px 12px;font-size:12px;line-height:1.5}
.box{background:#f9f9f9;border:1px solid #ddd;padding:8px 10px;margin-bottom:6px}
.box-l{font-size:9px;font-weight:700;text-transform:uppercase;color:#CF27F5;margin-bottom:3px}</style></head><body>
<h1>${safeHtml(result.title)}</h1>
<div class="meta">${safeHtml(result.gradeSubject)} | ${safeHtml(result.duration)}</div>
<div class="std"><strong>Standard:</strong> ${safeHtml(result.standard)}</div>
<h2>Objectives</h2><ul>${(result.objectives || []).map((o) => `<li>${safeHtml(o)}</li>`).join("")}</ul>
<h2>Success Criteria</h2><ul>${(result.successCriteria || []).map((s) => `<li>${safeHtml(s)}</li>`).join("")}</ul>
<h2>Materials</h2><ul>${(result.materials || []).map((m) => `<li>${safeHtml(m)}</li>`).join("")}</ul>
<h2>Key Vocabulary</h2><p style="font-size:12px">${(result.vocabulary || []).map((v) => safeHtml(v)).join(" · ")}</p>
<h2>Lesson Sequence</h2>
${(result.sections || []).map((s, i) => `<div class="sec"><div class="sec-h" style="background:${sectionColors[i] || "#374151"}">${safeHtml(s.name)} — ${safeHtml(s.duration)}</div><div class="sec-b"><p>${safeHtml(s.description)}</p><p><strong>Teacher:</strong> ${safeHtml(s.teacherMoves)}</p><p><strong>Students:</strong> ${safeHtml(s.studentActions)}</p>${s.udlNotes ? `<p style="color:#0369A1">UDL: ${safeHtml(s.udlNotes)}</p>` : ""}</div></div>`).join("")}
<h2>Assessment</h2>
<div class="box"><div class="box-l">Formative</div><p>${safeHtml(result.assessment?.formative)}</p></div>
<div class="box"><div class="box-l">Exit Ticket</div><p>${safeHtml(result.assessment?.exitTicket)}</p></div>
<div class="box"><div class="box-l">Summative</div><p>${safeHtml(result.assessment?.summative)}</p></div>
${Array.isArray(result.dokQuestions) && result.dokQuestions.length ? `<h2>DOK Questions</h2>${result.dokQuestions.map((lv) => `<div class="box"><div class="box-l">DOK ${lv.level} · ${safeHtml(lv.label)}</div><ul>${(lv.items || []).map((q) => `<li>${safeHtml(q)}</li>`).join("")}</ul></div>`).join("")}` : ""}
<h2>Differentiation</h2>
<div class="box"><div class="box-l">ELL</div><p>${safeHtml(result.differentiation?.ell)}</p></div>
<div class="box"><div class="box-l">IEP</div><p>${safeHtml(result.differentiation?.iep)}</p></div>
<div class="box"><div class="box-l">Gifted</div><p>${safeHtml(result.differentiation?.gifted)}</p></div>
<div class="box"><div class="box-l">Universal Design</div><p>${safeHtml(result.differentiation?.universal)}</p></div>
${result.homework ? `<h2>Homework</h2><p style="font-size:12px">${safeHtml(result.homework)}</p>` : ""}
${result.extension ? `<h2>Extension Activity</h2><p style="font-size:12px">${safeHtml(result.extension)}</p>` : ""}
${result.teacherNotes ? `<h2>Teacher Notes</h2><p style="font-size:12px">${safeHtml(result.teacherNotes)}</p>` : ""}
</body></html>`;
  };

  // PDF — reuse print pipeline (browser "Save as PDF")
  const exportPDF = () => {
    setShowExportMenu(false);
    printPlan();
  };

  // Word (.doc) — HTML wrapped with Word MIME; opens cleanly in Microsoft Word & Google Docs
  const exportWord = () => {
    if (!result) return;
    setShowExportMenu(false);
    const html =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
      buildPlanHtml().replace(/^<!DOCTYPE html>|<html>|<\/html>$/g, "") +
      "</html>";
    downloadBlob(
      new Blob(["\ufeff", html], { type: "application/msword" }),
      `${safeFileName()}.doc`,
    );
  };

  // CSV — structured rows for standards tracking / data backup
  const exportCSV = () => {
    if (!result) return;
    setShowExportMenu(false);
    const esc = (v) =>
      `"${String(v || "")
        .replace(/"/g, '""')
        .replace(/\r?\n/g, " ")}"`;
    const rows = [["Section", "Field", "Value"]];
    rows.push(["Meta", "Title", result.title]);
    rows.push(["Meta", "Grade/Subject", result.gradeSubject]);
    rows.push(["Meta", "Duration", result.duration]);
    rows.push(["Meta", "Standard", result.standard]);
    (result.objectives || []).forEach((o, i) => rows.push(["Objectives", `#${i + 1}`, o]));
    (result.successCriteria || []).forEach((s, i) =>
      rows.push(["Success Criteria", `#${i + 1}`, s]),
    );
    (result.materials || []).forEach((m, i) => rows.push(["Materials", `#${i + 1}`, m]));
    (result.vocabulary || []).forEach((v, i) => rows.push(["Vocabulary", `#${i + 1}`, v]));
    (result.sections || []).forEach((s) => {
      rows.push([`Section: ${s.name}`, "Duration", s.duration]);
      rows.push([`Section: ${s.name}`, "Description", s.description]);
      rows.push([`Section: ${s.name}`, "Teacher Moves", s.teacherMoves]);
      rows.push([`Section: ${s.name}`, "Student Actions", s.studentActions]);
      if (s.udlNotes) rows.push([`Section: ${s.name}`, "UDL", s.udlNotes]);
    });
    rows.push(["Assessment", "Formative", result.assessment?.formative]);
    rows.push(["Assessment", "Exit Ticket", result.assessment?.exitTicket]);
    rows.push(["Assessment", "Summative", result.assessment?.summative]);
    (result.dokQuestions || []).forEach((lv) =>
      (lv.items || []).forEach((q, i) =>
        rows.push([`DOK ${lv.level} ${lv.label || ""}`, `Q${i + 1}`, q]),
      ),
    );
    rows.push(["Differentiation", "ELL", result.differentiation?.ell]);
    rows.push(["Differentiation", "IEP", result.differentiation?.iep]);
    rows.push(["Differentiation", "Gifted", result.differentiation?.gifted]);
    rows.push(["Differentiation", "Universal", result.differentiation?.universal]);
    rows.push(["Homework", "", result.homework]);
    rows.push(["Extension", "", result.extension]);
    rows.push(["Teacher Notes", "", result.teacherNotes]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    downloadBlob(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      `${safeFileName()}.csv`,
    );
  };

  // Google Classroom — share lesson via Classroom share link
  const exportGoogleClassroom = () => {
    if (!result) return;
    setShowExportMenu(false);
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : "https://thetechsavvyteacher.lovable.app";
    const shareUrl = `https://classroom.google.com/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(result.title)}&body=${encodeURIComponent(buildPlanText().slice(0, 1500))}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  // Canvas / Edmodo / other LMS — instruct to import the .doc or copy text
  const exportLMSGuidance = (lms) => {
    setShowExportMenu(false);
    exportWord();
    setTimeout(
      () =>
        alert(
          `Word file downloaded.\n\nTo import into ${lms}:\n1. Open ${lms} → create a new Assignment / Page\n2. Upload the downloaded .doc OR paste the copied text\n3. Save & assign to your class.`,
        ),
      400,
    );
  };

  // Inline Standards Picker for lesson plan
  const [stdSubj, setStdSubj] = useState("ELA");
  const [stdBand, setStdBand] = useState("Kindergarten");
  const [stdSearch, setStdSearch] = useState("");
  const stdBands = Object.keys(getActiveStandards()[stdSubj] || {});
  const stdList = (getActiveStandards()[stdSubj]?.[stdBand] || []).filter(
    (s) =>
      !stdSearch.trim() ||
      s.code.toLowerCase().includes(stdSearch.toLowerCase()) ||
      s.desc.toLowerCase().includes(stdSearch.toLowerCase()),
  );

  const lbl = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6B7280",
    display: "block",
    marginBottom: 5,
  };
  const inp = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 7,
    border: "1.5px solid #D1D5DB",
    fontFamily: "'Inter',sans-serif",
    fontSize: 13,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    background: "white",
  };

  return (
    <div
      className="lesson-grid"
      style={{
        padding: "28px 32px",
        maxWidth: 1320,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "460px 1fr",
        gap: 28,
        alignItems: "start",
      }}
    >
      {/* LEFT: Form */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div style={{ background: BRAND, padding: "12px 18px" }}>
          <span
            style={{
              fontFamily: "'Playfair Display',serif",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            📋 Lesson Details
          </span>
        </div>
        <div style={{ padding: "18px 18px 22px" }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}
          >
            <div>
              <label style={lbl}>Grade</label>
              <select
                value={form.grade}
                onChange={(e) => setF("grade", e.target.value)}
                style={{ ...inp, cursor: "pointer" }}
              >
                {GRADES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Duration</label>
              {(() => {
                const isOther = !LP_DURATIONS.includes(form.duration);
                return (
                  <>
                    <select
                      value={isOther ? "Other" : form.duration}
                      onChange={(e) => {
                        if (e.target.value === "Other") setF("duration", "");
                        else setF("duration", e.target.value);
                      }}
                      style={{ ...inp, cursor: "pointer" }}
                    >
                      {LP_DURATIONS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                      <option value="Other">Other…</option>
                    </select>
                    {isOther && (
                      <input
                        type="text"
                        value={form.duration}
                        onChange={(e) => setF("duration", e.target.value)}
                        placeholder="e.g. 75 minutes"
                        style={{ ...inp, marginTop: 8 }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Subject</label>
            <SpellInput
              type="text"
              value={form.subject}
              onChange={(e) => setF("subject", e.target.value)}
              spellCheck
              placeholder="e.g. ELA, Mathematics, Science…"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Lesson Topic / Title</label>
            <SpellInput
              type="text"
              value={form.topic}
              onChange={(e) => setF("topic", e.target.value)}
              spellCheck
              placeholder="e.g. Introduction to Fractions"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Instructional Model</label>
            <select
              value={form.model}
              onChange={(e) => setF("model", e.target.value)}
              style={{ ...inp, cursor: "pointer" }}
            >
              {LP_MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Learning Objectives (optional — AI will suggest if blank)</label>
            <SpellTextarea
              value={form.objectives}
              onChange={(e) => setF("objectives", e.target.value)}
              spellCheck
              placeholder="Students will be able to…"
              style={{ ...inp, minHeight: 72, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Materials (optional)</label>
            <SpellTextarea
              value={form.materials}
              onChange={(e) => setF("materials", e.target.value)}
              spellCheck
              placeholder="Textbooks, manipulatives, handouts…"
              style={{ ...inp, minHeight: 56, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* State Standard Picker — hidden when the selected state has no standards loaded */}
          {stHasStandards && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{stInfo.name} Standard</label>
            {form.standard ? (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div
                  style={{
                    flex: 1,
                    background: LIGHT,
                    border: `1.5px solid ${BRAND}`,
                    borderRadius: 7,
                    padding: "8px 11px",
                    fontSize: 12,
                    color: "#111827",
                    lineHeight: 1.4,
                  }}
                >
                  {form.standard}
                </div>
                <button
                  onClick={() => {
                    setF("standard", "");
                    setShowStdPicker(false);
                  }}
                  style={{
                    padding: "6px 9px",
                    borderRadius: 6,
                    border: "1.5px solid #FCA5A5",
                    background: "#FEF2F2",
                    color: "#DC2626",
                    cursor: "pointer",
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowStdPicker((p) => !p)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 7,
                  border: `1.5px dashed ${BRAND}`,
                  background: LIGHT,
                  color: BRAND,
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {showStdPicker
                  ? "▲ Hide Standards"
                  : `${stInfo.flag} Browse ${stInfo.standardsShort}`}
              </button>
            )}

            {showStdPicker && !form.standard && (
              <div
                style={{
                  marginTop: 10,
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#F9FAFB",
                    borderBottom: "1px solid #E5E7EB",
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={stdSubj}
                    onChange={(e) => {
                      const s = e.target.value;
                      setStdSubj(s);
                      setStdBand(
                        gradeIdToStdBand(form.grade, s) ||
                          (s === "ELA"
                            ? "Kindergarten"
                            : Object.keys(NY_STANDARDS[s] || {})[0] || ""),
                      );
                    }}
                    style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 12 }}
                  >
                    {Object.keys(NY_STANDARDS).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={stdBand}
                    onChange={(e) => setStdBand(e.target.value)}
                    style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 12 }}
                  >
                    {stdBands.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={stdSearch}
                    onChange={(e) => setStdSearch(e.target.value)}
                    placeholder="Search…"
                    style={{ ...inp, flex: 2, padding: "6px 8px", fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => setStdBand(gradeIdToStdBand(form.grade, stdSubj))}
                    title={`Match ${GRADES.find((g) => g.id === form.grade)?.name || form.grade}`}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 10,
                      border: `1px solid ${BRAND}`,
                      background: LIGHT,
                      color: BRAND,
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 700,
                      fontSize: 10,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🎯 Match grade
                  </button>
                  <span style={{ fontSize: 10, color: "#9CA3AF", alignSelf: "center" }}>
                    {stdList.length} found
                  </span>
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {stdList.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setF("standard", `${s.code}: ${s.desc}`);
                        setShowStdPicker(false);
                        setStdSearch("");
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 12px",
                        border: "none",
                        borderBottom: "1px solid #F3F4F6",
                        background: "white",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = LIGHT)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: BRAND,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          marginBottom: 2,
                        }}
                      >
                        {s.code}
                      </div>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                        {s.desc}
                      </div>
                    </button>
                  ))}
                  {stdList.length === 0 && (
                    <p style={{ padding: "14px 12px", fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                      No standards match.
                    </p>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {/* Exemplar Upload */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>
              Exemplar / Format Template{" "}
              <span
                style={{
                  fontWeight: 500,
                  textTransform: "none",
                  letterSpacing: 0,
                  color: "#9CA3AF",
                }}
              >
                (optional)
              </span>
            </label>
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 11.5,
                color: "#9CA3AF",
                margin: "0 0 10px",
                lineHeight: 1.5,
              }}
            >
              Share a lesson plan you love as a format guide — the AI will match its structure.
            </p>

            {/* Tab switcher */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 10,
                border: "1.5px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {[
                ["file", "📎 File / Image"],
                ["url", "🔗 Google Doc / URL"],
                ["text", "📋 Paste Text"],
              ].map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => {
                    setExMode(id);
                    clearExemplar();
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    border: "none",
                    borderRight: id !== "text" ? "1px solid #E5E7EB" : "none",
                    background: exMode === id ? BRAND : "white",
                    color: exMode === id ? "white" : "#374151",
                    fontFamily: "'Inter',sans-serif",
                    fontWeight: exMode === id ? 700 : 500,
                    fontSize: 11.5,
                    cursor: "pointer",
                    transition: "all 0.12s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {/* ── Shared: analyzed result ── */}
            {(exemplarDesc || analyzingEx) && (
              <div
                style={{
                  border: `1.5px solid ${BRAND}40`,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: LIGHT,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderBottom: exemplarDesc ? "1px solid #E5E7EB" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      background: "white",
                      border: "1px solid #E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {exemplarFile?.preview ? (
                      <img
                        src={exemplarFile.preview}
                        alt=""
                        style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 5 }}
                      />
                    ) : (
                      "📄"
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#111827",
                      }}
                    >
                      {exemplarFile?.name ||
                        (exMode === "url" ? "Google Doc / URL" : "Pasted text")}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 11,
                        color: analyzingEx ? BRAND : "#6B7280",
                        marginTop: 2,
                      }}
                    >
                      {analyzingEx ? "⚡ Analyzing structure…" : "✓ Format analyzed — ready to use"}
                    </div>
                  </div>
                  <button
                    onClick={clearExemplar}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "1.5px solid #FCA5A5",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
                {analyzingEx && (
                  <div
                    style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 13,
                        height: 13,
                        border: `2px solid ${BRAND}30`,
                        borderTopColor: BRAND,
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontFamily: "'Inter',sans-serif", fontSize: 11.5, color: "#9CA3AF" }}
                    >
                      Reading format and structure…
                    </span>
                  </div>
                )}
                {exemplarDesc && !analyzingEx && (
                  <div style={{ padding: "10px 12px" }}>
                    <p
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 11.5,
                        color: "#374151",
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {exemplarDesc}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: File Upload ── */}
            {exMode === "file" && !exemplarDesc && !analyzingEx && (
              <label
                ref={dropRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDraggingOver(true);
                }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={handleDrop}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "18px 14px",
                  borderRadius: 8,
                  border: `2px dashed ${draggingOver ? BRAND : "#D1D5DB"}`,
                  background: draggingOver ? LIGHT : "#FAFAFA",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 26 }} aria-hidden="true">
                  📎
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      color: draggingOver ? BRAND : "#374151",
                    }}
                  >
                    {draggingOver ? "Drop it here!" : "Drop your exemplar here"}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 11.5,
                      color: "#9CA3AF",
                      marginTop: 3,
                    }}
                  >
                    or click to browse
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 10.5,
                      color: "#D1D5DB",
                      marginTop: 4,
                    }}
                  >
                    Supports: PNG, JPG, PDF, Word (.docx), Text (.txt)
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt,.md,.rtf"
                  aria-label="Upload exemplar lesson plan"
                  onChange={(e) => e.target.files[0] && handleExemplarFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </label>
            )}

            {/* ── Tab: Google Doc / URL ── */}
            {exMode === "url" && !exemplarDesc && !analyzingEx && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 11.5,
                    color: "#374151",
                    lineHeight: 1.6,
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: 7,
                    padding: "10px 12px",
                  }}
                >
                  <strong>📋 Google Docs (recommended steps):</strong>
                  <br />
                  1. Open your Google Doc
                  <br />
                  2. <strong>File → Download → Plain Text (.txt)</strong>
                  <br />
                  3. Upload that file using the <strong>📎 File/Image</strong> tab
                  <br />
                  <br />
                  <em>— or —</em>
                  <br />
                  <br />
                  Select All → Copy → paste into the <strong>📋 Paste Text</strong> tab.
                  <br />
                  <br />
                  <strong>Other URLs</strong> (non-Google): paste below and click Analyze.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    value={exemplarUrl}
                    onChange={(e) => {
                      setExemplarUrl(e.target.value);
                      setExError("");
                    }}
                    placeholder="https://… (non-Google Doc URLs)"
                    onKeyDown={(e) => e.key === "Enter" && handleUrlAnalyze()}
                    style={{
                      flex: 1,
                      padding: "9px 11px",
                      borderRadius: 7,
                      border: "1.5px solid #D1D5DB",
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 13,
                      color: "#111827",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleUrlAnalyze}
                    disabled={!exemplarUrl.trim()}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 7,
                      border: "none",
                      background: exemplarUrl.trim() ? BRAND : "#E5E7EB",
                      color: exemplarUrl.trim() ? "white" : "#9CA3AF",
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: exemplarUrl.trim() ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Analyze →
                  </button>
                </div>
                {exError && (
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 11.5,
                      color: "#DC2626",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {exError}
                  </p>
                )}
              </div>
            )}

            {/* ── Tab: Paste Text ── */}
            {exMode === "text" && !exemplarDesc && !analyzingEx && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SpellTextarea
                  value={exemplarText}
                  onChange={(e) => {
                    setExemplarText(e.target.value);
                    setExError("");
                  }}
                  placeholder="Paste your exemplar lesson plan text here — from Google Docs, Word, Notion, or anywhere else…"
                  style={{
                    width: "100%",
                    minHeight: 120,
                    padding: "10px 12px",
                    borderRadius: 7,
                    border: "1.5px solid #D1D5DB",
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12.5,
                    color: "#111827",
                    outline: "none",
                    resize: "vertical",
                    lineHeight: 1.6,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleTextAnalyze}
                  disabled={!exemplarText.trim()}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: exemplarText.trim() ? BRAND : "#E5E7EB",
                    color: exemplarText.trim() ? "white" : "#9CA3AF",
                    fontFamily: "'Inter',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: exemplarText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Analyze Format →
                </button>
                {exError && (
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 11.5,
                      color: "#DC2626",
                      margin: 0,
                    }}
                  >
                    {exError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Differentiation */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Differentiation (select all that apply)</label>
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 11.5,
                color: "#9CA3AF",
                margin: "0 0 8px",
                lineHeight: 1.5,
              }}
            >
              Selected needs are woven into every section of the generated lesson.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {LP_DIFF.map((d) => (
                <label
                  key={d}
                  style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={form.diff.includes(d)}
                    onChange={() => toggleDiff(d)}
                    style={{ accentColor: BRAND, width: 15, height: 15 }}
                  />
                  <span
                    style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#374151" }}
                  >
                    {d}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Idea Helper */}
          <div
            style={{
              marginBottom: 14,
              border: "1.5px solid #E5E7EB",
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setAiHelperOpen((v) => !v)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: aiHelperOpen ? BRAND : "#F9FAFB",
                color: aiHelperOpen ? "white" : "#374151",
                fontFamily: "'Inter',sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16 }}>🤖</span>
              <span>AI Idea Helper — Get suggestions for your lesson</span>
              <span style={{ marginLeft: "auto", fontSize: 11 }}>{aiHelperOpen ? "▲" : "▼"}</span>
            </button>
            {aiHelperOpen && (
              <div style={{ padding: "12px 14px", background: "white" }}>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12,
                    color: "#6B7280",
                    margin: "0 0 10px",
                    lineHeight: 1.5,
                  }}
                >
                  Ask AI to help you fill in a field. Fill in Subject and Topic first for best
                  results.
                </p>
                <label style={{ ...lbl, marginTop: 0 }}>Generate ideas for:</label>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    ["objectives", "Learning Objectives"],
                    ["materials", "Materials"],
                    ["notes", "Teacher Notes"],
                  ].map(([id, lbl2]) => (
                    <button
                      key={id}
                      onClick={() => setAiHelperField(id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: `1.5px solid ${aiHelperField === id ? BRAND : "#E5E7EB"}`,
                        background: aiHelperField === id ? LIGHT : "white",
                        color: aiHelperField === id ? BRAND : "#374151",
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {lbl2}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runAiHelper}
                  disabled={aiHelperLoading}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 7,
                    border: "none",
                    background: aiHelperLoading ? "#E5E7EB" : BRAND,
                    color: aiHelperLoading ? "#9CA3AF" : "white",
                    fontFamily: "'Inter',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: aiHelperLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  {aiHelperLoading ? (
                    <>
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTopColor: "white",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      Thinking…
                    </>
                  ) : (
                    "✨ Get Ideas"
                  )}
                </button>
                {aiHelperResult && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12.5,
                        color: "#111827",
                        margin: "0 0 8px",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {aiHelperResult}
                    </p>
                    <button
                      onClick={applyAiHelper}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: "#059669",
                        color: "white",
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ✓ Use This
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes / Additional Context */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>
              Additional Notes / Context{" "}
              <span
                style={{
                  textTransform: "none",
                  fontWeight: 500,
                  letterSpacing: 0,
                  color: "#9CA3AF",
                }}
              >
                (optional)
              </span>
            </label>
            <SpellTextarea
              value={form.notes}
              onChange={(e) => setF("notes", e.target.value)}
              spellCheck
              placeholder="Any special context, IEP goals to address, class size, prior knowledge, or specific requirements…"
              style={{
                ...inp,
                minHeight: 70,
                resize: "vertical",
                lineHeight: 1.6,
                background: "#FAFAFA",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 7,
                padding: "10px 14px",
                color: "#DC2626",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading || !form.subject.trim() || !form.topic.trim()}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 8,
              border: "none",
              background: !form.subject.trim() || !form.topic.trim() || loading ? "#E5E7EB" : BRAND,
              color: !form.subject.trim() || !form.topic.trim() || loading ? "#9CA3AF" : "white",
              fontFamily: "'Inter',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              cursor:
                !form.subject.trim() || !form.topic.trim() || loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              letterSpacing: 0.3,
              boxShadow:
                !form.subject.trim() || !form.topic.trim() || loading
                  ? "none"
                  : `0 3px 12px ${BRAND}44`,
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Building lesson plan…
              </>
            ) : (
              "✦  Generate Lesson Plan"
            )}
          </button>
        </div>
      </div>

      {/* RIGHT: Result */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: BRAND,
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display',serif",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            📄 Lesson Plan
          </span>
        </div>

        {showCopyBox && (
          <div
            style={{
              padding: "12px 18px",
              background: "#F0FDF4",
              borderBottom: "1px solid #86EFAC",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                Select all text below and copy (Ctrl+A then Ctrl+C):
              </span>
              <button
                onClick={() => setShowCopyBox(false)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#6B7280",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <textarea
              readOnly
              value={buildPlanText()}
              onClick={(e) => e.target.select()}
              style={{
                width: "100%",
                height: 160,
                fontFamily: "monospace",
                fontSize: 11,
                padding: 8,
                border: "1px solid #86EFAC",
                borderRadius: 6,
                resize: "vertical",
                background: "white",
              }}
            />
          </div>
        )}

        {/* Google Docs export box */}
        {showGdocsBox && (
          <div
            style={{
              padding: "12px 18px",
              background: "#EFF6FF",
              borderBottom: "1px solid #BAE6FD",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1E40AF",
                }}
              >
                Export to Google Docs — 2 steps:
              </span>
              <button
                onClick={() => setShowGdocsBox(false)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#6B7280",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 12,
                color: "#1E40AF",
                margin: "0 0 8px",
                lineHeight: 1.6,
              }}
            >
              <strong>Step 1:</strong> Select all text below (Ctrl+A / Cmd+A) and copy it.
              <br />
              <strong>Step 2:</strong> Go to{" "}
              <a
                href="https://docs.new"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1D4ED8", fontWeight: 700 }}
              >
                docs.new
              </a>{" "}
              → paste (Ctrl+V / Cmd+V) into the blank document.
            </p>
            <textarea
              readOnly
              value={buildPlanText()}
              onClick={(e) => e.target.select()}
              style={{
                width: "100%",
                height: 160,
                fontFamily: "monospace",
                fontSize: 11,
                padding: 8,
                border: "1px solid #BAE6FD",
                borderRadius: 6,
                resize: "vertical",
                background: "white",
              }}
            />
          </div>
        )}

        {loading ? (
          <div
            style={{
              padding: "80px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid #E5E7EB`,
                borderTopColor: BRAND,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: "#6B7280",
                fontStyle: "italic",
              }}
            >
              Building your lesson plan…
            </p>
          </div>
        ) : result ? (
          <div style={{ padding: "24px 28px" }}>
            {/* Header */}
            <h2
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                color: BRAND,
                margin: "0 0 4px",
              }}
            >
              {result.title}
            </h2>
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: "#6B7280",
                margin: "0 0 16px",
              }}
            >
              {result.gradeSubject} &nbsp;|&nbsp; {result.duration}
            </p>
            <div
              style={{
                background: LIGHT,
                borderLeft: `4px solid ${BRAND}`,
                borderRadius: "0 7px 7px 0",
                padding: "9px 14px",
                marginBottom: 20,
                fontSize: 12,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: BRAND }}>Standard:</strong> {result.standard}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {/* Objectives */}
              <div>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#6B7280",
                    margin: "0 0 8px",
                  }}
                >
                  Objectives
                </p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(result.objectives || []).map((o, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12.5,
                        color: "#1F2937",
                        lineHeight: 1.5,
                        marginBottom: 5,
                      }}
                    >
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Materials */}
              <div>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#6B7280",
                    margin: "0 0 8px",
                  }}
                >
                  Materials
                </p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(result.materials || []).map((m, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12.5,
                        color: "#1F2937",
                        lineHeight: 1.5,
                        marginBottom: 5,
                      }}
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Vocabulary */}
              <div>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#6B7280",
                    margin: "0 0 8px",
                  }}
                >
                  Key Vocabulary
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(result.vocabulary || []).map((v, i) => (
                    <span
                      key={i}
                      style={{
                        background: LIGHT,
                        color: BRAND,
                        border: `1px solid ${BRAND}30`,
                        borderRadius: 20,
                        padding: "2px 10px",
                        fontSize: 12,
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 600,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Success Criteria */}
            {(result.successCriteria || []).length > 0 && (
              <div
                style={{
                  marginBottom: 20,
                  background: "#F5F3FF",
                  border: "1px solid #DDD6FE",
                  borderRadius: 8,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#6D28D9",
                    margin: "0 0 8px",
                  }}
                >
                  Success Criteria — Students will know they've succeeded when they can:
                </p>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                  {(result.successCriteria || []).map((sc, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 13,
                        color: "#1F2937",
                        lineHeight: 1.55,
                        marginBottom: 5,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "#7C3AED", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span>{sc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lesson Sequence */}
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#6B7280",
                margin: "0 0 10px",
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 8,
              }}
            >
              Lesson Sequence
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {(result.sections || []).map((sec, i) => {
                const sectionColors = [
                  "#1E3A5F",
                  "#CF27F5",
                  "#0369A1",
                  "#B45309",
                  "#374151",
                  "#166534",
                ];
                const bgColor = sectionColors[i] || "#374151";
                return (
                  <div
                    key={i}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}
                  >
                    <div
                      style={{
                        background: bgColor,
                        padding: "7px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "white",
                        }}
                      >
                        {sec.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 11,
                          color: "rgba(255,255,255,0.75)",
                          fontWeight: 600,
                        }}
                      >
                        {sec.duration}
                      </span>
                    </div>
                    <div style={{ padding: "10px 14px" }}>
                      <p
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 13,
                          color: "#374151",
                          margin: "0 0 7px",
                          lineHeight: 1.55,
                        }}
                      >
                        {sec.description}
                      </p>
                      <p
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 12,
                          color: "#6B7280",
                          margin: "0 0 4px",
                        }}
                      >
                        <strong style={{ color: "#374151" }}>Teacher:</strong> {sec.teacherMoves}
                      </p>
                      <p
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 12,
                          color: "#6B7280",
                          margin: sec.udlNotes ? "0 0 4px" : 0,
                        }}
                      >
                        <strong style={{ color: "#374151" }}>Students:</strong> {sec.studentActions}
                      </p>
                      {sec.udlNotes && (
                        <p
                          style={{
                            fontFamily: "'Inter',sans-serif",
                            fontSize: 11.5,
                            color: "#0369A1",
                            margin: 0,
                            background: "#F0F9FF",
                            borderRadius: 5,
                            padding: "4px 8px",
                            marginTop: 5,
                          }}
                        >
                          🖼️ <strong>UDL/Visual:</strong> {sec.udlNotes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment */}
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#6B7280",
                margin: "0 0 10px",
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 8,
              }}
            >
              Assessment
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[
                ["Formative", "🔍", result.assessment?.formative],
                ["Exit Ticket", "✏️", result.assessment?.exitTicket],
                ["Summative", "📝", result.assessment?.summative],
              ].map(([ttl, ico, val]) => (
                <div
                  key={ttl}
                  style={{
                    background: "#F9FAFB",
                    borderRadius: 8,
                    padding: "10px 12px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      color: BRAND,
                      margin: "0 0 5px",
                    }}
                  >
                    {ico} {ttl}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 12.5,
                      color: "#374151",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* DOK Questions — aligned to learning objectives */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                margin: "0 0 10px",
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 8,
              }}
            >
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "#6B7280",
                  margin: 0,
                }}
              >
                🧠 DOK Questions — aligned to learning objectives
              </p>
              <button
                onClick={regenerateDok}
                disabled={regeneratingDok}
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: regeneratingDok ? "#9CA3AF" : BRAND,
                  background: "transparent",
                  border: `1px solid ${regeneratingDok ? "#E5E7EB" : BRAND}40`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: regeneratingDok ? "wait" : "pointer",
                }}
                title="Regenerate DOK questions from the current objectives"
              >
                {regeneratingDok ? "Regenerating…" : "↻ Regenerate"}
              </button>
            </div>
            {Array.isArray(result.dokQuestions) && result.dokQuestions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {result.dokQuestions.map((lv, li) => {
                  const c = DOK_LEVEL_COLORS[(lv.level || li + 1) - 1] || "#374151";
                  return (
                    <div
                      key={li}
                      style={{
                        background: c + "10",
                        border: `1.5px solid ${c}55`,
                        borderLeft: `5px solid ${c}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          color: c,
                          margin: "0 0 6px",
                        }}
                      >
                        DOK {lv.level} · {lv.label}
                      </p>
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {(lv.items || []).map((q, qi) => (
                          <li
                            key={qi}
                            style={{
                              fontFamily: "'Inter',sans-serif",
                              fontSize: 12.5,
                              color: "#1F2937",
                              lineHeight: 1.5,
                              display: "flex",
                              gap: 8,
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                flexShrink: 0,
                                width: 14,
                                height: 14,
                                marginTop: 3,
                                border: `2px solid ${c}`,
                                borderRadius: 3,
                                background: "white",
                              }}
                            />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  background: "#F9FAFB",
                  border: "1px dashed #E5E7EB",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 20,
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  color: "#6B7280",
                }}
              >
                No DOK questions generated yet — click <strong>↻ Regenerate</strong> to build them
                from this lesson's objectives.
              </div>
            )}

            {/* Differentiation */}
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#6B7280",
                margin: "0 0 10px",
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 8,
              }}
            >
              Differentiation
            </p>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}
            >
              {[
                ["ELL", "🌐", result.differentiation?.ell],
                ["IEP", "♿", result.differentiation?.iep],
                ["Gifted", "⭐", result.differentiation?.gifted],
                ["Universal Design", "🔑", result.differentiation?.universal],
              ].map(([ttl, ico, val]) => (
                <div
                  key={ttl}
                  style={{
                    background: "#F9FAFB",
                    borderRadius: 8,
                    padding: "10px 12px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      color: BRAND,
                      margin: "0 0 5px",
                    }}
                  >
                    {ico} {ttl}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 12.5,
                      color: "#374151",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* Homework / Extension / Notes */}
            {result.homework && (
              <div
                style={{
                  background: "#F0F9FF",
                  border: "1px solid #BAE6FD",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    color: "#0369A1",
                    margin: "0 0 5px",
                  }}
                >
                  📚 Homework
                </p>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    color: "#1F2937",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {result.homework}
                </p>
              </div>
            )}
            {result.extension && (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    color: "#15803D",
                    margin: "0 0 5px",
                  }}
                >
                  🚀 Extension Activity
                </p>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    color: "#1F2937",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {result.extension}
                </p>
              </div>
            )}
            {result.teacherNotes && (
              <div
                style={{
                  background: "#FEFCE8",
                  border: "1px solid #FDE68A",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    color: "#B45309",
                    margin: "0 0 5px",
                  }}
                >
                  💡 Teacher Notes
                </p>
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    color: "#1F2937",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {result.teacherNotes}
                </p>
              </div>
            )}

            {/* Save box — Lesson Plan header + Copy / Print / Export */}
            {result && (
              <div
                className="no-print"
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#111827",
                    textAlign: "center",
                  }}
                >
                  Lesson Plan
                </p>
                <p
                  style={{
                    margin: "4px 0 12px",
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#6B7280",
                    textAlign: "center",
                  }}
                >
                  How Do You Want To Save Your Lesson?
                </p>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
                    <button
                      onClick={() => setShowExportMenu((s) => !s)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: BRAND,
                        color: "white",
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      📤 Export ▾
                    </button>
                    {showExportMenu && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          left: 0,
                          background: "white",
                          border: `1.5px solid ${BRAND}`,
                          borderRadius: 8,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          zIndex: 50,
                          overflow: "hidden",
                          fontFamily: "'Inter',sans-serif",
                        }}
                      >
                        {[
                          {
                            label: copied ? "✓ Copied!" : "📋 Copy Text",
                            onClick: () => {
                              setShowExportMenu(false);
                              copyPlan();
                            },
                            desc: "Copy lesson plan text",
                          },
                          { label: "📄 PDF (Print)", onClick: exportPDF, desc: "Preserves layout" },
                          {
                            label: "📝 Microsoft Word (.doc)",
                            onClick: exportWord,
                            desc: "Editable",
                          },
                          {
                            label: "📊 Excel / CSV",
                            onClick: exportCSV,
                            desc: "Standards tracking",
                          },
                          {
                            label: "🎓 Google Classroom",
                            onClick: exportGoogleClassroom,
                            desc: "Share to Classroom",
                          },
                          {
                            label: "🅒 Canvas",
                            onClick: () => exportLMSGuidance("Canvas"),
                            desc: "Import as Word",
                          },
                          {
                            label: "🅔 Edmodo",
                            onClick: () => exportLMSGuidance("Edmodo"),
                            desc: "Import as Word",
                          },
                        ].map((opt, i) => (
                          <button
                            key={i}
                            onClick={opt.onClick}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              border: "none",
                              borderTop: i === 0 ? "none" : "1px solid #F3F4F6",
                              background: "white",
                              textAlign: "left",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 2,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF5FF")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                          >
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: 11, color: "#6B7280" }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Build Worksheets CTA — placed directly above the Slide Deck builder */}
            {onBuildWorksheets && (
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  background: "#FFFBEB",
                  border: "1.5px dashed #F59E0B",
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#B45309",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  💾 Save your lesson plan before creating a worksheet
                </p>
                <button
                  onClick={() => {
                    const raw = buildPlanText();
                    const safeTitle =
                      (result?.title || "Lesson Plan").replace(/[^\w\s-]+/g, "").trim() ||
                      "Lesson Plan";
                    onBuildWorksheets({
                      name: `${safeTitle}.txt`,
                      raw,
                      topic: result?.title || form.topic || "",
                      gradeId: form.grade || "k",
                    });
                  }}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: "white",
                    fontFamily: "'Inter',sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 3px 10px rgba(217,119,6,0.4)",
                  }}
                >
                  📄 Build Worksheets from this Lesson →
                </button>
              </div>
            )}

            {/* Generate Slide Deck CTA — multi-format export */}
            <div
              style={{
                marginTop: 18,
                padding: "18px 16px",
                background: "linear-gradient(135deg, #FDF4FF 0%, #FAE8FF 100%)",
                border: `1.5px dashed ${BRAND}`,
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#B45309",
                  margin: "0 0 10px",
                  textAlign: "center",
                  background: "#FFFBEB",
                  border: "1.5px dashed #F59E0B",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                💾 Save your lesson plan before creating a slideshow
              </p>
              <p
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: BRAND,
                  margin: "0 0 4px",
                  textAlign: "center",
                }}
              >
                🎞️ Build a slide deck for this lesson
              </p>
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  color: "#6B7280",
                  margin: "0 0 14px",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                Pick your format — the deck is built from every section of this plan.
              </p>
              {(() => {
                const exportBtns = [
                  {
                    id: "html",
                    label: "🌐 Interactive HTML",
                    desc: "Open in browser",
                    onClick: exportSlidesHTML,
                  },
                  {
                    id: "text",
                    label: "📝 Plain Text",
                    desc: "Outline (.txt)",
                    onClick: exportSlidesText,
                  },
                  { id: "pdf", label: "📄 PDF", desc: "Print-ready", onClick: exportSlidesPDF },
                  {
                    id: "pptx",
                    label: "🟧 PowerPoint / Google Slides",
                    desc: ".pptx (works in both)",
                    onClick: exportSlidesPPTX,
                  },
                ];
                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {exportBtns.map((b) => {
                      const isActive = exportingFmt === b.id;
                      const isDisabled = slidesLoading;
                      return (
                        <button
                          key={b.id}
                          onClick={b.onClick}
                          disabled={isDisabled}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: `1.5px solid ${isActive ? BRAND : "#E9D5FF"}`,
                            background:
                              isDisabled && !isActive ? "#F3F4F6" : isActive ? BRAND : "white",
                            color: isActive ? "white" : isDisabled ? "#9CA3AF" : BRAND,
                            fontFamily: "'Inter',sans-serif",
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: isDisabled ? (isActive ? "wait" : "not-allowed") : "pointer",
                            boxShadow: isActive ? "0 4px 12px rgba(207,39,245,0.3)" : "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            alignItems: "center",
                            lineHeight: 1.3,
                            transition: "all .15s",
                          }}
                        >
                          <span>
                            {isActive ? (
                              <>
                                <span
                                  style={{
                                    width: 11,
                                    height: 11,
                                    border: "2px solid rgba(255,255,255,0.4)",
                                    borderTopColor: "white",
                                    borderRadius: "50%",
                                    display: "inline-block",
                                    animation: "spin 0.8s linear infinite",
                                    verticalAlign: "middle",
                                    marginRight: 6,
                                  }}
                                />
                                Working…
                              </>
                            ) : (
                              b.label
                            )}
                          </span>
                          {!isActive && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 500,
                                color: isDisabled ? "#9CA3AF" : "#9CA3AF",
                              }}
                            >
                              {b.desc}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              {slidesError && (
                <p
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 11.5,
                    color: slidesError.startsWith("✓") ? "#166534" : "#DC2626",
                    margin: "12px 0 0",
                    lineHeight: 1.5,
                    background: slidesError.startsWith("✓") ? "#F0FDF4" : "#FEF2F2",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${slidesError.startsWith("✓") ? "#BBF7D0" : "#FECACA"}`,
                  }}
                >
                  {slidesError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "80px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                background: "#F3F4F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              📋
            </div>
            <p
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 16,
                color: "#9CA3AF",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Your lesson plan will appear here
            </p>
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: "#D1D5DB",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              Fill in the details on the left and click
              <br />
              <strong style={{ color: "#9CA3AF" }}>Generate Lesson Plan</strong> to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
