"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from "react";
import { submitSale, type SubmitSaleResult } from "@/app/(dashboard)/sold/actions";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { FormSection } from "@/components/producer-form";
import { confetti } from "@/lib/sold/confetti";
import { optionList, SECTIONS, type FieldDef } from "@/lib/sold/formConfig";
import {
  emptySaleState,
  fieldRequired,
  fieldVisible,
  productKey,
  saleFormData,
  type SaleMe,
  type SaleState,
} from "@/lib/sold/logic";
import type { SoldOptions, SubmittedSale } from "@/lib/sold/types";
import { ProductPicker } from "./ProductPicker";
import "./sale-form.css";

type SaleFormProps = {
  me: SaleMe;
  /** The products, carriers and lists the API offers, with its rules. */
  options: SoldOptions;
  /** When false, the parent owns the page header. */
  showHeader?: boolean;
  /** Extra actions under “Submit another sale” on the success card (e.g. link to the list). */
  afterSubmit?: ReactNode;
};

/** Grid column span. Client Info uses 6 cols so Phone / State / AOR share one row. */
function fieldSpan(field: FieldDef, sectionTitle: string) {
  if (sectionTitle === "Client Info") {
    if (field.key === "client_first_name" || field.key === "client_last_name") return "sm:col-span-3";
    return "sm:col-span-2";
  }
  if (field.type === "products") return "sm:col-span-2";
  // New row so “Previous MAPD/PDP Product” lands beside it when Yes (same as Replacement Sale).
  if (field.key === "prior_mapd_pdp_enrollment") return "sm:col-start-1";
  return "";
}

function sectionColumns(title: string) {
  if (title === "Client Info") return "sm:grid-cols-6";
  if (title === "Lead & Calendar") return "grid-cols-1";
  return "sm:grid-cols-2";
}

/** Every question key in page order, the ticked products' answers after the product list. */
function keysInOrder(state: SaleState, options: SoldOptions): string[] {
  return SECTIONS.flatMap((section) =>
    section.fields.flatMap((field) => {
      if (field.type !== "products") return [field.key];
      const ticked = options.products.filter((product) => state.products.includes(product.name));
      return [field.key, ...ticked.flatMap((product) => product.fields.map((name) => productKey(product.name, name)))];
    }),
  );
}

