"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import "@/components/sold/leaderboard.css";
import type { Leaderboard, UmbrellaTier } from "@/lib/sold/types";

type Period = "day" | "month";

type LeaderboardViewProps = {
  board: Leaderboard;
  /** The board shown first: the month when only a month was picked. */
  initialPeriod: Period;
  /** When the page read the board, e.g. "2:05 PM". */
  updatedAt: string;
  canSubmit: boolean;
  canList: boolean;
};

function Star({ tier }: { tier: UmbrellaTier }) {
  const cls = tier === "U3" ? "u3" : tier === "U2" ? "u2" : "u1";
  return (
    <svg className={`star ${cls}`} viewBox="0 0 40 40" role="img">
      <title>{`Umbrella #${tier.slice(1)}`}</title>
      <path d="M20 2.4 26.76 12.6 38.55 15.87 30.94 25.45 31.46 37.68 20 33.4 8.54 37.68 9.06 25.45 1.45 15.87 13.24 12.6Z" />
      <text x="20" y="23.5">
        {tier}
      </text>
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5V5.5M13 2.5V5.5" />
    </svg>
  );
}

type DatePickProps = {
  type: "date" | "month";
  label: string;
  /** YYYY-MM-DD for a day, YYYY-MM for a month. */
  value: string;
  max: string;
  onPick: (value: string) => void;
};

/** A calendar button that opens the browser's day or month picker. */
function DatePick({ type, label, value, max, onPick }: DatePickProps) {
  const input = useRef<HTMLInputElement>(null);

  function open() {
    const element = input.current;
    if (!element) return;
    try {
      element.showPicker();
    } catch {
      element.focus();
    }
  }

  return (
    <span className="pick">
      <button type="button" className="pick-button" aria-label={label} title={label} onClick={open}>
        <CalendarGlyph />
      </button>
      <input
        ref={input}
        type={type}
        value={value}
        max={max}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pick-input"
      />
    </span>
  );
}

