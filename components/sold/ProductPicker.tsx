"use client";

import { productFieldLabel } from "@/lib/sold/formConfig";
import {
  blockedProducts,
  formatPremiumTotal,
  incompatibleNote,
  pdfRequired,
  productKey,
  type SaleState,
} from "@/lib/sold/logic";
import type { ProductField, ProductOption, SoldOptions } from "@/lib/sold/types";
import { INPUT_CLASS } from "@/components/classes";
import { Field } from "@/components/field";

type ProductPickerProps = {
  idPrefix: string;
  options: SoldOptions;
  state: SaleState;
  errors: Record<string, string>;
  fileKeys: Record<string, number>;
  onFieldRef?: (key: string, el: HTMLElement | null) => void;
  onToggle: (product: string, checked: boolean) => void;
  onValue: (key: string, value: string) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
};

export function ProductPicker({
  idPrefix,
  options,
  state,
  errors,
  fileKeys,
  onFieldRef,
  onToggle,
  onValue,
  onSkipPdf,
  onFile,
}: ProductPickerProps) {
  const blocked = blockedProducts(state.products, options);
  const note = incompatibleNote(state.products, options);
  const total = formatPremiumTotal(state);

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {options.products.map((product) => {
          const ticked = state.products.includes(product.name);
          const off = !ticked && blocked.has(product.name);
          return (
            <div
              key={product.name}
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
                  value={product.name}
                  checked={ticked}
                  disabled={off}
                  onChange={(event) => onToggle(product.name, event.target.checked)}
                  className="size-4 accent-brand-strong"
                />
                {product.name}
              </label>
              {ticked ? (
                <div className="border-t border-line/80 px-3.5 pb-3.5 pt-1">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {product.fields.map((field) => (
                      <ProductEntry
                        key={field}
                        idPrefix={idPrefix}
                        product={product}
                        field={field}
                        options={options}
                        state={state}
                        error={errors[productKey(product.name, field)]}
                        fileKey={fileKeys[product.name] ?? 0}
                        onFieldRef={onFieldRef}
                        onValue={onValue}
                        onSkipPdf={onSkipPdf}
                        onFile={onFile}
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
  field,
  options,
  state,
  error,
  fileKey,
  onFieldRef,
  onValue,
  onSkipPdf,
  onFile,
}: {
  idPrefix: string;
  product: ProductOption;
  field: ProductField;
  options: SoldOptions;
  state: SaleState;
  error?: string;
  fileKey: number;
  onFieldRef?: (key: string, el: HTMLElement | null) => void;
  onValue: (key: string, value: string) => void;
  onSkipPdf: (product: string, skip: boolean) => void;
  onFile: (product: string, file: File | null) => void;
}) {
  const key = productKey(product.name, field);
  const id = `${idPrefix}-${product.name}-${field}`.replace(/\W+/g, "-");
  const label = productFieldLabel(product.name, field);
  const value = state.values[key] ?? "";
  const setRef = (el: HTMLElement | null) => onFieldRef?.(key, el);
  const err = error
    ? { hint: error, hintId: `${id}-error`, error: true as const }
    : {};
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };

  if (field === "pdf") {
    const skipped = Boolean(state.skipPdf[product.name]);
    const canSkip = product.pdf === "skippable";

    return (
      <>
        <div ref={setRef} className={canSkip ? "sm:col-span-1" : undefined}>
          <Field label={label} htmlFor={id} required={pdfRequired(product, state)} {...err}>
            <input
              key={fileKey}
              id={id}
              type="file"
              accept="application/pdf,.pdf"
              disabled={skipped}
              {...aria}
              onChange={(event) => onFile(product.name, event.target.files?.[0] ?? null)}
              className={`${INPUT_CLASS} file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-sm file:font-medium file:text-fg disabled:opacity-50`}
            />
          </Field>
        </div>
        {canSkip ? (
          <label className="mt-7 flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={skipped}
              onChange={(event) => onSkipPdf(product.name, event.target.checked)}
              className="size-4 accent-brand-strong"
            />
            Unable to generate
          </label>
        ) : null}
      </>
    );
  }

  if (field === "carrier") {
    return (
      <div ref={setRef}>
        <Field label={label} htmlFor={id} required {...err}>
          <select
            id={id}
            value={value}
            {...aria}
            onChange={(event) => onValue(key, event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Choose</option>
            {options.carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  if (field === "premium") {
    return (
      <div ref={setRef}>
        <Field label={label} htmlFor={id} required {...err}>
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
              {...aria}
              onChange={(event) => onValue(key, event.target.value)}
              className={`${INPUT_CLASS} pl-7`}
            />
          </div>
        </Field>
      </div>
    );
  }

  if (field === "effective_date") {
    return (
      <div ref={setRef}>
        <Field label={label} htmlFor={id} required {...err}>
          <input
            id={id}
            type="date"
            value={value}
            {...aria}
            onChange={(event) => onValue(key, event.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    );
  }

  // MBI, contract number, SUP plan: plain text.
  const placeholder = { mbi: "e.g. 1EG4TE5MK73", contract_number: "e.g. H7617-052", sup_plan: "e.g. Plan G" }[field];
  return (
    <div ref={setRef}>
      <Field label={label} htmlFor={id} required {...err}>
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          {...(field === "mbi"
            ? { maxLength: 14, autoCapitalize: "characters", autoComplete: "off", spellCheck: false }
            : {})}
          {...aria}
          onChange={(event) => onValue(key, event.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
    </div>
  );
}
