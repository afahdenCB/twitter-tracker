"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
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
  followed_by: Follow[];
  count: number;
  latest_follow: string;
}

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

export default function ConvergencePage() {
  const [entries, setEntries] = useState<ConvergenceEntry[]>([]);
  const [minCount, setMinCount] = useState("2");
  const [days, setDays] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams({ min_count: minCount });
    if (days !== "all") params.set("days", days);
    fetch(`http://localhost:8000/api/convergence?${params}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [minCount, days]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Convergence</h1>
        <div className="flex gap-4">
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

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const followersStr = fmtFollowers(e.followers_count);
            return (
              <div key={e.user_id} className="bg-card rounded-lg border p-5">
                {/* Header: avatar + account info + timestamp */}
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
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {timeAgo(e.latest_follow)}
                  </span>
                </div>

                {/* Tracker row */}
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    Followed by{" "}
                    <span className="font-medium text-foreground">{e.count}</span> tracked accounts
                  </p>
                  <div className="flex flex-wrap gap-5">
                    {e.followed_by.map((f) => (
                      <div key={f.tracker} className="flex flex-col items-center gap-1.5">
                        <Avatar username={f.tracker} size={28} />
                        <span className="text-xs text-muted-foreground">@{f.tracker}</span>
                      </div>
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
