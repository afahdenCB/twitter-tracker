"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Avatar from "@/components/Avatar";

const PAGE_SIZE = 20;

interface FeedEntry {
  tracker: string;
  followed_id: string;
  followed_username: string;
  followed_name: string;
  followers_count: number | null;
  bio: string;
  detected_at: string;
}

function fmtFollowers(n: number | null) {
  if (n === null) return "?";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timestampMeta(iso: string): { text: string; className: string } {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const text =
    mins < 60 ? `${mins}m ago` :
    mins < 1440 ? `${Math.floor(mins / 60)}h ago` :
    `${Math.floor(mins / 1440)}d ago`;
  const className =
    mins < 60 ? "text-blue-400 font-medium" :
    mins < 360 ? "text-foreground/50" :
    "text-muted-foreground";
  return { text, className };
}

interface FilterDropdownProps {
  trackers: string[];
  selected: Set<string>;
  onToggle: (t: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

function FilterDropdown({ trackers, selected, onToggle, onSelectAll, onSelectNone }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const allSelected = selected.size === trackers.length;
  const label = allSelected
    ? "All accounts"
    : selected.size === 0
    ? "No accounts"
    : `${selected.size} / ${trackers.length} accounts`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors text-foreground"
      >
        {!allSelected && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"
            aria-hidden
          />
        )}
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border rounded-lg shadow-xl py-1 z-20 overflow-y-auto max-h-80">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b">
            <button
              onClick={onSelectAll}
              className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
            >
              All
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={onSelectNone}
              className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
            >
              None
            </button>
          </div>
          <div className="py-1">
            {trackers.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.has(t)}
                  onCheckedChange={() => onToggle(t)}
                />
                <Avatar username={t} size={20} />
                <span className={`text-sm truncate transition-colors ${selected.has(t) ? "text-foreground" : "text-muted-foreground"}`}>
                  @{t}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [trackers, setTrackers] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("http://localhost:8000/api/accounts")
      .then((r) => r.json())
      .then((accounts: { username: string }[]) => {
        const names = accounts.map((a) => a.username);
        setTrackers(names);
        setSelected(new Set(names));
      });
  }, []);

  useEffect(() => {
    setPage(0);
  }, [selected]);

  useEffect(() => {
    const allSelected = selected.size === trackers.length || selected.size === 0;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (!allSelected) {
      selected.forEach((t) => params.append("tracker", t));
    }
    fetch(`http://localhost:8000/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.items);
        setTotal(data.total);
      });
  }, [selected, page, trackers.length]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function toggleTracker(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  return (
    <div>
      {/* Feed header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Feed</h1>
        {trackers.length > 0 && (
          <FilterDropdown
            trackers={trackers}
            selected={selected}
            onToggle={toggleTracker}
            onSelectAll={() => setSelected(new Set(trackers))}
            onSelectNone={() => setSelected(new Set())}
          />
        )}
      </div>

      {selected.size === 0 ? (
        <p className="text-muted-foreground text-sm">Select at least one account to view the feed.</p>
      ) : total === 0 ? (
        <p className="text-muted-foreground text-sm">
          No follows detected yet. Data accumulates as the tracker runs.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((e, i) => {
              const { text: tsText, className: tsClass } = timestampMeta(e.detected_at);
              return (
                <div
                  key={i}
                  className="bg-card rounded-lg p-4"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar username={e.followed_username} size={40} />
                      <div className="flex-1 min-w-0">
                        {/* Line 1: tracker → followed → @username → display name */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                            style={{
                              background: "rgba(59,130,246,0.15)",
                              border: "1px solid rgba(59,130,246,0.4)",
                              color: "rgb(147,197,253)",
                            }}
                          >
                            @{e.tracker}
                          </span>
                          <span className="text-sm text-muted-foreground">followed</span>
                          <a
                            href={`https://x.com/${e.followed_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline text-blue-500 hover:text-blue-400"
                          >
                            @{e.followed_username}
                          </a>
                          <span className="text-sm text-muted-foreground">{e.followed_name}</span>
                        </div>
                        {/* Line 2: follower count pill + bio (single line) */}
                        <div className="flex items-center gap-2 mt-1.5 min-w-0">
                          <span
                            className="text-xs shrink-0 px-1.5 py-0.5 rounded text-muted-foreground"
                            style={{ background: "rgba(255,255,255,0.07)" }}
                          >
                            {fmtFollowers(e.followers_count)} followers
                          </span>
                          {e.bio && (
                            <span className="text-xs text-muted-foreground truncate">{e.bio}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs shrink-0 mt-0.5 ${tsClass}`}>{tsText}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