function money(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** e.g. "Tue, Nov 3". */
const dayLabel = (iso: string) =>
  localDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** e.g. "November 2026". */
const monthLabel = (iso: string) => localDate(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/**
 * Scoreboard-style sales leaderboard (sold-form layout, CRM theme tokens).
 * The API ranks everyone by revenue (the commission their products earn),
 * then sales, picks the medals and projects the current month. The calendar
 * beside Today picks an earlier day (?day=), the one beside This month an
 * earlier month (?month=); clicking the period again goes back.
 */
export function LeaderboardView({ board, initialPeriod, updatedAt, canSubmit, canList }: LeaderboardViewProps) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const { rows, totals } = board[period];
  const showStars = period === "day";
  const showProjected = period === "month" && totals.projected !== null;

  const today = board.date;
  const thisMonth = today.slice(0, 7);
  const pickedDay = board.day.date;
  const pickedMonth = board.month.date.slice(0, 7);
  const pastDay = pickedDay !== today;
  const pastMonth = pickedMonth !== thisMonth;

  function show(day: string, month: string) {
    const params = new URLSearchParams();
    if (day !== today) params.set("day", day);
    if (month !== thisMonth) params.set("month", month);
    const query = params.toString();
    startTransition(() => router.push(query ? `/sold/leaderboard?${query}` : "/sold/leaderboard", { scroll: false }));
  }

  function choose(next: Period) {
    if (next !== period) setPeriod(next);
    else if (next === "day" && pastDay) show(today, pickedMonth);
    else if (next === "month" && pastMonth) show(pickedDay, thisMonth);
  }

  return (
    <div className="lb">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        {canList ? (
          <Link href="/sold/list" className={GHOST_BUTTON_CLASS}>
            Sold list
          </Link>
        ) : null}
        {canSubmit ? (
          <Link href="/sold" className={PRIMARY_BUTTON_CLASS}>
            Submit sale
          </Link>
        ) : null}
      </div>

      <div className="board">
        <header className="title">
          <h1>
            <span className="sold-word">SOLD!!!</span> Sales Leaderboard
          </h1>
        </header>

        <section
          className="panel"
          data-period={period}
          data-projected={showProjected ? "" : undefined}
          aria-busy={loading}
        >
          <header className="panel-head">
            <div className="periods" role="group" aria-label="Period">
              <button
                type="button"
                aria-pressed={period === "day"}
                data-past={pastDay ? "" : undefined}
                title={period === "day" && pastDay ? "Back to today" : undefined}
                onClick={() => choose("day")}
              >
                {pastDay ? dayLabel(pickedDay) : "Today"}
              </button>
              <DatePick
                type="date"
                label="Pick a day"
                value={pickedDay}
                max={today}
                onPick={(day) => {
                  setPeriod("day");
                  show(day, pickedMonth);
                }}
              />
              <span className="divider" aria-hidden="true" />
              <button
                type="button"
                aria-pressed={period === "month"}
                data-past={pastMonth ? "" : undefined}
                title={period === "month" && pastMonth ? "Back to this month" : undefined}
                onClick={() => choose("month")}
              >
                {pastMonth ? monthLabel(board.month.date) : "This month"}
              </button>
              <DatePick
                type="month"
                label="Pick a month"
                value={pickedMonth}
                max={thisMonth}
                onPick={(month) => {
                  setPeriod("month");
                  show(pickedDay, month);
                }}
              />
            </div>
          </header>

          <div className="table" role="table" aria-label="Leaderboard">
            <div className="row heads" role="row">
              <span className="rank" role="columnheader">
                #
              </span>
              <span role="columnheader">Agent</span>
              <span className="num" role="columnheader">
                Sales
              </span>
              <span className="num detail" role="columnheader">
                MAPD
              </span>
              <span className="num detail" role="columnheader">
                SUP
              </span>
              <span
                className="num detail"
                role="columnheader"
                title="Ancillary: DVH, Cancer, Heart, HIP, HHC, RCP"
              >
                Anc
              </span>
              <span className="num" role="columnheader" title="Commission">
                Revenue
              </span>
              {showProjected ? (
                <span className="num" role="columnheader" title="Revenue at this pace by the month's end">
                  Projected
                </span>
              ) : null}
            </div>

            <div className="rows" role="rowgroup" style={{ ["--count" as string]: Math.max(rows.length, 1) }}>
              {rows.length === 0 ? (
                <div className="row zero" role="row">
                  <span className="rank" role="cell">
                    —
                  </span>
                  <span className="agent" role="cell">
                    <span className="name">No sales yet</span>
                  </span>
                  <span className="num" role="cell">
                    0
                  </span>
                  <span className="num detail" role="cell">
                    0
                  </span>
                  <span className="num detail" role="cell">
                    0
                  </span>
                  <span className="num detail" role="cell">
                    0
                  </span>
                  <span className="num revenue" role="cell">
                    $0
                  </span>
                  {showProjected ? (
                    <span className="num projected" role="cell">
                      $0
                    </span>
                  ) : null}
                </div>
              ) : (
                rows.map((row) => {
                  const classes = ["row", row.place ?? "", row.isMe ? "me" : ""].filter(Boolean).join(" ");
                  return (
                    <div key={row.id} className={classes} role="row">
                      <span className="rank" role="cell">
                        {row.place ? <span className="medal">{row.rank}</span> : row.rank}
                      </span>
                      <span className="agent" role="cell">
                        <span className="name" title={row.name}>
                          {row.initials}
                        </span>
                        {row.isMe ? <span className="you">you</span> : null}
                        {showStars && row.umbrellas.length > 0 ? (
                          <span className="stars">
                            {row.umbrellas.map((tier, i) => (
                              <Star key={`${tier}-${i}`} tier={tier} />
                            ))}
                          </span>
                        ) : null}
                      </span>
                      <span className="num" role="cell">
                        {row.sales}
                      </span>
                      <span className="num detail" role="cell">
                        {row.mapd}
                      </span>
                      <span className="num detail" role="cell">
                        {row.sup}
                      </span>
                      <span className="num detail" role="cell">
                        {row.anc}
                      </span>
                      <span className="num revenue" role="cell">
                        {money(row.revenue)}
                      </span>
                      {showProjected ? (
                        <span className="num projected" role="cell">
                          {money(row.projected ?? 0)}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <div className="row total" role="row">
              <span className="label" role="rowheader">
                Total
              </span>
              <span className="num" role="cell">
                {totals.sales}
              </span>
              <span className="num detail" role="cell">
                {totals.mapd}
              </span>
              <span className="num detail" role="cell">
                {totals.sup}
              </span>
              <span className="num detail" role="cell">
                {totals.anc}
              </span>
              <span className="num revenue" role="cell">
                {money(totals.revenue)}
              </span>
              {showProjected ? (
                <span className="num projected" role="cell">
                  {money(totals.projected ?? 0)}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* The live dot only pulses on today and this month. */}
        <p className={(period === "day" ? pastDay : pastMonth) ? "status" : "status live"} role="status">
          <span className="period-date">
            {period === "day" ? dayLabel(pickedDay) : monthLabel(board.month.date)}
          </span>
          <span>{`Updated ${updatedAt}`}</span>
        </p>
      </div>
    </div>
  );
}
