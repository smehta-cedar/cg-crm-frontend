"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { updateSale, type UpdateSaleResult } from "@/app/(dashboard)/sold/actions";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { FormSection } from "@/components/producer-form";
import { SECTIONS, type FieldDef } from "@/lib/sold/formConfig";
import { fieldVisible, productKey, saleFormData, saleStateFromRow } from "@/lib/sold/logic";
import { clientFullName, soldPdfHref, type SoldOptions, type SoldProductRow } from "@/lib/sold/types";
import { ProductEntry } from "./ProductPicker";
import { sectionColumns, TopField, useSaleAnswers } from "./SaleForm";

/*
 * The Sold list's edit popup for one row: the Sold form's questions filled
 * in with the sale's answers, the sold date, and the row's product's own
 * questions. The product itself can't change. Every product on a sale
 * shares its answers, so a change to the client shows on the sale's other
 * rows too. Saving goes through updateSale (PATCH /sold/products/{id}/),
 * which checks it as the form's submit does and names each problem.
 */

const SOLD_DATE: FieldDef = { key: "sold_date", label: "Sold Date", type: "date", required: true };

type SaleEditDialogProps = {
  /** The row being edited; null keeps the dialog closed. */
  row: SoldProductRow | null;
  /** Every product on the row's sale, which decides the questions it asks. */
  saleProducts: string[];
  options: SoldOptions;
  /** Runs for every close: Cancel or a save. */
  onClose: () => void;
};

export function SaleEditDialog({ row, saleProducts, options, onClose }: SaleEditDialogProps) {
  const { dialogRef, close } = useModalDialog(row !== null);
  const id = useId();

  // Clearing the row unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {row ? <SaleEditForm id={id} row={row} saleProducts={saleProducts} options={options} close={close} /> : null}
    </ModalDialog>
  );
}

type SaleEditFormProps = Omit<SaleEditDialogProps, "row" | "onClose"> & {
  id: string;
  row: SoldProductRow;
  close: () => void;
};

function SaleEditForm({ id, row, saleProducts, options, close }: SaleEditFormProps) {
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const { state, errors, setErrors, fileKeys, setValue, onToggleProduct, onSkipPdf, onFile } = useSaleAnswers(() =>
    saleStateFromRow(row),
  );
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const product = options.products.find((option) => option.name === row.product);
  // The questions follow every product on the sale, not just this row's.
  const shown = { ...state, products: saleProducts };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setBanner("");
    setSaving(true);
    let result: UpdateSaleResult;
    try {
      result = await updateSale(row.id, saleFormData(state, options));
    } catch {
      result = { ok: false, message: "Something went wrong.", errors: {} };
    } finally {
      setSaving(false);
    }
    if (result.ok) {
      close();
      return;
    }

    const found = result.errors;
    setErrors(found);
    // A problem with no question here says itself in the banner.
    const unplaced = Object.entries(found).find(([key]) => !fieldRefs.current[key]);
    setBanner(unplaced ? unplaced[1] : result.message);
    const first = Object.keys(fieldRefs.current).find((key) => found[key] && fieldRefs.current[key]);
    if (first) fieldRefs.current[first]?.scrollIntoView({ block: "center" });
  };

  const topField = (field: FieldDef, sectionTitle: string) => (
    <TopField
      key={field.key}
      idPrefix={id}
      field={field}
      sectionTitle={sectionTitle}
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
  );

  const keptPdf = row.pdfName ? (
    <p className="mt-1 truncate text-xs">
      <a href={soldPdfHref(row.id)} className="text-brand-ink hover:underline">
        {row.pdfName}
      </a>
    </p>
  ) : null;

  return (
    <form noValidate onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {`Edit ${clientFullName(row) || "sale"} · ${row.product}`}
      </h2>

      <div className="mt-5 grid gap-5">
        {SECTIONS.map((section) => (
          <FormSection key={section.title} title={section.title} layout="dialog" columns={sectionColumns(section.title)}>
            {section.title === "Lead & Calendar" ? topField(SOLD_DATE, section.title) : null}
            {section.fields.map((field) =>
              field.type !== "products" && fieldVisible(field, shown, options) ? topField(field, section.title) : null,
            )}
          </FormSection>
        ))}

        {product ? (
          <FormSection title={product.name} layout="dialog" columns="sm:grid-cols-2">
            {product.fields.map((field) => (
              <ProductEntry
                key={field}
                idPrefix={id}
                product={product}
                field={field}
                options={options}
                state={state}
                error={errors[productKey(product.name, field)]}
                fileKey={fileKeys[product.name] ?? 0}
                keptPdf={keptPdf}
                onFieldRef={(key, el) => {
                  fieldRefs.current[key] = el;
                }}
                onValue={setValue}
                onSkipPdf={onSkipPdf}
                onFile={onFile}
              />
            ))}
          </FormSection>
        ) : null}
      </div>

      <div role="alert" className="mt-4 text-sm text-danger">
        {banner}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
