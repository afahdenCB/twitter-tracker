"use client";

import { useEffect, useState, useCallback } from "react";
import Avatar from "@/components/Avatar";
import API_BASE from "@/lib/api";

interface ReviewedEntry {
  user_id: string;
  username: string;
  name: string;
  bio: string;
  followers_count: number | null;
}

type OutreachStatus = "reached_out" | "in_contact";
type Outreach = Record<string, OutreachStatus>;

function fmtFollowers(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const OUTREACH_LABELS: Record<OutreachStatus, { label: string; className: string }> = {
  reached_out: { label: "Reached out", className: "bg-yellow-500/15 text-yellow-400" },
  in_contact:  { label: "In contact",  className: "bg-green-500/15 text-green-400" },
};

export default function ReviewedPage() {
  const [entries, setEntries] = useState<ReviewedEntry[]>([]);
  const [outreach, setOutreach] = useState<Outreach>({});
  const [restored, setRestored] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/api/reviewed/entries`)
      .then((r) => r.json())
      .then(setEntries);
    fetch(`${API_BASE}/api/outreach`)
      .then((r) => r.json())
      .then(setOutreach);
  }, []);

  const handleRestore = useCallback((userId: string) => {
    setRestored((prev) => new Set([...prev, userId]));
    fetch(`${API_BASE}/api/reviewed/${userId}`, { method: "DELETE" });
  }, []);

  const visible = entries.filter((e) => !restored.has(e.user_id));

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reviewed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Archived from feed and convergence
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{visible.length} entries</span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-foreground font-medium mb-1.5">No reviewed entries yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Archive entries from the Feed or Convergence pages to track who you've already evaluated
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => {
            const followersStr = fmtFollowers(e.followers_count);
            const outreachStatus = outreach[e.user_id];
            const outreachMeta = outreachStatus ? OUTREACH_LABELS[outreachStatus] : null;
            return (
              <div
                key={e.user_id}
                className="bg-card rounded-lg p-4 flex items-start justify-between gap-4"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Avatar username={e.username} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://x.com/${e.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline text-blue-500 hover:text-blue-400"
                      >
                        @{e.username}
                      </a>
                      <span className="text-sm text-muted-foreground">{e.name}</span>
                      {followersStr && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded text-muted-foreground"
                          style={{ background: "rgba(255,255,255,0.07)" }}
                        >
                          {followersStr} followers
                        </span>
                      )}
                      {outreachMeta && (
                        <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${outreachMeta.className}`}>
                          {outreachMeta.label}
                        </span>
                      )}
                    </div>
                    {e.bio && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.bio}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(e.user_id)}
                  className="text-xs text-muted-foreground/50 hover:text-blue-400 transition-colors shrink-0"
                  title="Restore to feed"
                >
                  Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