export function SaleForm({ me, options, showHeader = true, afterSubmit }: SaleFormProps) {
  const idPrefix = useId();
  const headerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const [state, setState] = useState<SaleState>(emptySaleState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmittedSale | null>(null);
  const [party, setParty] = useState<SubmittedSale | null>(null);
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

  // An answer that changes drops its error; the API checks it again on submit.
  const clearErrors = (matches: (key: string) => boolean) => {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !matches(key))));
  };

  const setValue = (key: string, value: string) => {
    setState((current) => ({ ...current, values: { ...current.values, [key]: value } }));
    clearErrors((k) => k === key);
  };

  const onToggleProduct = (product: string, checked: boolean) => {
    setState((current) => ({
      ...current,
      products: checked ? [...current.products, product] : current.products.filter((p) => p !== product),
    }));
    clearErrors((k) => k === "products" || k.startsWith(`${product}.`));
  };

  const onSkipPdf = (product: string, skip: boolean) => {
    setState((current) => ({
      ...current,
      skipPdf: { ...current.skipPdf, [product]: skip },
      files: skip ? { ...current.files, [product]: null } : current.files,
    }));
    if (skip) setFileKeys((keys) => ({ ...keys, [product]: (keys[product] ?? 0) + 1 }));
    clearErrors((k) => k === productKey(product, "pdf"));
  };

  const onFile = (product: string, file: File | null) => {
    setState((current) => ({ ...current, files: { ...current.files, [product]: file } }));
    clearErrors((k) => k === productKey(product, "pdf"));
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
    setSubmitting(true);
    let result: SubmitSaleResult;
    try {
      result = await submitSale(saleFormData(state, options));
    } catch {
      // No answer at all, e.g. the PDFs were too big to send.
      result = { ok: false, message: "Something went wrong.", errors: {} };
    } finally {
      setSubmitting(false);
    }

    if (!result.ok) {
      const { errors: found, message } = result;
      setErrors(found);
      const order = keysInOrder(state, options);
      const first = order.find((key) => found[key]);
      // A problem with no question on the page says itself in the banner.
      const unplaced = Object.entries(found).find(([key]) => !order.includes(key));
      setBanner(first && !unplaced ? message : `The sale wasn’t saved: ${unplaced?.[1] ?? message} Try submitting again.`);
      const el = first ? fieldRefs.current[first] : null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      return;
    }

    setErrors({});
    setDone(result.sale);
    setParty(result.sale);
    headerRef.current?.scrollIntoView({ block: "start" });
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
        fieldVisible(field, state, options) ? (
          <TopField
            key={field.key}
            idPrefix={idPrefix}
            field={field}
            sectionTitle={section.title}
            options={options}
            state={state}
            error={errors[field.key]}
            errors={errors}
            fileKeys={fileKeys}
            fieldRefs={fieldRefs}
            onValue={setValue}
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
        {showHeader ? (
          <PageHeader
            title="Sold"
            description={
              <>
                {submittingAs ? <span>{submittingAs}. </span> : null}
                <span>Submit a sale.</span>
              </>
            }
          />
        ) : null}

        {done ? (
          <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-fg">Sale submitted</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {done.clientName ? `The sale for ${done.clientName} is recorded.` : "Your sale is recorded."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={submitAnother}>
                Submit another sale
              </button>
              {afterSubmit}
            </div>
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
            <p>{party.clientName ? `Great work closing ${party.clientName}!` : "Great work!"}</p>
            <p>{party.products.join(" · ")}</p>
            {party.totalPremium && Number(party.totalPremium) > 0 ? (
              <p className="sold-party-total">{`$${party.totalPremium} in premium`}</p>
            ) : null}
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
  options,
  state,
  error,
  errors,
  fileKeys,
  fieldRefs,
  onValue,
  onToggleProduct,
  onSkipPdf,
  onFile,
}: {
  idPrefix: string;
  field: FieldDef;
  sectionTitle: string;
  options: SoldOptions;
  state: SaleState;
  error?: string;
  errors: Record<string, string>;
  fileKeys: Record<string, number>;
  fieldRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onValue: (key: string, value: string) => void;
  onToggleProduct: (product: string, checked: boolean) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
}) {
  const id = `${idPrefix}-${field.key}`.replace(/\W+/g, "-");
  const required = fieldRequired(field, state);
  const value = state.values[field.key] ?? "";
  const span = fieldSpan(field, sectionTitle);
  const err = error ? { hint: error, hintId: `${id}-error`, error: true as const } : {};
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };

  const setRef = (el: HTMLElement | null) => {
    fieldRefs.current[field.key] = el;
  };

  if (field.type === "products") {
    return (
      <div className={span} ref={setRef}>
        <Field label={field.label} htmlFor={id} required={required} {...err}>
          <div id={id} className="mt-1">
            <ProductPicker
              idPrefix={idPrefix}
              options={options}
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
            />
          </div>
        </Field>
      </div>
    );
  }

  if (field.type === "yesno") {
    return (
      <div className={span || undefined} ref={setRef}>
        <Field label={field.label} htmlFor={id} required={required} {...err}>
          <YesNo name={field.key} value={value} onChange={(next) => onValue(field.key, next)} />
        </Field>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={span || undefined} ref={setRef}>
        <Field label={field.label} htmlFor={id} required={required} optional={!required} {...err}>
          <select
            id={id}
            value={value}
            {...aria}
            onChange={(event) => onValue(field.key, event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Choose</option>
            {(field.options ? optionList(options, field.options) : []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  const phone = field.type === "phone";
  return (
    <div className={span || undefined} ref={setRef}>
      <Field label={field.label} htmlFor={id} required={required} {...err}>
        <input
          id={id}
          type={phone ? "tel" : "text"}
          {...(phone ? { inputMode: "tel" as const, autoComplete: "off", placeholder: "(555) 555-5555" } : {})}
          value={value}
          {...aria}
          onChange={(event) => onValue(field.key, event.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
    </div>
  );
}
