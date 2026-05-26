import { useEffect, useRef, useState } from "react";

export function ContactWidget() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview({ url: String(ev.target?.result ?? ""), name: file.name });
    };
    reader.readAsDataURL(file);
  }

  function removeFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFilePreview(null);
    setSelectedFile(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      let screenshotBase64: string | null = null;
      let screenshotName: string | null = null;
      let screenshotType: string | null = null;
      if (selectedFile) {
        if (selectedFile.size > 5 * 1024 * 1024) {
          throw new Error("Screenshot must be 5 MB or smaller");
        }
        if (!selectedFile.type.startsWith("image/")) {
          throw new Error("Only image files are allowed");
        }
        screenshotBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result ?? "");
            resolve(result.includes(",") ? result.split(",")[1] : result);
          };
          reader.onerror = () => reject(new Error("Failed to read screenshot"));
          reader.readAsDataURL(selectedFile);
        });
        screenshotName = selectedFile.name;
        screenshotType = selectedFile.type;
      }
      const payload = {
        firstName: String(fd.get("firstName") ?? "").trim(),
        lastName: String(fd.get("lastName") ?? "").trim(),
        email: String(fd.get("email") ?? "").trim(),
        subject: String(fd.get("subject") ?? "").trim(),
        message: String(fd.get("message") ?? "").trim(),
        screenshotBase64,
        screenshotName,
        screenshotType,
      };
      const res = await fetch("/api/public/contact-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to send message");
      }
      setSubmitted(true);
      formRef.current?.reset();
      setTimeout(() => {
        setOpen(false);
        setTimeout(() => {
          setSubmitted(false);
          removeFile();
        }, 400);
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{ backgroundColor: "#CF27F5" }}
        className="fixed bottom-4 left-4 z-[999] flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:-translate-y-0.5 hover:opacity-90 hover:shadow-xl sm:bottom-6 sm:left-6 sm:px-5 sm:py-3 sm:pl-4"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Contact Us
      </button>

      <div
        ref={panelRef}
        className={`fixed bottom-16 left-4 right-4 z-[1000] flex max-h-[calc(100svh-5rem)] w-auto origin-bottom-left flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all duration-300 sm:right-auto sm:bottom-20 sm:left-6 sm:w-[360px] sm:max-w-[calc(100vw-3rem)] sm:max-h-[calc(100svh-6rem)] ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-shrink-0 items-start justify-between px-5 py-4 text-white" style={{ backgroundColor: "#CF27F5" }}>
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

        {!submitted ? (
          <form
            ref={formRef}
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-5"
          >
            <div className="flex gap-2.5">
              <Field label="First name">
                <input name="firstName" type="text" placeholder="Jane" className={inputCls} />
              </Field>
              <Field label="Last name">
                <input name="lastName" type="text" placeholder="Smith" className={inputCls} />
              </Field>
            </div>

            <Field label="Email">
              <input name="email" type="email" required placeholder="jane@example.com" className={inputCls} />
            </Field>

            <Field label="Subject">
              <select name="subject" required defaultValue="" className={`${inputCls} appearance-none pr-9`}>
                <option value="" disabled>Select a topic…</option>
                <option>Bug / Error Report</option>
                <option>Feature Request</option>
                <option>Billing Question</option>
                <option>General Inquiry</option>
                <option>Other</option>
              </select>
            </Field>

            <Field label="Message">
              <textarea
                name="message"
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

            {errorMsg && (
              <p className="text-xs text-destructive" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-0.5 w-full rounded-[10px] bg-primary px-4 py-3 text-sm font-medium tracking-wide text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {submitting ? "Sending…" : "Send Message →"}
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
    </>
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
