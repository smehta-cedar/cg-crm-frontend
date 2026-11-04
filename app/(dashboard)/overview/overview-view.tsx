"use client";

import Link from "next/link";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { GHOST_BUTTON_CLASS } from "@/components/classes";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/task-options";

/*
 * View-only Overview: four snapshot panels with frontend mock data.
 * Panels are draggable; order is kept in localStorage (no backend).
 */

type PanelId = "leaderboard" | "tasks" | "pending" | "tracker";

const DEFAULT_ORDER: PanelId[] = ["leaderboard", "tasks", "pending", "tracker"];
const STORAGE_KEY = "cg-crm.overview.layout";

const LEADERBOARD = [
  { rank: 1, name: "Maya Chen", sales: 7, revenue: 4200, place: "gold" as const },
  { rank: 2, name: "Jordan Blake", sales: 5, revenue: 3100, place: "silver" as const },
  { rank: 3, name: "Sam Rivera", sales: 4, revenue: 2450, place: "bronze" as const },
  { rank: 4, name: "Alex Kim", sales: 3, revenue: 1800, place: null },
  { rank: 5, name: "Chris Patel", sales: 2, revenue: 950, place: null },
];

const TASKS: { id: string; title: string; priority: TaskPriority; due: string }[] = [
  { id: "1", title: "Follow up on Aetna contracting", priority: "high", due: "Today" },
  { id: "2", title: "Send UHC welcome packet", priority: "high", due: "Tomorrow" },
  { id: "3", title: "Review state license renewals", priority: "general", due: "Fri" },
  { id: "4", title: "Prep Q4 training deck", priority: "future", due: "Nov 20" },
];

const PENDING = [
  { id: "1", name: "Taylor Brooks", detail: "Agent · contracting", status: "pending" as const },
  { id: "2", name: "Humana — FL", detail: "Carrier · applied", status: "applied" as const },
  { id: "3", name: "Portal · Mutual of Omaha", detail: "Password · awaiting", status: "pending" as const },
  { id: "4", name: "Riley Nguyen", detail: "Agent · onboarding", status: "onboarding" as const },
];

const TRACKER_TEAM = { answered: 48, booked: 14, liveTransfer: 6, bookingRate: 29.2 };

const TRACKER_BOARD = [
  { name: "Dana Lee", booked: 5, liveTransfer: 2, bookingRate: 35.7, isMe: false },
  { name: "You", booked: 4, liveTransfer: 1, bookingRate: 28.6, isMe: true },
  { name: "Morgan Ellis", booked: 3, liveTransfer: 2, bookingRate: 25.0, isMe: false },
  { name: "Casey Holt", booked: 2, liveTransfer: 1, bookingRate: 22.2, isMe: false },
];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const rate = (n: number) => `${n.toFixed(1)}%`;

const PRIORITY_PILL: Record<TaskPriority, string> = {
  high: "bg-danger-soft text-danger-ink",
  general: "bg-brand-soft text-brand-ink",
  future: "bg-stat-amber-soft text-stat-amber-ink",
};

const MEDAL: Record<"gold" | "silver" | "bronze", string> = {
  gold: "bg-[#ffcb3d]/30 text-[#8a6a00]",
  silver: "bg-[#c5ced8]/40 text-[#4b5563]",
  bronze: "bg-[#e38b4d]/25 text-[#8a4b1a]",
};

const PANEL_ACCENT: Record<PanelId, string> = {
  leaderboard: "border-t-stat-blue-ink",
  tasks: "border-t-brand-strong",
  pending: "border-t-stat-amber-ink",
  tracker: "border-t-stat-indigo-ink",
};

const PANEL_DOT: Record<PanelId, string> = {
  leaderboard: "bg-stat-blue-ink",
  tasks: "bg-brand-strong",
  pending: "bg-stat-amber-ink",
  tracker: "bg-stat-indigo-ink",
};

function isPanelOrder(value: unknown): value is PanelId[] {
  if (!Array.isArray(value) || value.length !== DEFAULT_ORDER.length) return false;
  const set = new Set(value);
  return DEFAULT_ORDER.every((id) => set.has(id));
}

function readOrder(): PanelId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed: unknown = JSON.parse(raw);
    return isPanelOrder(parsed) ? parsed : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
}

function DragHandle() {
  return (
    <span
      className="inline-flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-hover hover:text-fg"
      aria-hidden
      title="Drag to rearrange"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
        <circle cx="5" cy="4" r="1.25" />
        <circle cx="11" cy="4" r="1.25" />
        <circle cx="5" cy="8" r="1.25" />
        <circle cx="11" cy="8" r="1.25" />
        <circle cx="5" cy="12" r="1.25" />
        <circle cx="11" cy="12" r="1.25" />
      </svg>
    </span>
  );
}

