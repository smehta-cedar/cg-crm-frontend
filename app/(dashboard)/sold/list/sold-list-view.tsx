"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SaleEditDialog } from "@/components/sold/SaleEditDialog";
import { clientFullName, soldPdfHref, type SoldOptions, type SoldProductRow } from "@/lib/sold/types";

function dash(value: string) {
  return value.trim() ? value : "—";
}

function formatMoney(raw: string) {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || raw.trim() === "") return "—";
  return `$${n.toFixed(2)}`;
}

const COLUMNS: DataTableColumn<SoldProductRow>[] = [
  {
    id: "soldDate",
    header: "Sold date",
    cell: (row) => row.soldDate,
    sortValue: (row) => row.soldDate,
    searchText: (row) => row.soldDate,
    width: "8%",
  },
  {
    id: "client",
    header: "Client",
    cell: (row, { expanded, toggleExpanded, detailsId }) => {
      const name = clientFullName(row) || "—";
      return (
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={expanded ? detailsId : undefined}
          className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
        >
          {name}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`size-4 shrink-0 text-fg-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 5l5 5-5 5" />
          </svg>
        </button>
      );
    },
    sortValue: (row) => clientFullName(row),
    searchText: (row) => [clientFullName(row), row.clientPhone, row.state],
    width: "12%",
  },
  {
    id: "product",
    header: "Product",
    cell: (row) => <span className="font-medium text-fg">{row.product}</span>,
    sortValue: (row) => row.product,
    searchText: (row) => row.product,
    width: "7%",
  },
  {
    id: "carrier",
    header: "Carrier",
    cell: (row) => dash(row.carrier),
    sortValue: (row) => row.carrier,
    searchText: (row) => row.carrier,
    width: "12%",
  },
  {
    id: "effectiveDate",
    header: "Effective",
    cell: (row) => dash(row.effectiveDate),
    sortValue: (row) => row.effectiveDate,
    searchText: (row) => row.effectiveDate,
    width: "8%",
  },
  {
    id: "premium",
    header: "Premium",
    cell: (row) => <span className="tabular-nums">{formatMoney(row.premium)}</span>,
    sortValue: (row) => parseFloat(row.premium) || 0,
    width: "8%",
  },
  {
    id: "leadSource",
    header: "Lead source",
    cell: (row) => dash(row.leadSource),
    sortValue: (row) => row.leadSource,
    searchText: (row) => row.leadSource,
    width: "10%",
  },
  {
    id: "calendar",
    header: "Calendar",
    cell: (row) => dash(row.calendar),
    sortValue: (row) => row.calendar,
    searchText: (row) => row.calendar,
    width: "7%",
  },
  {
    id: "commission",
    header: "Commission",
    cell: (row) => <span className="tabular-nums">{formatMoney(row.commission)}</span>,
    sortValue: (row) => parseFloat(row.commission) || 0,
    width: "8%",
  },
  {
    id: "state",
    header: "State",
    cell: (row) => dash(row.state),
    sortValue: (row) => row.state,
    searchText: (row) => row.state,
    width: "6%",
  },
  {
    id: "submittedBy",
    header: "Submitted by",
    cell: (row) => <span className="text-fg-muted">{dash(row.submittedBy)}</span>,
    sortValue: (row) => row.submittedBy,
    searchText: (row) => [row.submittedBy, row.submittedByEmail],
    width: "9%",
  },
  {
    id: "pdf",
    header: "PDF",
    cell: (row) => <PdfCell row={row} />,
    width: "8%",
  },
];

function Detail({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
    </div>
  );
}

/** The product's PDF as a download, or why there is none. */
function PdfCell({ row }: { row: SoldProductRow }) {
  if (row.pdfName) {
    return (
      <a
        href={soldPdfHref(row.id)}
        title={row.pdfName}
        className="block truncate text-brand-ink hover:underline"
      >
        {row.pdfName}
      </a>
    );
  }
  return <span className="text-fg-muted">{row.pdfUnableToGenerate ? "Unable to generate" : "—"}</span>;
}

type SoldListViewProps = {
  rows: SoldProductRow[];
  /** Holds the Sold-form add box. */
  canSubmit: boolean;
  canSeeLeaderboard: boolean;
  /** The form's choices for a row's edit popup; null when the role can't edit (Sold list edit box). */
  editOptions: SoldOptions | null;
};

/** Product rows for every submitted sale the user can see; a row's Edit opens SaleEditDialog. */
export function SoldListView({ rows, canSubmit, canSeeLeaderboard, editOptions }: SoldListViewProps) {
  const [editing, setEditing] = useState<SoldProductRow | null>(null);

  const columns = useMemo<DataTableColumn<SoldProductRow>[]>(
    () =>
      editOptions
        ? [
            {
              id: "actions",
              header: "Action",
              cell: (row: SoldProductRow) => (
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                >
                  <EditIcon className="size-3.5 shrink-0" />
                  <span className="sr-only">{` ${clientFullName(row)} ${row.product}`}</span>
                </button>
              ),
              width: "5%",
            },
            ...COLUMNS,
          ]
        : COLUMNS,
    [editOptions],
  );

  // A sale's answers are shared by its products, whose rows share its saleId.
  const saleProducts = editing ? rows.filter((row) => row.saleId === editing.saleId).map((row) => row.product) : [];

  const submit = canSubmit ? (
    <Link href="/sold" className={PRIMARY_BUTTON_CLASS}>
      Submit sale
    </Link>
  ) : null;

  return (
    <>
      <PageHeader
        title="Sold list"
        description="One row per product sold."
        actions={
          <div className="flex flex-wrap gap-2">
            {canSeeLeaderboard ? (
              <Link href="/sold/leaderboard" className={GHOST_BUTTON_CLASS}>
                Leaderboard
              </Link>
            ) : null}
            {submit}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Submitted sales are listed here, one row per product."
          action={submit}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          unit={["product", "products"]}
          saveAs="sold"
          emptyMessage="No products match that search."
          renderDetails={(row) => (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Phone" value={row.clientPhone} />
              <Detail label="AOR" value={row.aor} />
              <Detail label="MBI" value={row.mbi} />
              <Detail label="Contract number" value={row.contractNumber} />
              <Detail label="SUP plan" value={row.supPlan} />
              <Detail label="Replacement sale" value={row.replacementSale} />
              <Detail label="Previous sold product" value={row.previousSoldProduct} />
              <Detail label="Prior MAPD/PDP enrollment" value={row.priorMapdPdpEnrollment} />
              <Detail label="Previous MAPD/PDP product" value={row.previousMapdPdpProduct} />
              <Detail label="Umbrella" value={row.umbrella} />
              <Detail label="Submitted by" value={row.submittedByEmail} />
            </dl>
          )}
        />
      )}

      {editOptions ? (
        <SaleEditDialog
          row={editing}
          saleProducts={saleProducts}
          options={editOptions}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
