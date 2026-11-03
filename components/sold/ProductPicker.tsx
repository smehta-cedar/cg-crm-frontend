"use client";

import { OPTIONS, PDF_CAN_SKIP, PRODUCT_FIELDS } from "@/lib/sold/formConfig";
import {
  blockedProducts,
  formatPremiumTotal,
  incompatibleNote,
  pdfRequired,
  productStateKey,
  type SaleState,
} from "@/lib/sold/logic";
import { INPUT_CLASS } from "@/components/classes";
import { Field } from "@/components/field";

type ProductPickerProps = {
  idPrefix: string;
  state: SaleState;
  errors: Record<string, string>;
  fileKeys: Record<string, number>;
  onFieldRef?: (key: string, el: HTMLElement | null) => void;
  onToggle: (product: string, checked: boolean) => void;
  onValue: (key: string, value: string) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
  onBlur: (key: string) => void;
};

export function ProductPicker({
  idPrefix,
  state,
  errors,
  fileKeys,
  onFieldRef,
  onToggle,
  onValue,
  onSkipPdf,
  onFile,
  onBlur,
}: ProductPickerProps) {
  const blocked = blockedProducts(state.products);
  const note = incompatibleNote(state.products);
  const total = formatPremiumTotal(state);

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {OPTIONS.products.map((product) => {
          const ticked = state.products.includes(product);
          const off = !ticked && blocked.has(product);
          return (
            <div
              key={product}
              className={`rounded-md border transition-colors ${
                ticked
                  ? "border-brand-strong/35 bg-brand-soft"
                  : off
                    ? "border-line opacity-40"
                    : "border-line-strong bg-surface hover:border-brand-strong/40"
              }`}
            >
              <label
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-fg ${
                  off ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  value={product}
                  checked={ticked}
                  disabled={off}
                  onChange={(event) => onToggle(product, event.target.checked)}
                  className="size-4 accent-brand-strong"
                />
                {product}
              </label>
              {ticked ? (
                <div className="border-t border-line/80 px-3.5 pb-3.5 pt-1">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(PRODUCT_FIELDS[product] ?? []).map((entry) => (
                      <ProductEntry
                        key={entry}
                        idPrefix={idPrefix}
                        product={product}
                        entry={entry}
                        state={state}
                        error={errors[productStateKey(product, entry)]}
                        fileKey={fileKeys[product] ?? 0}
                        onFieldRef={onFieldRef}
                        onValue={onValue}
                        onSkipPdf={onSkipPdf}
                        onFile={onFile}
                        onBlur={onBlur}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
      {total ? <p className="text-sm font-semibold text-brand-ink">{total}</p> : null}
    </div>
  );
}

function ProductEntry({
  idPrefix,
  product,
  entry,
  state,
  error,
  fileKey,
  onFieldRef,
  onValue,
  onSkipPdf,
  onFile,
  onBlur,
}: {
  idPrefix: string;
  product: string;
  entry: string;
  state: SaleState;
  error?: string;
  fileKey: number;
  onFieldRef?: (key: string, el: HTMLElement | null) => void;
  onValue: (key: string, value: string) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
  onBlur: (key: string) => void;
}) {
  const key = productStateKey(product, entry);
  const id = `${idPrefix}-${product}-${entry}`.replace(/\W+/g, "-");
  const value = state.values[key] ?? "";
  const setRef = (el: HTMLElement | null) => onFieldRef?.(key, el);
  const err = error
    ? { hint: error, hintId: `${id}-error`, error: true as const }
    : {};

  if (entry === "PDF") {
    const required = pdfRequired(product, state);
    const skipped = Boolean(state.skipPdf[product]);
    const canSkip = (PDF_CAN_SKIP as readonly string[]).includes(product);

    return (
      <>
        <div ref={setRef} className={canSkip ? "sm:col-span-1" : undefined}>
          <Field label={`${product} PDF`} htmlFor={id} required={required} {...err}>
            <input
              key={fileKey}
              id={id}
              type="file"
              accept="application/pdf,.pdf"
              disabled={skipped}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => onFile(product, event.target.files?.[0] ?? null)}
              className={`${INPUT_CLASS} file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-sm file:font-medium file:text-fg disabled:opacity-50`}
            />
          </Field>
        </div>
        {canSkip ? (
          <label className="mt-7 flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={skipped}
              onChange={(event) => onSkipPdf(product, event.target.checked)}
              className="size-4 accent-brand-strong"
            />
            Unable to generate
          </label>
        ) : null}
      </>
    );
  }

  if (entry === "Carrier") {
    return (
      <div ref={setRef}>
        <Field label="Carrier" htmlFor={id} required {...err}>
          <select
            id={id}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(key, event.target.value)}
            onBlur={() => onBlur(key)}
            className={INPUT_CLASS}
          >
            <option value="">Choose</option>
            {OPTIONS.carriers.map((carrier) => (
              <option key={carrier} value={carrier}>
                {carrier}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  if (entry.endsWith(" Premium")) {
    return (
      <div ref={setRef}>
        <Field label={entry} htmlFor={id} required {...err}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-[calc(50%+0.125rem)] -translate-y-1/2 text-sm text-fg-subtle">
              $
            </span>
            <input
              id={id}
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              placeholder="0.00"
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => onValue(key, event.target.value)}
              onBlur={() => onBlur(key)}
              className={`${INPUT_CLASS} pl-7`}
            />
          </div>
        </Field>
      </div>
    );
  }

  if (entry === "Medicare Number (MBI)") {
    return (
      <div ref={setRef}>
        <Field label="Medicare Number (MBI)" htmlFor={id} required {...err}>
          <input
            id={id}
            type="text"
            maxLength={14}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 1EG4TE5MK73"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(key, event.target.value)}
            onBlur={() => onBlur(key)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  if (entry === "Contract Number") {
    return (
      <div ref={setRef}>
        <Field label="Contract Number" htmlFor={id} required {...err}>
          <input
            id={id}
            type="text"
            placeholder="e.g. H7617-052"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(key, event.target.value)}
            onBlur={() => onBlur(key)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  if (entry === "Sup Plan") {
    return (
      <div ref={setRef}>
        <Field label="Sup Plan" htmlFor={id} required {...err}>
          <input
            id={id}
            type="text"
            placeholder="e.g. Plan G"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(key, event.target.value)}
            onBlur={() => onBlur(key)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  if (entry === "Effective Date") {
    return (
      <div ref={setRef}>
        <Field label="Effective Date" htmlFor={id} required {...err}>
          <input
            id={id}
            type="date"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onValue(key, event.target.value)}
            onBlur={() => onBlur(key)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  return null;
}
