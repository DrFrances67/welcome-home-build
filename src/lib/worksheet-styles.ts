// Shared font-family strings and the print/export stylesheet used by the
// worksheet tools.

export const F  = "'Inter', 'Segoe UI', sans-serif";
export const FF = "'Playfair Display', Georgia, serif";

export const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: white; }
/* ── Accessibility: visible focus rings ── */
:focus-visible {
  outline: 3px solid #6D28D9 !important;
  outline-offset: 2px !important;
  border-radius: 4px;
}
/* ── Accessibility: reduce motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
/* ── High contrast mode support ── */
@media (forced-colors: active) {
  button, select, input, textarea { border: 2px solid ButtonText !important; }
}
@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} }
@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@media print {
  html, body { height: auto !important; overflow: visible !important; }
  .no-print { display: none !important; }
  .worksheet-paper { box-shadow: none !important; margin: 0 !important; padding: 44px 64px !important; width: 100% !important; min-height: auto !important; border-radius: 0 !important; }
  .app-shell { display: block !important; height: auto !important; overflow: visible !important; }
  .canvas-area { padding: 0 !important; overflow: visible !important; display: block !important; background: white !important; }
}
/* ── Skip nav link ── */
.skip-nav {
  position: absolute; top: -100px; left: 8px; z-index: 9999;
  background: #6D28D9; color: white; padding: 8px 16px; border-radius: 6px;
  font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px;
  text-decoration: none; transition: top 0.2s;
}
.skip-nav:focus { top: 8px; }
`;
