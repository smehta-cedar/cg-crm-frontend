import turtle from "@/assests/turtle.gif";

/**
 * Route-loading placeholder: the swimming turtle GIF with a gentle CSS float
 * so it drifts while the page segment resolves. Frontend-only; no API work.
 *
 * Plain <img> (not next/image) so the animated GIF stays at full source
 * resolution — 800×600 — and only the CSS size scales it down.
 */
export function LoadingTurtle({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${fullPage ? "min-h-dvh" : "min-h-[50vh]"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF needs the full source file */}
      <img
        src={typeof turtle === "string" ? turtle : turtle.src}
        alt=""
        width={800}
        height={600}
        decoding="async"
        fetchPriority="high"
        className="turtle-float h-auto w-[min(22rem,72vw)] max-w-full select-none"
        draggable={false}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
