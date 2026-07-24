import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Get in touch with The Tech Savvy Teacher. Bug reports, feature requests, billing, or general questions — we usually reply within a few hours.",
      },
      { property: "og:title", content: "Contact — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "Reach The Tech Savvy Teacher team — we usually reply within a few hours.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/contact" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [filePreview, setFilePreview] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview({ url: String(ev.target?.result ?? ""), name: file.name });
    };
    reader.readAsDataURL(file);
  }

  function removeFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFilePreview(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => {
        setSubmitted(false);
        removeFile();
      }, 400);
    }, 3000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="max-w-xl text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Questions, feedback, or bug reports? Tap the Contact Us button to send us a note — we
          usually reply within a few hours.
        </p>
      </section>

      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 left-6 z-[999] flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 pl-4 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Contact Us
      </button>

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed bottom-20 left-6 z-[1000] w-[360px] max-w-[calc(100vw-3rem)] origin-bottom-left overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all duration-300 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between bg-primary px-5 py-4 text-primary-foreground">
          <div>
            <h2 className="font-serif text-xl font-normal leading-tight">Get in touch</h2>
            <p className="mt-1 text-xs font-light opacity-70">
              We usually reply within a few hours
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {!submitted ? (
          <form
            onSubmit={submit}
            className="flex max-h-[480px] flex-col gap-3.5 overflow-y-auto px-5 py-5"
          >
            <div className="flex gap-2.5">
              <Field label="First name">
                <input type="text" placeholder="Jane" className={inputCls} />
              </Field>
              <Field label="Last name">
                <input type="text" placeholder="Smith" className={inputCls} />
              </Field>
            </div>

            <Field label="Email">
              <input type="email" required placeholder="jane@example.com" className={inputCls} />
            </Field>

            <Field label="Subject">
              <select
                required
                defaultValue=""
                className={`${inputCls} appearance-none pr-9 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%228%22%20fill=%22none%22%3E%3Cpath%20d=%22M1%201l5%205%205-5%22%20stroke=%22%23888%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] bg-[right_0.85rem_center] bg-no-repeat`}
              >
                <option value="" disabled>
                  Select a topic…
                </option>
                <option>Bug / Error Report</option>
                <option>Feature Request</option>
                <option>Billing Question</option>
                <option>General Inquiry</option>
                <option>Other</option>
              </select>
            </Field>

            <Field label="Message">
              <textarea
                required
                placeholder="Describe your issue or question…"
                className={`${inputCls} h-[88px] resize-none leading-relaxed`}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Attach a screenshot{" "}
                <span className="font-light normal-case tracking-normal">(optional)</span>
              </label>
              <div className="relative cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-border bg-muted/30 px-3 py-3.5 text-center transition-colors hover:border-foreground hover:bg-muted/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="text-xl">📎</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Drop an image or click to browse
                </p>
                <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                  PNG, JPG, GIF up to 10MB
                </span>
              </div>
              {filePreview && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2">
                  <img
                    src={filePreview.url}
                    alt="preview"
                    className="h-9 w-9 rounded-md object-cover"
                  />
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {filePreview.name}
                  </span>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-sm text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mt-0.5 w-full rounded-[10px] bg-primary px-4 py-3 text-sm font-medium tracking-wide text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 active:translate-y-0"
            >
              Send Message →
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
            <div className="mb-1 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3 text-xl text-primary-foreground">
              ✓
            </div>
            <h3 className="font-serif text-xl">Message sent!</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Thanks for reaching out. We'll get back to you at your email shortly.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-[10px] border-[1.5px] border-border bg-background px-3 py-2.5 text-[13.5px] text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:ring-[3px] focus:ring-foreground/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
