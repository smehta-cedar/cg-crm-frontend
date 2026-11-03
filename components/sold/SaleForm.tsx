"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { FormSection } from "@/components/producer-form";
import { api } from "@/lib/sold/api";
import { confetti } from "@/lib/sold/confetti";
import { FieldDef, SECTIONS } from "@/lib/sold/formConfig";
import {
  collectFields,
  emptySaleState,
  fieldVisible,
  partyPremiumTotal,
  productsNeedingUpload,
  productStateKey,
  tidyMbi,
  tidyPhone,
  tidyValues,
  validateAll,
  validateKey,
  type SaleMe,
  type SaleState,
  type SubmitFields,
} from "@/lib/sold/logic";
import { ProductPicker } from "./ProductPicker";
import "./sale-form.css";

type SaleFormProps = {
  me: SaleMe;
};

type DoneInfo = {
  first: string;
  last: string;
  products: string[];
  fields: SubmitFields;
};

/** Grid column span. Client Info uses 6 cols so Phone / State / AOR share one row. */
function fieldSpan(field: FieldDef, sectionTitle: string) {
  if (sectionTitle === "Client Info") {
    if (field.key === "Client First Name" || field.key === "Client Last Name") return "sm:col-span-3";
    if (field.key === "Client Phone" || field.key === "State" || field.key === "AOR") return "sm:col-span-2";
  }
  if (field.type === "products" || field.key === "Product Sold") return "sm:col-span-2";
  // New row so “Previous MAPD/PDP Product” lands beside it when Yes (same as Replacement Sale).
  if (field.key === "Prior MAPD/PDP Enrollment") return "sm:col-start-1";
  return "";
}

function sectionColumns(title: string) {
  if (title === "Client Info") return "sm:grid-cols-6";
  if (title === "Lead & Calendar") return "grid-cols-1";
  return "sm:grid-cols-2";
}

