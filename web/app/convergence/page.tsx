"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Avatar from "@/components/Avatar";
import API_BASE from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Follow {
  tracker: string;
  at: string;
}

interface ConvergenceEntry {
  user_id: string;
  username: string;
  name: string;
  bio: string;
  followers_count: number | null;
  account_created_at: string | null;
  followed_by: Follow[];
  count: number;
  latest_follow: string;
}

type OutreachStatus = "reached_out" | "in_contact";
type Outreach = Record<string, OutreachStatus>;

const STATUSES: { value: OutreachStatus; label: string; next: OutreachStatus | null }[] = [
  { value: "reached_out", label: "Reached out", next: "in_contact" },
  { value: "in_contact",  label: "In contact",  next: null },
];

const AGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Any age", days: null },
  { label: "< 1 week", days: 7 },
  { label: "< 1 month", days: 30 },
  { label: "< 3 months", days: 90 },
  { label: "< 6 months", days: 180 },
  { label: "< 1 year", days: 365 },
];

const FOLLOWERS_OPTIONS: { label: string; max: number | null }[] = [
  { label: "Any count", max: null },
  { label: "< 100", max: 100 },
  { label: "< 500", max: 500 },
  { label: "< 1K", max: 1000 },
  { label: "< 5K", max: 5000 },
  { label: "< 10K", max: 10000 },
  { label: "< 50K", max: 50000 },
];

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function fmtFollowers(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <svg
        width="64"
        height="44"
        viewBox="0 0 64 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-5 text-muted-foreground/30"
      >
        <circle cx="22" cy="22" r="20" stroke="currentColor" strokeWidth="2" />
        <circle cx="42" cy="22" r="20" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="text-foreground font-medium mb-1.5">No convergence patterns detected yet</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Convergence appears when multiple tracked accounts follow the same person
      </p>
    </div>
  );
}

function ArchiveButton({ onArchive }: { onArchive: () => void }) {
  return (
    <button
      onClick={onArchive}
      className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      title="Move to Reviewed"
    >
      Archive
    </button>
  );
}

function OutreachButton({
  userId,
  status,
  onChange,
}: {
  userId: string;
  status: OutreachStatus | undefined;
  onChange: (userId: string, next: OutreachStatus | null) => void;
}) {
  const current = STATUSES.find((s) => s.value === status);

  if (!status) {
    return (
      <button
        onClick={() => onChange(userId, "reached_out")}
        className="text-xs text-muted-foreground border border-dashed border-border rounded-full px-3 py-1 hover:border-foreground/40 hover:text-foreground transition-colors"
      >
        + Mark contacted
      </button>
    );
  }

  const nextStatus = current?.next ?? null;
  const isInContact = status === "in_contact";

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(userId, nextStatus)}
        className={`text-xs rounded-full px-3 py-1 font-medium transition-colors ${
          isInContact
            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
            : "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
        }`}
      >
        {current?.label} {nextStatus ? "→" : "✓"}
      </button>
      <button
        onClick={() => onChange(userId, null)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs"
        title="Clear"
      >
        ✕
      </button>
    </div>
  );
}