function PanelShell({
  id,
  title,
  subtitle,
  href,
  badge,
  dragging,
  over,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  id: PanelId;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  dragging: PanelId | null;
  over: PanelId | null;
  onDragStart: (event: DragEvent, id: PanelId) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent, id: PanelId) => void;
  onDragLeave: (event: DragEvent, id: PanelId) => void;
  onDrop: (event: DragEvent, id: PanelId) => void;
  children: ReactNode;
}) {
  const isDragging = dragging === id;
  const isOver = over === id && dragging !== null && dragging !== id;

  return (
    <section
      draggable
      onDragStart={(event) => onDragStart(event, id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, id)}
      onDragLeave={(event) => onDragLeave(event, id)}
      onDrop={(event) => onDrop(event, id)}
      aria-grabbed={isDragging}
      className={`group flex min-h-[22rem] cursor-grab flex-col rounded-xl border border-t-4 glass p-5 shadow-sm transition duration-150 active:cursor-grabbing ${PANEL_ACCENT[id]} ${
        isDragging ? "scale-[0.98] opacity-50 ring-2 ring-brand-strong/30" : ""
      } ${isOver ? "ring-2 ring-brand-strong/50 brightness-[1.02]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 opacity-70 transition group-hover:opacity-100">
            <DragHandle />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`size-1.5 rounded-full ${PANEL_DOT[id]}`} aria-hidden />
              <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
              {badge ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-fg-muted">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>
          </div>
        </div>
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          draggable={false}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-brand-ink hover:bg-brand-soft"
        >
          Open
        </Link>
      </div>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

function LeaderboardBody() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-fg-subtle">
          <th className="pb-2 pr-2 font-medium">#</th>
          <th className="pb-2 pr-2 font-medium">Agent</th>
          <th className="pb-2 pr-2 text-right font-medium">Sales</th>
          <th className="pb-2 text-right font-medium">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {LEADERBOARD.map((row) => (
          <tr key={row.rank} className="border-b border-line/80 last:border-0">
            <td className="py-2.5 pr-2">
              {row.place ? (
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${MEDAL[row.place]}`}
                >
                  {row.rank}
                </span>
              ) : (
                <span className="pl-1.5 tabular-nums text-fg-subtle">{row.rank}</span>
              )}
            </td>
            <td className="py-2.5 pr-2 font-medium text-fg">{row.name}</td>
            <td className="py-2.5 pr-2 text-right tabular-nums text-fg">{row.sales}</td>
            <td className="py-2.5 text-right tabular-nums font-medium text-fg">{money(row.revenue)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-line">
          <td colSpan={3} className="pt-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            Team total
          </td>
          <td className="pt-3 text-right text-sm font-semibold tabular-nums text-fg">
            {money(LEADERBOARD.reduce((sum, row) => sum + row.revenue, 0))}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function TasksBody() {
  const openByPriority = TASKS.reduce(
    (acc, task) => {
      acc[task.priority] += 1;
      return acc;
    },
    { high: 0, general: 0, future: 0 } as Record<TaskPriority, number>,
  );

  return (
    <>
      <dl className="mb-4 grid grid-cols-3 gap-2">
        {(Object.keys(openByPriority) as TaskPriority[]).map((priority) => (
          <div
            key={priority}
            className="rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5 text-center"
          >
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-subtle">
              {TASK_PRIORITY_LABELS[priority]}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-fg">{openByPriority[priority]}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-2">
        {TASKS.map((task) => (
          <li
            key={task.id}
            className={`flex items-center justify-between gap-3 rounded-lg border border-l-4 border-line bg-surface/40 px-3 py-2.5 ${
              task.priority === "high"
                ? "border-l-danger-strong"
                : task.priority === "general"
                  ? "border-l-brand-strong"
                  : "border-l-stat-amber-ink"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{task.title}</p>
              <p className="mt-0.5 text-xs text-fg-muted">Due {task.due}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_PILL[task.priority]}`}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function PendingBody() {
  return (
    <ul className="space-y-2">
      {PENDING.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface/40 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{row.name}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{row.detail}</p>
          </div>
          <StatusBadge status={row.status} />
        </li>
      ))}
    </ul>
  );
}

function TrackerBody() {
  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Answered", value: String(TRACKER_TEAM.answered), tone: "bg-stat-blue-soft text-stat-blue-ink" },
          { label: "Booked", value: String(TRACKER_TEAM.booked), tone: "bg-stat-green-soft text-stat-green-ink" },
          { label: "Transfers", value: String(TRACKER_TEAM.liveTransfer), tone: "bg-stat-indigo-soft text-stat-indigo-ink" },
          { label: "Rate", value: rate(TRACKER_TEAM.bookingRate), tone: "bg-stat-amber-soft text-stat-amber-ink" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg px-3 py-2.5 ${stat.tone}`}>
            <dt className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-80">{stat.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <table className="w-full text-sm">
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
          {TRACKER_BOARD.map((row, index) => (
            <tr
              key={row.name}
              className={`border-b border-line/80 last:border-0 ${row.isMe ? "bg-brand-soft/60" : ""}`}
            >
              <td className="py-2.5 pr-2 tabular-nums text-fg-subtle">{index + 1}</td>
              <td className="py-2.5 pr-2 font-medium text-fg">
                {row.name}
                {row.isMe ? <span className="ml-1.5 text-xs font-normal text-brand-ink">you</span> : null}
              </td>
              <td className="py-2.5 pr-2 text-right tabular-nums text-fg">{row.booked}</td>
              <td className="py-2.5 pr-2 text-right tabular-nums text-fg-muted">{row.liveTransfer}</td>
              <td className="py-2.5 text-right tabular-nums text-fg-muted">{rate(row.bookingRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const PANEL_META: Record<
  PanelId,
  { title: string; subtitle: string; href: string; badge: string; body: () => ReactNode }
> = {
  leaderboard: {
    title: "SOLD!!! Leaderboard",
    subtitle: "Today · ranked by revenue",
    href: "/sold/leaderboard",
    badge: `${LEADERBOARD.length} agents`,
    body: LeaderboardBody,
  },
  tasks: {
    title: "Tasks",
    subtitle: "Open items by priority",
    href: "/tasks",
    badge: `${TASKS.length} open`,
    body: TasksBody,
  },
  pending: {
    title: "Pending",
    subtitle: "Waiting on action",
    href: "/pending",
    badge: `${PENDING.length} items`,
    body: PendingBody,
  },
  tracker: {
    title: "Tracker scoreboard",
    subtitle: "Today · ranked by bookings",
    href: "/tracker",
    badge: `${TRACKER_BOARD.length} setters`,
    body: TrackerBody,
  },
};

/** Snapshot dashboard for Overview — mock data, draggable layout. */
export function OverviewView() {
  const [order, setOrder] = useState<PanelId[]>(DEFAULT_ORDER);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState<PanelId | null>(null);
  const [over, setOver] = useState<PanelId | null>(null);

  useEffect(() => {
    setOrder(readOrder());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order, ready]);

  const move = (from: PanelId, to: PanelId) => {
    if (from === to) return;
    setOrder((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(from);
      const toIndex = next.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return current;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from);
      return next;
    });
  };

  const onDragStart = (event: DragEvent, id: PanelId) => {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragging(id);
  };

  const onDragEnd = () => {
    setDragging(null);
    setOver(null);
  };

  const onDragOver = (event: DragEvent, id: PanelId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragging && dragging !== id) setOver(id);
  };

  const onDragLeave = (event: DragEvent, id: PanelId) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && over === id) {
      setOver(null);
    }
  };

  const onDrop = (event: DragEvent, id: PanelId) => {
    event.preventDefault();
    const from = (event.dataTransfer.getData("text/plain") || dragging) as PanelId | "";
    if (from && DEFAULT_ORDER.includes(from as PanelId)) move(from as PanelId, id);
    setDragging(null);
    setOver(null);
  };

  const resetLayout = () => {
    setOrder(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  };

  const totalRevenue = LEADERBOARD.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <>
      <PageHeader
        description="Drag any card to rearrange your layout. Demo data — not live."
        actions={
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={resetLayout}>
            Reset layout
          </button>
        }
      />

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sales revenue", value: money(totalRevenue), hint: "Today", bar: "bg-stat-blue-ink" },
          { label: "Open tasks", value: String(TASKS.length), hint: "Across priorities", bar: "bg-brand-strong" },
          { label: "Pending", value: String(PENDING.length), hint: "Needs attention", bar: "bg-stat-amber-ink" },
          {
            label: "Booking rate",
            value: rate(TRACKER_TEAM.bookingRate),
            hint: "Team today",
            bar: "bg-stat-indigo-ink",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border glass p-4 shadow-sm">
            <div className={`mb-3 h-1 w-8 rounded-full ${stat.bar}`} aria-hidden />
            <dt className="text-sm text-fg-muted">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">{stat.value}</dd>
            <p className="mt-1 text-xs text-fg-subtle">{stat.hint}</p>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 xl:grid-cols-2">
        {order.map((id) => {
          const meta = PANEL_META[id];
          const Body = meta.body;
          return (
            <PanelShell
              key={id}
              id={id}
              title={meta.title}
              subtitle={meta.subtitle}
              href={meta.href}
              badge={meta.badge}
              dragging={dragging}
              over={over}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <Body />
            </PanelShell>
          );
        })}
      </div>
    </>
  );
}
