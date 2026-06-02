import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

export const Route = createFileRoute("/spelltest")({ component: Page });

function Page() {
  const [a, setA] = useState(
    "Dear parnts, i wanted too tell you about the the upcoming feild trip. recieve a apple.",
  );
  const [b, setB] = useState("teh students definately enjyoed it");
  return (
    <div style={{ padding: 40, maxWidth: 640, fontFamily: "Inter, sans-serif" }}>
      <h1>Spell test</h1>
      <SpellTextarea
        value={a}
        onChange={(e) => setA(e.target.value)}
        style={{ width: "100%", minHeight: 120, padding: 12, fontSize: 16, border: "1.5px solid #ccc", borderRadius: 8, boxSizing: "border-box" }}
      />
      <div style={{ height: 20 }} />
      <SpellInput
        value={b}
        onChange={(e) => setB(e.target.value)}
        style={{ width: "100%", padding: 12, fontSize: 16, border: "1.5px solid #ccc", borderRadius: 8, boxSizing: "border-box" }}
      />
    </div>
  );
}
