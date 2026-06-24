"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Avatar from "@/components/Avatar";
import API_BASE from "@/lib/api";

type OutreachStatus = "reached_out" | "in_contact";
type Outreach = Record<string, OutreachStatus>;

const STATUSES: { value: OutreachStatus; label: string; next: OutreachStatus | null }[] = [
  { value: "reached_out", label: "Reached out", next: "in_contact" },
  { value: "in_contact",  label: "In contact",  next: null },
];

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

const FOLLOWERS_OPTIONS: { label: string; max: number | null }[] = [
  { label: "Any count", max: null },
  { label: "< 100", max: 100 },
  { label: "< 500", max: 500 },
  { label: "< 1K", max: 1000 },
  { label: "< 5K", max: 5000 },
  { label: "< 10K", max: 10000 },
  { label: "< 50K", max: 50000 },
];

function fmtAge(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years && months) return `${years}y ${months}mo old`;
  if (years) return `${years}y old`;
  if (months) return `${months}mo old`;
  return `${days}d old`;
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
  const [maxFollowers, setMaxFollowers] = useState<number | null>(null);
  const [bioKeyword, setBioKeyword] = useState("");
  const [debouncedBioKeyword, setDebouncedBioKeyword] = useState("");
  const [outreach, setOutreach] = useState<Outreach>({});
  const [archived, setArchived] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts`)
      .then((r) => r.json())
      .then((accounts: { username: string }[]) => {
        setTrackers(accounts.map((a) => a.username));
      });
    fetch(`${API_BASE}/api/tags`)
      .then((r) => r.json())
      .then(setTagsData);
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBioKeyword(bioKeyword), 300);
    return () => clearTimeout(timer);
  }, [bioKeyword]);

  useEffect(() => {
    setPage(0);
  }, [selectedTags, selectedAccounts, maxAgeDays, maxFollowers, debouncedBioKeyword]);

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
      exclude_reviewed: "true",
    });

    if (isFiltered) {
      effectiveTrackers.forEach((t) => params.append("tracker", t));
    }

    if (maxAgeDays !== null) {
      params.set("max_account_age_days", String(maxAgeDays));
    }

    if (maxFollowers !== null) {
      params.set("max_followers", String(maxFollowers));
    }

    if (debouncedBioKeyword.trim()) {
      params.set("bio_contains", debouncedBioKeyword.trim());
    }

    fetch(`${API_BASE}/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.items);
        setTotal(data.total);
      });
  }, [selectedTags, selectedAccounts, maxAgeDays, maxFollowers, debouncedBioKeyword, page, trackers, tagsData]);

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

        <SidebarSection title="Follower count">
          <select
            value={maxFollowers ?? ""}
            onChange={(e) => setMaxFollowers(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-card text-foreground"
          >
            {FOLLOWERS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.max ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </SidebarSection>
      </aside>

      {/* Feed */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Feed</h1>
          <input
            type="text"
            placeholder="Filter by bio keyword..."
            value={bioKeyword}
            onChange={(e) => setBioKeyword(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5 bg-card text-foreground placeholder:text-muted-foreground w-56"
          />
        </div>

        {total === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isFiltered
              ? "No results match the current filters."
              : "No follows detected yet. Data accumulates as the tracker runs."}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {entries.filter((e) => !archived.has(e.followed_id)).map((e, i) => {
                const { text: tsText, className: tsClass } = timestampMeta(e.detected_at);
                const outreachStatus = outreach[e.followed_id];
                return (
                  <div
                    key={i}
                    className={`bg-card rounded-lg p-4 transition-opacity ${outreachStatus ? "opacity-60" : ""}`}
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar username={e.followed_username} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`https://x.com/${e.tracker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0 hover:opacity-80 transition-opacity"
                              style={{
                                background: "rgba(59,130,246,0.15)",
                                border: "1px solid rgba(59,130,246,0.4)",
                                color: "rgb(147,197,253)",
                              }}
                            >
                              @{e.tracker}
                            </a>
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
                            {fmtAge(e.account_created_at) && (
                              <span
                                className="text-xs shrink-0 px-1.5 py-0.5 rounded text-muted-foreground"
                                style={{ background: "rgba(255,255,255,0.07)" }}
                              >
                                {fmtAge(e.account_created_at)}
                              </span>
                            )}
                            {e.bio && (
                              <span className="text-xs text-muted-foreground truncate">{e.bio}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs ${tsClass}`}>{tsText}</span>
                        <OutreachButton
                          userId={e.followed_id}
                          status={outreachStatus}
                          onChange={handleOutreachChange}
                        />
                        <ArchiveButton onArchive={() => handleArchive(e.followed_id)} />
                      </div>
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
