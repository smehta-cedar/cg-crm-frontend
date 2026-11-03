"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { useConfirm } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { localDateString, monthLabel, yearMonthOf } from "@/lib/calendar";
import { formatLicenceDate } from "@/lib/state-licenses";
import type { DayValues, HistoryError, MonthValues, TrackerDays, TrackerEntry, TrackerMonth } from "@/lib/tracker";
import { deleteDay, deleteMonth, saveDay, saveMonth, type HistoryResult } from "./actions";

/*
 * The History page's popups. A setter's day: adding picks the setter (anyone
 * holding the SDR role) and the date; editing changes only the numbers. A
 * typed month total: adding picks the month; editing changes the numbers.
 * Delete (with `canDelete`) asks once more. Saves go to ./actions.ts, which
 * revalidates the page, so the cards behind re-render with the saved rows.
 *
 * Mounted per open inside a ModalDialog, so fields and errors start clear.
 */

type Numbers = { answered: number; booked: number; liveTransfer: number };

type FormProps = {
  id: string;
  close: () => void;
  canDelete: boolean;
};

/** Error props for one field: message under it while the error names it. */
function useFieldErrors(id: string) {
  const [error, setError] = useState<HistoryError | null>(null);
  const errorFor = (field: HistoryError["field"]) => {
    const message = error?.field === field ? error.message : null;
    return {
      field: { hint: message ?? undefined, hintId: `${id}-${field}-error`, error: true },
      input: {
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message ? `${id}-${field}-error` : undefined,
        onChange: () => setError(null),
      },
    };
  };
  return { error, setError, errorFor };
}

/**
 * The shared form: the fields that say whose numbers they are, then the
 * three numbers, then Delete / Cancel / Save. `save` and `remove` call the
 * server actions; a failure shows under its field or the form.
 */
function NumbersForm({
  id,
  close,
  canDelete,
  title,
  addLabel,
  initial,
  children,
  save,
  remove,
}: FormProps & {
  title: string;
  addLabel: string;
  initial?: Numbers;
  children: (errorFor: ReturnType<typeof useFieldErrors>["errorFor"]) => ReactNode;
  save: (data: FormData, numbers: Numbers) => Promise<HistoryResult>;
  /** Shown while editing: Delete asks with this title and message, then runs it. */
  remove?: { title: string; message: string; run: () => Promise<HistoryResult> };
}) {
  const { error, setError, errorFor } = useFieldErrors(id);
  const { confirm, confirmDialog } = useConfirm();
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<HistoryResult>) => {
    setSaving(true);
    try {
      const result = await action();
      if (result.ok) close();
      else setError(result.error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const number = (name: string) => Number(data.get(name));
    void run(() => save(data, { answered: number("answered"), booked: number("booked"), liveTransfer: number("liveTransfer") }));
  };

  const handleDelete = async () => {
    if (!remove || saving) return;
    if (!(await confirm({ title: remove.title, message: remove.message }))) return;
    void run(remove.run);
  };

  const numberField = (name: keyof Numbers, label: string) => {
    const fieldError = errorFor(name);
    return (
      <Field label={label} required htmlFor={`${id}-${name}`} className="sm:col-span-2" {...fieldError.field}>
        <input
          id={`${id}-${name}`}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          max={99999}
          step={1}
          required
          defaultValue={initial?.[name]}
          className={INPUT_CLASS}
          {...fieldError.input}
        />
      </Field>
    );
  };
  const formError = error?.field === "form" ? error.message : null;

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-6">
        {children(errorFor)}
        {numberField("answered", "Answered")}
        {numberField("booked", "Booked")}
        {numberField("liveTransfer", "Live transfers")}
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {remove && canDelete ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving}
            className="mr-auto rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : initial ? "Save" : addLabel}
        </button>
      </div>
      {confirmDialog}
    </form>
  );
}

/** Shows whose numbers an edit changes, in place of the fields that can't change. */
function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:col-span-3">
      <p className="text-sm font-medium text-fg-muted">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-fg">{value}</p>
    </div>
  );
}

type DayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The day being edited; left out to add one. */
  entry?: TrackerEntry | null;
  setters: TrackerDays["setters"];
  canDelete: boolean;
};

export function DayDialog({ open, onClose, entry, setters, canDelete }: DayDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const id = useId();

  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {open ? (
        <NumbersForm
          id={id}
          close={close}
          canDelete={canDelete}
          title={entry ? "Edit day" : "Add a day"}
          addLabel="Add day"
          initial={entry ?? undefined}
          save={(data, numbers) => {
            const values: DayValues = {
              setterId: String(data.get("setterId") ?? ""),
              date: String(data.get("date") ?? ""),
              ...numbers,
            };
            return saveDay(values, entry?.id);
          }}
          remove={
            entry
              ? {
                  title: "Delete day",
                  message: `Delete ${entry.name}'s numbers for ${formatLicenceDate(entry.date)}?`,
                  run: () => deleteDay(entry.id),
                }
              : undefined
          }
        >
          {(errorFor) => {
            if (entry) {
              return (
                <>
                  <Fixed label="Setter" value={entry.name} />
                  <Fixed label="Date" value={formatLicenceDate(entry.date)} />
                </>
              );
            }
            const setterError = errorFor("setterId");
            const dateError = errorFor("date");
            return (
              <>
                <Field label="Setter" required htmlFor={`${id}-setter`} className="sm:col-span-3" {...setterError.field}>
                  <select id={`${id}-setter`} name="setterId" required defaultValue="" className={INPUT_CLASS} {...setterError.input}>
                    <option value="" disabled>
                      Choose a setter
                    </option>
                    {setters.map((setter) => (
                      <option key={setter.id} value={setter.id}>
                        {setter.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date" required htmlFor={`${id}-date`} className="sm:col-span-3" {...dateError.field}>
                  <input
                    id={`${id}-date`}
                    name="date"
                    type="date"
                    required
                    defaultValue={localDateString()}
                    className={INPUT_CLASS}
                    {...dateError.input}
                  />
                </Field>
              </>
            );
          }}
        </NumbersForm>
      ) : null}
    </ModalDialog>
  );
}

type MonthDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The typed total being edited; left out to add one. */
  month?: TrackerMonth | null;
  canDelete: boolean;
};

export function MonthDialog({ open, onClose, month, canDelete }: MonthDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const id = useId();
  const label = month ? monthLabel(yearMonthOf(month.month)) : "";
  const typedId = month?.id;

  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {open ? (
        <NumbersForm
          id={id}
          close={close}
          canDelete={canDelete}
          title={month ? "Edit month" : "Add a month"}
          addLabel="Add month"
          initial={month ?? undefined}
          save={(data, numbers) => {
            const values: MonthValues = { month: String(data.get("month") ?? ""), ...numbers };
            return saveMonth(values, typedId ?? undefined);
          }}
          remove={
            typedId
              ? {
                  title: "Delete month",
                  message: `Delete the typed total for ${label}? The month goes back to the sum of its days.`,
                  run: () => deleteMonth(typedId),
                }
              : undefined
          }
        >
          {(errorFor) => {
            if (month) return <Fixed label="Month" value={label} />;
            const monthError = errorFor("month");
            return (
              <Field label="Month" required htmlFor={`${id}-month`} className="sm:col-span-3" {...monthError.field}>
                <input id={`${id}-month`} name="month" type="month" required className={INPUT_CLASS} {...monthError.input} />
              </Field>
            );
          }}
        </NumbersForm>
      ) : null}
    </ModalDialog>
  );
}
