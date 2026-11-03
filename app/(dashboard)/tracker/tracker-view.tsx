"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { longDateLabel } from "@/lib/calendar";
import type { ClickType, TrackerBoard } from "@/lib/tracker";
import { logClick, refreshBoard } from "./actions";

/** How often the board is fetched again, so other setters' taps show up. */
const REFRESH_MS = 30_000;

/** The API's booking rate (a percent, or null before anything is answered) as shown. */
const formatRate = (rate: number | null) => (rate === null ? "—" : `${rate.toFixed(1)}%`);

function StatCard({
  label,
  value,
  hint,
  bar,
}: {
  label: string;
  value: string;
  hint?: string;
  bar: "blue" | "amber" | "green" | "indigo";
}) {
  const bars = {
    blue: "bg-stat-blue-ink",
    amber: "bg-stat-amber-ink",
    green: "bg-stat-green-ink",
    indigo: "bg-stat-indigo-ink",
  };
  return (
    <div className="rounded-lg border glass p-4 shadow-sm">
      <div className={`mb-3 h-1 w-8 rounded-full ${bars[bar]}`} aria-hidden />
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-fg">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function ClickButton({
  label,
  sub,
  onClick,
  tone,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  tone: "answered" | "booked" | "transfer";
}) {
  const tones = {
    answered:
      "border-stat-blue-ink/20 bg-stat-blue-soft text-stat-blue-ink hover:brightness-[0.97] active:scale-[0.98]",
    booked:
      "border-stat-green-ink/20 bg-stat-green-soft text-stat-green-ink hover:brightness-[0.97] active:scale-[0.98]",
    transfer:
      "border-stat-indigo-ink/20 bg-stat-indigo-soft text-stat-indigo-ink hover:brightness-[0.97] active:scale-[0.98]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-28 flex-col items-start justify-between rounded-xl border px-5 py-4 text-left shadow-sm transition ${tones[tone]}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{sub}</span>
      <span className="text-xl font-semibold tracking-tight">{label}</span>
      <span className="text-xs opacity-60 group-hover:opacity-90">Tap to +1</span>
    </button>
  );
}

/**
 * Click panel. Every tap is saved by the API, which answers with today's
 * board; this only shows it. A setter sees their own numbers and the
 * buttons, anyone else the team's. The board is fetched again every 30
 * seconds while the tab is open in front.
 */
export function TrackerView({ board: initialBoard, name }: { board: TrackerBoard; name: string }) {
  const [board, setBoard] = useState(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const counts = board.me ?? board.team;

  useEffect(() => {
    // Server actions run one at a time, so a refresh never lands out of order with a tap.
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const latest = await refreshBoard();
      if (latest) setBoard(latest);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const click = async (type: ClickType) => {
    const result = await logClick(type);
    if (result.ok) {
      setBoard(result.board);
      setError(null);
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <PageHeader title="Click Tracker" description={<>Tap what happened on the call.</>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <section className="rounded-xl border glass p-5 shadow-sm">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-subtle">
              Today
            </p>
            <p className="mt-0.5 text-base font-semibold text-fg">{longDateLabel(board.date)}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {board.canClick ? (
                <>
                  Logging as <span className="font-medium text-fg">{name}</span>
                </>
              ) : (
                "Team totals"
              )}
            </p>
          </div>

          {board.canClick ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ClickButton
                label="Answered"
                sub="Conversation"
                tone="answered"
                onClick={() => click("answered")}
              />
              <ClickButton
                label="Booked"
                sub="Appointment set"
                tone="booked"
                onClick={() => click("booked")}
              />
              <ClickButton
                label="Live Transfer"
                sub="Handed to agent"
                tone="transfer"
                onClick={() => click("liveTransfer")}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Answered" value={String(counts.answered)} bar="blue" />
            <StatCard label="Booked" value={String(counts.booked)} bar="green" />
            <StatCard
              label="Booking rate"
              value={formatRate(counts.bookingRate)}
              hint="Booked ÷ Answered"
              bar="amber"
            />
            <StatCard label="Live transfers" value={String(counts.liveTransfer)} bar="indigo" />
          </dl>
        </section>

        <aside className="rounded-xl border glass p-5 shadow-sm">
          <h2 className="text-base font-semibold text-fg">Today&apos;s leaderboard</h2>
          <p className="mt-1 text-sm text-fg-muted">By bookings</p>

          {board.leaderboard.length ? (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-subtle">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Setter</th>
                  <th className="pb-2 pr-2 text-right font-medium">Booked</th>
                  <th className="pb-2 pr-2 text-right font-medium">LT</th>
                  <th className="pb-2 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {board.leaderboard.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b border-line last:border-0 ${row.isMe ? "bg-brand-soft/60" : ""}`}
                  >
                    <td className="py-2.5 pr-2 tabular-nums text-fg-subtle">{index + 1}</td>
                    <td className="py-2.5 pr-2 font-medium text-fg">
                      {row.name}
                      {row.isMe ? (
                        <span className="ml-1.5 text-xs font-normal text-brand-ink">you</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-fg">{row.booked}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-fg-muted">
                      {row.liveTransfer}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-fg-muted">
                      {formatRate(row.bookingRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-fg-subtle">No one holds the SDR role yet.</p>
          )}
        </aside>
      </div>
    </>
  );
}
