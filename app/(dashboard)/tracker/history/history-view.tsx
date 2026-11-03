"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PageHeader } from "@/components/page-header";
import { addMonths, longDateLabel, monthKey, monthLabel, yearMonthOf } from "@/lib/calendar";
import { formatLicenceDate } from "@/lib/state-licenses";
import type { TrackerCounts, TrackerDay, TrackerDays, TrackerEntry, TrackerMonth } from "@/lib/tracker";
import { DayDialog, MonthDialog } from "./history-dialogs";

type HistoryTab = "daily" | "month";
type DailyMode = "days" | "setter";

/** The API's booking rate (a percent, or null before anything is answered) as shown. */
const formatRate = (rate: number | null) => (rate === null ? "—" : `${rate.toFixed(1)}%`);

const TOGGLE_CLASS = "rounded px-3 py-1.5 text-sm font-medium";
const toggleTone = (active: boolean) => (active ? "bg-brand-soft text-brand-ink" : "text-fg-muted hover:text-fg");

function RateBar({ rate }: { rate: number | null }) {
  const pct = rate === null ? 0 : Math.min(100, Math.round(rate));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-brand-strong transition-[width]" style={{ width: `${pct}%` }} title={formatRate(rate)} />
    </div>
  );
}

/** Answered / Booked / Rate / Live xfers in a row, as a day card's summary shows them. */
function CountsRow({ counts }: { counts: TrackerCounts }) {
  const stats: [string, string, boolean][] = [
    ["Answered", String(counts.answered), false],
    ["Booked", String(counts.booked), false],
    ["Rate", formatRate(counts.bookingRate), true],
    ["Live xfers", String(counts.liveTransfer), false],
  ];
  return (
    <dl className="flex flex-wrap gap-4 sm:gap-6">
      {stats.map(([label, value, brand]) => (
        <div key={label}>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-subtle">{label}</dt>
          <dd className={`text-lg font-semibold tabular-nums ${brand ? "text-brand-ink" : "text-fg"}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntryCard({ entry, onEdit }: { entry: TrackerEntry; onEdit?: () => void }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-fg">{entry.name}</p>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["A", String(entry.answered), false],
            ["B", String(entry.booked), false],
            ["LT", String(entry.liveTransfer), false],
            ["Rate", formatRate(entry.bookingRate), true],
          ] as const
        ).map(([label, value, brand]) => (
          <div key={label}>
            <dt className="text-[0.65rem] uppercase tracking-wide text-fg-subtle">{label}</dt>
            <dd className={`text-base font-semibold tabular-nums ${brand ? "text-brand-ink" : "text-fg"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <RateBar rate={entry.bookingRate} />
    </>
  );
  const card = "w-full rounded-lg border border-line bg-surface p-3 text-left shadow-sm";
  return onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${entry.name}'s numbers`}
      className={`${card} transition hover:border-brand-strong/50 hover:bg-surface-hover/60`}
    >
      {body}
    </button>
  ) : (
    <div className={card}>{body}</div>
  );
}

function DaySummary({
  day,
  open,
  onToggle,
  onEdit,
}: {
  day: TrackerDay;
  open: boolean;
  onToggle: () => void;
  onEdit?: (entry: TrackerEntry) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left hover:bg-surface-hover/60"
      >
        <div className="min-w-[9.5rem] flex-1">
          <p className="text-sm font-semibold text-fg">{longDateLabel(day.date)}</p>
          <p className="mt-0.5 text-xs text-fg-subtle">{open ? "Hide setters" : "Show each setter"}</p>
        </div>
        <CountsRow counts={day.team} />
        <span className={`ml-auto text-fg-faint transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="border-t border-line bg-surface-muted/40 px-4 py-4">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {day.entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} onEdit={onEdit ? () => onEdit(entry) : undefined} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function SetterTrend({
  setter,
  days,
  onEdit,
}: {
  setter: TrackerDays["totals"][number];
  days: TrackerDay[];
  onEdit?: (entry: TrackerEntry) => void;
}) {
  const series = days.flatMap((day) => day.entries.filter((entry) => entry.setterId === setter.id));
  const maxAnswered = Math.max(1, ...series.map((entry) => entry.answered));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-fg">{setter.name}</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Across {series.length} day{series.length === 1 ? "" : "s"} this month
          </p>
        </div>
        <CountsRow counts={setter} />
      </div>

      <ul className="space-y-2">
        {series.map((entry) => {
          const row = (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-fg">{formatLicenceDate(entry.date)}</p>
                <p className="text-sm tabular-nums text-fg-muted">
                  <span className="font-semibold text-fg">{entry.answered}</span> ans ·{" "}
                  <span className="font-semibold text-fg">{entry.booked}</span> booked ·{" "}
                  <span className="font-semibold text-fg">{entry.liveTransfer}</span> LT ·{" "}
                  <span className="font-semibold text-brand-ink">{formatRate(entry.bookingRate)}</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-stat-blue-ink/80"
                  style={{ width: `${Math.round((entry.answered / maxAnswered) * 100)}%` }}
                />
              </div>
            </>
          );
          const card = "w-full rounded-lg border border-line bg-surface px-4 py-3 text-left shadow-sm";
          return (
            <li key={entry.id}>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label={`Edit ${entry.name}'s numbers for ${formatLicenceDate(entry.date)}`}
                  className={`${card} transition hover:border-brand-strong/50 hover:bg-surface-hover/60`}
                >
                  {row}
                </button>
              ) : (
                <div className={card}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One month's days, as cards or one setter's run. Keyed by month, so what's open starts fresh. */
function DailyPanel({
  days,
  mode,
  onEdit,
}: {
  days: TrackerDays;
  mode: DailyMode;
  onEdit?: (entry: TrackerEntry) => void;
}) {
  const [openDate, setOpenDate] = useState<string | null>(days.days[0]?.date ?? null);
  const [focusId, setFocusId] = useState<string | null>(days.totals[0]?.id ?? null);
  const focus = days.totals.find((setter) => setter.id === focusId) ?? days.totals[0];

  if (!days.days.length) {
    return <p className="text-sm text-fg-subtle">No numbers for {monthLabel(yearMonthOf(days.month))}.</p>;
  }

  if (mode === "setter") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {days.totals.map((setter) => (
            <button
              key={setter.id}
              type="button"
              onClick={() => setFocusId(setter.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                focus?.id === setter.id ? "bg-brand-strong text-white" : "bg-surface-muted text-fg-muted hover:text-fg"
              }`}
            >
              {setter.name}
            </button>
          ))}
        </div>
        {focus ? <SetterTrend setter={focus} days={days.days} onEdit={onEdit} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.days.map((day) => (
        <DaySummary
          key={day.date}
          day={day}
          open={openDate === day.date}
          onToggle={() => setOpenDate((current) => (current === day.date ? null : day.date))}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function MonthCard({ row, onEdit }: { row: TrackerMonth; onEdit?: () => void }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-fg">{monthLabel(yearMonthOf(row.month))}</p>
        {row.id ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.65rem] font-medium text-fg-muted">
            Typed in
          </span>
        ) : null}
      </div>
      <dl className="mt-3 space-y-2">
        {(
          [
            ["Answered", String(row.answered), false],
            ["Booked", String(row.booked), false],
            ["Rate", formatRate(row.bookingRate), true],
            ["Live transfers", String(row.liveTransfer), false],
          ] as const
        ).map(([label, value, brand]) => (
          <div key={label} className="flex justify-between text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className={`font-semibold tabular-nums ${brand ? "text-brand-ink" : "text-fg"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <RateBar rate={row.bookingRate} />
    </>
  );
  const card = "w-full rounded-xl border border-line bg-surface p-4 text-left shadow-sm";
  return onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${monthLabel(yearMonthOf(row.month))}`}
      className={`${card} transition hover:border-brand-strong/50 hover:bg-surface-hover/60`}
    >
      {body}
    </button>
  ) : (
    <article className={card}>{body}</article>
  );
}

/**
 * Daily and month history, as the API returns it. Daily shows one month at a
 * time (‹ › change `?month=`); a setter's card opens the edit popup. Month
 * shows every month: the sum of its days, or a total typed in by hand, which
 * is the one kind a card edits.
 */
export function HistoryView({
  days,
  months,
  thisMonth,
  canCreate,
  canUpdate,
  canDelete,
}: {
  days: TrackerDays;
  months: TrackerMonth[];
  /** "YYYY-MM": the daily view doesn't page past it. */
  thisMonth: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [tab, setTab] = useState<HistoryTab>("daily");
  const [dailyMode, setDailyMode] = useState<DailyMode>("days");
  const [dayDialog, setDayDialog] = useState<{ entry: TrackerEntry | null } | null>(null);
  const [monthDialog, setMonthDialog] = useState<{ month: TrackerMonth | null } | null>(null);

  const shown = yearMonthOf(days.month);
  const editDay = canUpdate ? (entry: TrackerEntry) => setDayDialog({ entry }) : undefined;

  return (
    <>
      <PageHeader title="Tracker History" description={<>Daily and monthly totals.</>} />

      <section className="rounded-xl border glass p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg">{tab === "daily" ? "Daily history" : "Month history"}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {tab === "daily"
                ? "Team totals by day — open a day for each setter, or follow one person over the month."
                : "Each month's days added up, or the total typed in from the old sheet."}
            </p>
          </div>
          <div className="flex rounded-md border border-line bg-surface p-0.5">
            {(
              [
                ["daily", "Daily"],
                ["month", "Month"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`${TOGGLE_CLASS} ${toggleTone(tab === id)}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "daily" ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Link
                  href={`?month=${monthKey(addMonths(shown, -1))}`}
                  aria-label="Previous month"
                  className="rounded-md px-2 py-1 text-fg-muted hover:bg-surface-hover hover:text-fg"
                >
                  ‹
                </Link>
                <span className="min-w-[9rem] text-center text-sm font-semibold text-fg">{monthLabel(shown)}</span>
                {days.month < thisMonth ? (
                  <Link
                    href={`?month=${monthKey(addMonths(shown, 1))}`}
                    aria-label="Next month"
                    className="rounded-md px-2 py-1 text-fg-muted hover:bg-surface-hover hover:text-fg"
                  >
                    ›
                  </Link>
                ) : (
                  <span className="px-2 py-1 text-fg-faint" aria-hidden>
                    ›
                  </span>
                )}
              </div>

              <div className="flex rounded-md border border-line bg-surface p-0.5">
                {(
                  [
                    ["days", "By day"],
                    ["setter", "By setter"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDailyMode(id)}
                    className={`${TOGGLE_CLASS} ${toggleTone(dailyMode === id)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {canCreate ? (
                <button type="button" onClick={() => setDayDialog({ entry: null })} className={`ml-auto ${PRIMARY_BUTTON_CLASS}`}>
                  Add day
                </button>
              ) : null}
            </div>

            <DailyPanel key={days.month} days={days} mode={dailyMode} onEdit={editDay} />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {canCreate ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMonthDialog({ month: null })} className={PRIMARY_BUTTON_CLASS}>
                  Add month
                </button>
              </div>
            ) : null}
            {months.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {months.map((row) => (
                  <MonthCard
                    key={row.month}
                    row={row}
                    onEdit={row.id && canUpdate ? () => setMonthDialog({ month: row }) : undefined}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-subtle">No months yet.</p>
            )}
          </div>
        )}
      </section>

      <DayDialog
        open={dayDialog !== null}
        onClose={() => setDayDialog(null)}
        entry={dayDialog?.entry}
        setters={days.setters}
        canDelete={canDelete}
      />
      <MonthDialog
        open={monthDialog !== null}
        onClose={() => setMonthDialog(null)}
        month={monthDialog?.month}
        canDelete={canDelete}
      />
    </>
  );
}
