"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FeedPage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [tracker, setTracker] = useState("all");
  const [trackers, setTrackers] = useState<string[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/accounts")
      .then((r) => r.json())
      .then((accounts: { username: string }[]) =>
        setTrackers(accounts.map((a) => a.username))
      );
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "200" });
    if (tracker !== "all") params.set("tracker", tracker);
    fetch(`http://localhost:8000/api/feed?${params}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [tracker]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Feed</h1>
        <Select value={tracker} onValueChange={setTracker}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {trackers.map((t) => (
              <SelectItem key={t} value={t}>
                @{t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No follows detected yet. Data accumulates as the tracker runs.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="bg-card rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs shrink-0">
                      @{e.tracker}
                    </Badge>
                    <span className="text-sm text-muted-foreground">followed</span>
                    <a
                      href={`https://x.com/${e.followed_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline text-foreground"
                    >
                      @{e.followed_username}
                    </a>
                    <span className="text-sm text-muted-foreground">{e.followed_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {fmtFollowers(e.followers_count)} followers
                    </span>
                    {e.bio && (
                      <span className="text-xs text-muted-foreground truncate">{e.bio}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(e.detected_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
