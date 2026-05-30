"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Avatar from "@/components/Avatar";
import API_BASE from "@/lib/api";

const PAGE_SIZE = 20;

interface FeedEntry {
  tracker: string;
  followed_id: string;
  followed_username: string;
  followed_name: string;
  followers_count: number | null;
  account_created_at: string | null;
  bio: string;
  detected_at: string;
}

interface TagsData {
  tags: string[];
  account_tags: Record<string, string[]>;
}

const AGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Any age", days: null },
  { label: "< 1 week", days: 7 },
  { label: "< 1 month", days: 30 },
  { label: "< 3 months", days: 90 },
  { label: "< 6 months", days: 180 },
  { label: "< 1 year", days: 365 },
];

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

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function FeedPage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [trackers, setTrackers] = useState<string[]>([]);
  const [tagsData, setTagsData] = useState<TagsData>({ tags: [], account_tags: {} });
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts`)
      .then((r) => r.json())
      .then((accounts: { username: string }[]) => {
        setTrackers(accounts.map((a) => a.username));
      });
    fetch(`${API_BASE}/api/tags`)
      .then((r) => r.json())
      .then(setTagsData);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [selectedTags, selectedAccounts, maxAgeDays]);

  useEffect(() => {
    // Compute effective trackers: accounts matching any selected tag UNION individually selected accounts
    const taggedTrackers = new Set<string>();
    selectedTags.forEach((tag) => {
      (tagsData.account_tags[tag] ? [] : []).forEach((u: string) => taggedTrackers.add(u));
      // account_tags is keyed by username, not tag — look it up correctly
      trackers.forEach((u) => {
        if ((tagsData.account_tags[u] ?? []).includes(tag)) taggedTrackers.add(u);
      });
    });

    const effectiveTrackers = new Set([...taggedTrackers, ...selectedAccounts]);
    const isFiltered = selectedTags.size > 0 || selectedAccounts.size > 0;

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });

    if (isFiltered) {
      effectiveTrackers.forEach((t) => params.append("tracker", t));
    }

    if (maxAgeDays !== null) {
      params.set("max_account_age_days", String(maxAgeDays));
    }

    fetch(`${API_BASE}/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.items);
        setTotal(data.total);
      });
  }, [selectedTags, selectedAccounts, maxAgeDays, page, trackers, tagsData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isFiltered = selectedTags.size > 0 || selectedAccounts.size > 0;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function toggleAccount(username: string) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 space-y-6">
        {tagsData.tags.length > 0 && (
          <SidebarSection title="Tags">
            <div className="space-y-1">
              {tagsData.tags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 py-1 cursor-pointer group"
                >
                  <Checkbox
                    checked={selectedTags.has(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                  />
                  <span className={`text-sm transition-colors ${selectedTags.has(tag) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                    {tag}
                  </span>
                </label>
              ))}
            </div>
          </SidebarSection>
        )}

        {trackers.length > 0 && (
          <SidebarSection title="Accounts">
            <div className="space-y-1">
              {trackers.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-2 py-1 cursor-pointer group"
                >
                  <Checkbox
                    checked={selectedAccounts.has(t)}
                    onCheckedChange={() => toggleAccount(t)}
                  />
                  <Avatar username={t} size={18} />
                  <span className={`text-sm truncate transition-colors ${selectedAccounts.has(t) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                    @{t}
                  </span>
                </label>
              ))}
            </div>
            {isFiltered && (
              <button
                onClick={() => { setSelectedTags(new Set()); setSelectedAccounts(new Set()); }}
                className="text-xs text-blue-500 hover:text-blue-400 mt-2 transition-colors"
              >
                Clear filters
              </button>
            )}
          </SidebarSection>
        )}

        <SidebarSection title="Account age">
          <select
            value={maxAgeDays ?? ""}
            onChange={(e) => setMaxAgeDays(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-card text-foreground"
          >
            {AGE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.days ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </SidebarSection>
      </aside>

      {/* Feed */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Feed</h1>

        {total === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isFiltered
              ? "No results match the current filters."
              : "No follows detected yet. Data accumulates as the tracker runs."}
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
    </div>
  );
}