export function SaleForm({ me }: SaleFormProps) {
  const idPrefix = useId();
  const headerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const [state, setState] = useState<SaleState>(emptySaleState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [party, setParty] = useState<DoneInfo | null>(null);
  const [fileKeys, setFileKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.setAttribute("popover", "manual");
  }, []);

  useEffect(() => {
    if (!party) return;
    const dialog = dialogRef.current;
    const canvas = canvasRef.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button.sold-party-ok")?.focus();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canPopover = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
    if (!reduced && canPopover && canvas) confetti(canvas, dialog);
  }, [party]);

  const setValue = (key: string, value: string) => {
    setState((current) => {
      const next = { ...current, values: { ...current.values, [key]: value } };
      setErrors((errs) => recheckInvalid(errs, next));
      return next;
    });
  };

  const onBlurField = (key: string) => {
    setState((current) => {
      let next = current;
      if (key === "Client Phone") {
        next = { ...current, values: { ...current.values, [key]: tidyPhone(current.values[key] ?? "") } };
      } else if (key.endsWith(":Medicare Number (MBI)")) {
        next = { ...current, values: { ...current.values, [key]: tidyMbi(current.values[key] ?? "") } };
      }
      setErrors((errs) => recheckInvalid(errs, next));
      return next;
    });
  };

  const onToggleProduct = (product: string, checked: boolean) => {
    setState((current) => {
      const products = checked
        ? [...current.products, product]
        : current.products.filter((p) => p !== product);
      const next = { ...current, products };
      setErrors((errs) => {
        const cleared = { ...errs };
        if (!checked) {
          for (const k of Object.keys(cleared)) {
            if (k === "Product Sold" || k.startsWith(`${product}:`)) delete cleared[k];
          }
        }
        return recheckInvalid(cleared, next);
      });
      return next;
    });
  };

  const onSkipPdf = (product: string, skip: boolean) => {
    setState((current) => {
      const files = { ...current.files };
      const skipPdf = { ...current.skipPdf, [product]: skip };
      if (skip) {
        files[product] = null;
        setFileKeys((keys) => ({ ...keys, [product]: (keys[product] ?? 0) + 1 }));
      }
      const next = { ...current, skipPdf, files };
      setErrors((errs) => {
        const cleared = { ...errs };
        delete cleared[productStateKey(product, "PDF")];
        return recheckInvalid(cleared, next);
      });
      return next;
    });
  };

  const onFile = (product: string, file: File | null) => {
    setState((current) => {
      const next = { ...current, files: { ...current.files, [product]: file } };
      setErrors((errs) => recheckInvalid(errs, next));
      return next;
    });
  };

  const clearForm = (ask: boolean) => {
    if (ask && !confirm("Clear all answers on this form?")) return;
    setState(emptySaleState());
    setErrors({});
    setBanner("");
    setFileKeys((keys) => {
      const next: Record<string, number> = {};
      for (const k of Object.keys(keys)) next[k] = (keys[k] ?? 0) + 1;
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBanner("");
    const tidied = tidyValues(state);
    setState(tidied);

    const all = validateAll(tidied);
    if (all.length) {
      const map: Record<string, string> = {};
      for (const err of all) map[err.key] = err.message;
      setErrors(map);
      setBanner("Some answers need fixing. They’re marked in red above.");
      const first = all[0]?.key;
      const el = first ? fieldRefs.current[first] : null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const fields = collectFields(tidied);
      const uploads = productsNeedingUpload(tidied);
      const pdfIds = await Promise.all(
        uploads.map(async (product) => {
          const file = tidied.files[product];
          if (!file) throw new Error("Missing PDF.");
          const result = await api<{ id: string }>(`/api/upload?product=${encodeURIComponent(product)}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          });
          return result.id;
        }),
      );

      await api("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, pdfIds }),
      });

      const info: DoneInfo = {
        first: String(fields["Client First Name"] ?? "").trim(),
        last: String(fields["Client Last Name"] ?? "").trim(),
        products: Array.isArray(fields["Product Sold"]) ? (fields["Product Sold"] as string[]) : [],
        fields,
      };
      setDone(info);
      setParty(info);
      headerRef.current?.scrollIntoView({ block: "start" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setBanner(`The sale wasn’t saved: ${message} Try submitting again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnother = () => {
    clearForm(false);
    setDone(null);
    setParty(null);
    requestAnimationFrame(() => headerRef.current?.scrollIntoView({ block: "start" }));
  };

  const closeParty = () => {
    dialogRef.current?.close();
    setParty(null);
  };

  const submittingAs = me.email ? `Submitting as ${me.email}` : null;

  const renderSection = (section: (typeof SECTIONS)[number]) => (
    <FormSection
      key={section.title}
      title={section.title}
      layout="page"
      columns={sectionColumns(section.title)}
    >
      {section.fields.map((field) =>
        fieldVisible(field, state) ? (
          <TopField
            key={field.key}
            idPrefix={idPrefix}
            field={field}
            sectionTitle={section.title}
            state={state}
            error={errors[field.key]}
            errors={errors}
            fileKeys={fileKeys}
            fieldRefs={fieldRefs}
            onValue={setValue}
            onBlur={onBlurField}
            onToggleProduct={onToggleProduct}
            onSkipPdf={onSkipPdf}
            onFile={onFile}
          />
        ) : null,
      )}
    </FormSection>
  );

  return (
    <>
      <div ref={headerRef}>
        <PageHeader
          title="Sold"
          description={
            <>
              {submittingAs ? <span>{submittingAs}. </span> : null}
              <span>Submit a sale.</span>
            </>
          }
        />

        {done ? (
          <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-fg">Sale submitted</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {done.first || done.last
                ? `The sale for ${[done.first, done.last].filter(Boolean).join(" ")} is recorded.`
                : "Your sale is recorded."}
            </p>
            <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-5`} onClick={submitAnother}>
              Submit another sale
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <div className="mx-auto grid max-w-(--breakpoint-2xl) gap-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
                {SECTIONS.slice(0, 2).map(renderSection)}
              </div>
              {SECTIONS.slice(2).map(renderSection)}
            </div>

            <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3">
                <div role="alert" className="min-w-0 text-sm text-danger">
                  {banner}
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    onClick={() => clearForm(true)}
                    disabled={submitting}
                  >
                    Clear form
                  </button>
                  <button type="submit" disabled={submitting} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
                    {submitting ? "Submitting sale…" : "Submit sale"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="sold-party"
        aria-labelledby="partyTitle"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeParty();
        }}
      >
        {party ? (
          <div className="sold-party-body">
            <div className="sold-party-emoji" aria-hidden="true">
              🎉
            </div>
            <h2 id="partyTitle">SOLD!!!</h2>
            <p>
              {party.first || party.last
                ? `Great work closing ${[party.first, party.last].filter(Boolean).join(" ")}!`
                : "Great work!"}
            </p>
            <p>{party.products.join(" · ")}</p>
            {(() => {
              const total = partyPremiumTotal(party.fields, party.products);
              if (!total) return null;
              return <p className="sold-party-total">{`$${total.toFixed(2)} in premium`}</p>;
            })()}
            <button type="button" className={`${PRIMARY_BUTTON_CLASS} sold-party-ok`} onClick={closeParty}>
              Woohoo!
            </button>
          </div>
        ) : null}
      </dialog>
      <canvas ref={canvasRef} className="sold-confetti" aria-hidden="true" />
    </>
  );
}

function recheckInvalid(errors: Record<string, string>, state: SaleState): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of Object.keys(errors)) {
    const message = validateKey(key, state);
    if (message) next[key] = message;
  }
  return next;
}

function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-1 inline-flex overflow-hidden rounded-md border border-line-strong bg-surface">
      {(["Yes", "No"] as const).map((option) => {
        const on = value === option;
        return (
          <label
            key={option}
            className={`relative flex min-w-20 cursor-pointer items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
              on ? "bg-brand-strong text-white" : "text-fg-muted hover:bg-brand-soft/70 hover:text-fg"
            } ${option === "No" ? "border-l border-line-strong" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={on}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

function TopField({
  idPrefix,
  field,
  sectionTitle,
  state,
  error,
  errors,
  fileKeys,
  fieldRefs,
  onValue,
  onBlur,
  onToggleProduct,
  onSkipPdf,
  onFile,
}: {
  idPrefix: string;
  field: FieldDef;
  sectionTitle: string;
  state: SaleState;
  error?: string;
  errors: Record<string, string>;
  fileKeys: Record<string, number>;
  fieldRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onValue: (key: string, value: string) => void;
  onBlur: (key: string) => void;
  onToggleProduct: (product: string, checked: boolean) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
}) {
  const id = `${idPrefix}-${field.key}`.replace(/\W+/g, "-");
  const label = field.label ?? field.name;
  const value = state.values[field.key] ?? "";
  const span = fieldSpan(field, sectionTitle);
  const err = error ? { hint: error, hintId: `${id}-error`, error: true as const } : {};

  const setRef = (el: HTMLElement | null) => {
    fieldRefs.current[field.key] = el;
  };

  if (field.type === "products") {
    return (
      <div className={span} ref={setRef}>
        <Field label={label} htmlFor={id} required={field.required} {...err}>
          <div id={id} className="mt-1">
            <ProductPicker
              idPrefix={idPrefix}
              state={state}
              errors={errors}
              fileKeys={fileKeys}
              onFieldRef={(key, el) => {
                fieldRefs.current[key] = el;
              }}
              onToggle={onToggleProduct}
              onValue={onValue}
              onSkipPdf={onSkipPdf}
              onFile={onFile}
              onBlur={onBlur}
            />
          </div>
        </Field>
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div className={span || undefined} ref={setRef}>
        <Field label={label} htmlFor={id} required={field.required} {...err}>
          <YesNo name={field.key} value={value} onChange={(next) => onValue(field.key, next)} />
        </Field>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={span || undefined} ref={setRef}>
        <Field label={label} htmlFor={id} required={field.required} optional={!field.required} {...err}>
          <select
            id={id}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(field.key, event.target.value)}
            onBlur={() => onBlur(field.key)}
            className={INPUT_CLASS}
          >
            <option value="">Choose</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  if (field.type === "phone") {
    return (
      <div className={span || undefined} ref={setRef}>
        <Field label={label} htmlFor={id} required={field.required} {...err}>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(555) 555-5555"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(field.key, event.target.value)}
            onBlur={() => onBlur(field.key)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className={span || undefined} ref={setRef}>
      <Field label={label} htmlFor={id} required={field.required} {...err}>
        <input
          id={id}
          type="text"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onValue(field.key, event.target.value)}
          onBlur={() => onBlur(field.key)}
          className={INPUT_CLASS}
        />
      </Field>
    </div>
  );
}
