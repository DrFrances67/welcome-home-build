/* eslint-disable */
/**
 * Slide-deck export helpers for the Lesson Plan Generator. These are pure
 * builders (HTML string, .pptx Blob) plus a download trigger, kept out of the
 * component so the generator file stays focused on the UI.
 */
import type { DeckData, DeckSlide } from "@/components/teacher/lesson-plan-types";

export function deckBaseName(deck: DeckData | null | undefined, fallbackTitle?: string): string {
  return (
    (deck?.title || fallbackTitle || "lesson")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "lesson"
  );
}

export const buildDeckHtml = (deck: DeckData, fallbackTitle?: string) => {
  const safe = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const slidesHtml = deck.slides
    .map((sl: DeckSlide, i: number) => {
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
            : `<h2>${safe(sl.title)}</h2><div class="slide-body">${imgTag ? `<div class="slide-text"><ul>${bullets.map((b: string) => `<li>${safe(b)}</li>`).join("")}</ul></div>${imgTag}` : `<ul>${bullets.map((b: string) => `<li>${safe(b)}</li>`).join("")}</ul>`}</div>`
        }
        <div class="slide-num">${i + 1} / ${deck.slides.length}</div>
      </div>
    </section>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safe(deck.title || fallbackTitle)} — Slide Deck</title>
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

export const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const buildPptxBlob = async (deck: DeckData, fallbackTitle?: string) => {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inch
  pptx.title = deck.title || fallbackTitle || "Lesson Slides";
  pptx.author = "The Tech Savvy Teacher";

  const PPTX_BRAND = "8B0AB0";
  const PPTX_ACCENT = "CF27F5";
  const PPTX_DARK = "1F2937";
  const PPTX_MUTED = "9CA3AF";

  deck.slides.forEach((sl: DeckSlide, i: number) => {
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
      const bullets = (sl.bullets || []).map((b: string) => ({
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
  return (await pptx.write({ outputType: "blob" })) as Blob;
};
