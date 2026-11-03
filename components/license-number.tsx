"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A licence or writing number with a copy icon beside it. Clicking the number
 * or the icon copies it and shows "Copied" / "Couldn't copy". Blank shows
 * `empty` and no icon. Licence call sites use `LicenseNumber`; writing numbers
 * pass their own label and empty text.
 */

type CopyStatus = "idle" | "copied" | "failed";

const ICON_BUTTON_CLASS =
  "cursor-pointer rounded-md p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg";

/**
 * Copies `value` exactly as given; the status resets to idle after 1.5
 * seconds. `value` can instead fetch the text, for a password the page
 * doesn't hold: a rejection reads as "Couldn't copy".
 */
export function useCopy(value: string | (() => Promise<string>)) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timeout);
  }, [status]);

  const copy = async () => {
    try {
      // Missing outside secure contexts (e.g. plain http on a LAN address).
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      if (typeof value === "string") await navigator.clipboard.writeText(value);
      else await copyPending(value());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return { status, copy };
}

/**
 * Copies text that is still on its way. Safari allows a copy only during the
 * click itself, so it gets a ClipboardItem holding the pending text; a browser
 * that refuses that gets writeText once the text arrives.
 */
async function copyPending(text: Promise<string>) {
  if (typeof ClipboardItem !== "undefined") {
    try {
      const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
      // Falls through, e.g. where ClipboardItem takes only a ready Blob.
    }
  }
  await navigator.clipboard.writeText(await text);
}

/** The icon button and its floating result. `onCopy` is the shared `useCopy` action. */
export function CopyButton({
  label,
  status,
  onCopy,
}: {
  label: string;
  status: CopyStatus;
  onCopy: () => void;
}) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCopy();
        }}
        aria-label={`Copy ${label}`}
        className={ICON_BUTTON_CLASS}
      >
        {status === "copied" ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* The live region stays mounted; only the label inside it comes and goes. */}
      <span
        aria-live="polite"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap"
      >
        {status !== "idle" ? (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium text-tooltip-fg ${status === "failed" ? "bg-danger-strong" : "bg-tooltip"}`}
          >
            {status === "copied" ? "Copied" : "Couldn't copy"}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function CopyableNumber({
  value,
  label,
  empty = "No number yet",
  className,
}: {
  value?: string;
  /** Spoken name, e.g. "Licence number" or "Writing number". */
  label: string;
  /** Shown, with no icon, when `value` is blank. */
  empty?: string;
  className?: string;
}) {
  const text = value?.trim() ?? "";
  const { status, copy } = useCopy(text);

  if (!text) {
    return (
      <span
        onClick={(event) => event.stopPropagation()}
        className={`font-sans text-xs font-normal text-fg-faint ${className ?? ""}`}
      >
        {empty}
      </span>
    );
  }

  return (
    <span
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex min-w-0 items-center gap-0.5 font-normal ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void copy();
        }}
        title={`${label} ${text}`}
        className="min-w-0 cursor-pointer truncate rounded-md px-0.5 font-mono text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
      >
        <span className="sr-only">{label} </span>
        {text}
      </button>
      <CopyButton label={label} status={status} onCopy={() => void copy()} />
    </span>
  );
}

/** A state's licence number. Blank shows "No number yet". */
export function LicenseNumber({ value, className }: { value?: string; className?: string }) {
  return <CopyableNumber value={value} label="Licence number" className={className} />;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function CopyIcon() {
  return (
    <Icon>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon>
      <path d="M4 10.5l4 4 8-9" />
    </Icon>
  );
}
