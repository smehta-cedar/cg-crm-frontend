"use client";

import Link from "next/link";
import { useState } from "react";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import "@/components/sold/leaderboard.css";
import type { Leaderboard, UmbrellaTier } from "@/lib/sold/types";

type Period = "today" | "month";

type LeaderboardViewProps = {
  board: Leaderboard;
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

function money(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Status plate date, e.g. "Tue, Nov 3" or "November 2026". */
function periodDateLabel(period: Period, todayIso: string): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  if (period === "today") {
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Scoreboard-style sales leaderboard (sold-form layout, CRM theme tokens).
 * The API ranks everyone by revenue (premiums), then sales, and picks the medals.
 */
export function LeaderboardView({ board, updatedAt, canSubmit, canList }: LeaderboardViewProps) {
  const [period, setPeriod] = useState<Period>("today");
  const { rows, totals } = board[period];
  const showStars = period === "today";

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

        <section className="panel" data-period={period}>
          <header className="panel-head">
            <div className="periods" role="group" aria-label="Period">
              <button
                type="button"
                data-period="today"
                aria-pressed={period === "today"}
                onClick={() => setPeriod("today")}
              >
                Today
              </button>
              <span className="divider" aria-hidden="true" />
              <button
                type="button"
                data-period="month"
                aria-pressed={period === "month"}
                onClick={() => setPeriod("month")}
              >
                This month
              </button>
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
              <span className="num" role="columnheader">
                Revenue
              </span>
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
            </div>
          </div>
        </section>

        <p className="status live" role="status">
          <span className="period-date">{periodDateLabel(period, board.date)}</span>
          <span>{`Updated ${updatedAt}`}</span>
        </p>
      </div>
    </div>
  );
}
