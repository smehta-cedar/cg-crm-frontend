import type { FieldChange } from "@/lib/change-notes";
import { US_STATE_NAMES } from "@/lib/us-states";

type Note<F extends string> = {
  id: string;
  kind: "added" | "edited";
  createdAt: string;
  changes: FieldChange<F>[];
};

export type NoteListProps<F extends string> = {
  notes: Note<F>[];
  /** Label for each field a change can name. */
  labels: Record<F, string>;
  /** Fields holding a list ("CA, TX"): an edit names only the items added or removed. */
  lists?: readonly F[];
};

/**
 * Change notes, in the order given. An edit shows only what is new, never the
 * value before. Timestamps are formatted in the browser's time zone, so render
 * this only after hydration (e.g. in an expanded row).
 */
export function NoteList<F extends string>({ notes, labels, lists = [] }: NoteListProps<F>) {
  if (notes.length === 0) {
    return <p className="mt-2 text-sm text-fg-subtle">No changes recorded yet.</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-xs text-fg-subtle">
            {note.kind === "added" ? "Added" : "Edited"} ·{" "}
            <time dateTime={note.createdAt}>{formatTimestamp(note.createdAt)}</time>
          </p>
          <ul className="mt-1 space-y-0.5 break-words text-sm text-fg-muted">
            {note.changes.map((change) => (
              <li key={change.field}>
                {change.redacted ? (
                  // Secret value: say only that it was set or changed.
                  <>
                    <span className="font-medium text-fg">{labels[change.field]}</span>{" "}
                    {note.kind === "added" ? "set" : "changed"}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fg">{labels[change.field]}:</span>{" "}
                    {note.kind === "added"
                      ? change.to
                      : lists.includes(change.field)
                        ? listEdit(change.from, change.to)
                        : change.to || "removed"}
                  </>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * "CA, TX" -> "CA, NY": "added NY · removed TX". An item keyed by a state
 * ("TX pending" -> "TX active") is that state's row changing, so it shows
 * bare with no removal.
 */
function listEdit(from: string, to: string) {
  const before = splitList(from);
  const after = splitList(to);
  const beforeKeys = new Set(before.map(stateKey));
  const fresh = after.filter((item) => !before.includes(item));
  const updated = fresh.filter((item) => stateKey(item) && beforeKeys.has(stateKey(item)));
  const added = fresh.filter((item) => !updated.includes(item));
  const updatedKeys = new Set(updated.map(stateKey));
  const removed = before.filter((item) => !after.includes(item) && !updatedKeys.has(stateKey(item)));
  const parts = [
    updated.join(", "),
    added.length ? `added ${added.join(", ")}` : "",
    removed.length ? `removed ${removed.join(", ")}` : "",
  ].filter(Boolean);
  // Same items in another order: nothing to name, so show the list.
  return parts.join(" · ") || to;
}

const splitList = (text: string) => (text ? text.split(", ") : []);

/** "TX active" -> "TX"; "" for an item that doesn't start with a state code. */
function stateKey(item: string) {
  const code = item.split(" ", 1)[0];
  return item.includes(" ") && Object.hasOwn(US_STATE_NAMES, code) ? code : "";
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