export default function ConvergencePage() {
  const [entries, setEntries] = useState<ConvergenceEntry[]>([]);
  const [minCount, setMinCount] = useState("2");
  const [days, setDays] = useState("all");
  const [maxFollowers, setMaxFollowers] = useState<number | null>(null);
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(null);
  const [outreach, setOutreach] = useState<Outreach>({});
  const [archived, setArchived] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams({ min_count: minCount });
    if (days !== "all") params.set("days", days);
    fetch(`${API_BASE}/api/convergence?${params}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [minCount, days]);

  useEffect(() => {
    fetch(`${API_BASE}/api/outreach`)
      .then((r) => r.json())
      .then(setOutreach);
  }, []);

  const handleArchive = useCallback((userId: string) => {
    setArchived((prev) => new Set([...prev, userId]));
    fetch(`${API_BASE}/api/reviewed/${userId}`, { method: "PUT" });
  }, []);

  const handleOutreachChange = useCallback(
    (userId: string, next: OutreachStatus | null) => {
      setOutreach((prev) => {
        const updated = { ...prev };
        if (next === null) delete updated[userId];
        else updated[userId] = next;
        return updated;
      });
      fetch(`${API_BASE}/api/outreach/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    },
    []
  );

  const filtered = useMemo(() => {
    let result = entries.filter((e) => !archived.has(e.user_id));

    if (maxFollowers !== null) {
      result = result.filter(
        (e) => e.followers_count !== null && e.followers_count <= maxFollowers
      );
    }

    if (maxAgeDays !== null) {
      const cutoff = Date.now() - maxAgeDays * 86400000;
      result = result.filter(
        (e) =>
          e.account_created_at !== null &&
          e.account_created_at !== undefined &&
          new Date(e.account_created_at).getTime() >= cutoff
      );
    }

    return result;
  }, [entries, archived, maxFollowers, maxAgeDays]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Convergence</h1>
          <div className="relative group">
            <span className="text-muted-foreground/50 cursor-help text-sm select-none">ⓘ</span>
            <div className="absolute left-0 top-full mt-2 z-10 pointer-events-none hidden group-hover:block w-64 text-xs text-muted-foreground bg-popover border border-border rounded-md p-2.5 shadow-md leading-relaxed">
              Accounts followed by 2+ tracked VCs. More trackers = stronger signal. Useful for spotting founders early before they&apos;re widely known.
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <FilterGroup label="Account age">
            <Select
              value={maxAgeDays !== null ? String(maxAgeDays) : "all"}
              onValueChange={(v) => setMaxAgeDays(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.label} value={opt.days !== null ? String(opt.days) : "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>
          <FilterGroup label="Follower count">
            <Select
              value={maxFollowers !== null ? String(maxFollowers) : "all"}
              onValueChange={(v) => setMaxFollowers(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWERS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.label} value={opt.max !== null ? String(opt.max) : "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>
          <FilterGroup label="Time range">
            <Select value={days} onValueChange={(v) => v !== null && setDays(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="1">24h</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>
          <FilterGroup label="Min. trackers">
            <Select value={minCount} onValueChange={(v) => v !== null && setMinCount(v)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2+</SelectItem>
                <SelectItem value="3">3+</SelectItem>
                <SelectItem value="5">5+</SelectItem>
                <SelectItem value="10">10+</SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const followersStr = fmtFollowers(e.followers_count);
            const status = outreach[e.user_id];
            return (
              <div
                key={e.user_id}
                className={`bg-card rounded-lg border p-5 transition-opacity ${
                  status ? "opacity-60" : ""
                }`}
              >
                {/* Header: avatar + account info + outreach button */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <Avatar username={e.username} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://x.com/${e.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold hover:underline text-blue-500 hover:text-blue-400"
                        >
                          @{e.username}
                        </a>
                        <span className="text-sm text-muted-foreground">{e.name}</span>
                        {followersStr && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {followersStr} followers
                          </span>
                        )}
                      </div>
                      {e.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.bio}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{timeAgo(e.latest_follow)}</span>
                    <OutreachButton
                      userId={e.user_id}
                      status={status}
                      onChange={handleOutreachChange}
                    />
                    <ArchiveButton onArchive={() => handleArchive(e.user_id)} />
                  </div>
                </div>

                {/* Tracker row */}
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    Followed by{" "}
                    <span className="font-medium text-foreground">{e.count}</span> tracked accounts
                  </p>
                  <div className="flex flex-wrap gap-5">
                    {e.followed_by.map((f) => (
                      <a
                        key={f.tracker}
                        href={`https://x.com/${f.tracker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5 hover:opacity-75 transition-opacity"
                      >
                        <Avatar username={f.tracker} size={28} />
                        <span className="text-xs text-muted-foreground">@{f.tracker}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
