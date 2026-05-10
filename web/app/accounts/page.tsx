"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avatar from "@/components/Avatar";
import API_BASE from "@/lib/api";

interface Account {
  username: string;
  following_count: number | null;
  baselined: boolean;
  last_checked: string | null;
  last_new_follow: string | null;
}

interface Status {
  next_cycle_eta_minutes: number | null;
  poll_interval_minutes: number;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addedUser, setAddedUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmUsername, setConfirmUsername] = useState<string | null>(null);

  function fetchAccounts() {
    fetch("${API_BASE}/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }

  function fetchStatus() {
    fetch("${API_BASE}/api/status")
      .then((r) => r.json())
      .then(setStatus);
  }

  useEffect(() => {
    fetchAccounts();
    fetchStatus();
  }, []);

  async function handleAdd() {
    const username = input.trim().replace(/^@/, "");
    if (!username) return;
    setAdding(true);
    setError(null);
    setAddedUser(null);
    try {
      const r = await fetch("${API_BASE}/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (r.status === 409) { setError(`@${username} is already being tracked.`); return; }
      if (!r.ok) { setError("Something went wrong. Try again."); return; }
      setAddedUser(username);
      setInput("");
      fetchAccounts();
      fetchStatus();
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemove() {
    if (!confirmUsername) return;
    const username = confirmUsername;
    setConfirmUsername(null);
    setRemoving(username);
    await fetch(`${API_BASE}/api/accounts/${username}`, { method: "DELETE" });
    if (addedUser === username) setAddedUser(null);
    fetchAccounts();
    setRemoving(null);
  }

  const eta = status?.next_cycle_eta_minutes;
  const etaText = eta === null || eta === undefined
    ? "unknown"
    : eta === 0 ? "any moment" : `~${eta} min`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Tracked Accounts</h1>

      {/* Add account */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="@username"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={adding || !input.trim()}>
          {adding ? "Adding..." : "Add"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {addedUser && (
        <div className="text-sm text-muted-foreground bg-card border rounded-lg px-4 py-3 mb-4">
          <span className="text-foreground font-medium">@{addedUser}</span> added.
          {" "}It will be baselined on the next poll in <span className="text-foreground font-medium">{etaText}</span>.
          {" "}Alerts will start firing on the cycle after that.
        </div>
      )}

      {/* Account list */}
      <div className="bg-card rounded-lg border divide-y">
        {accounts.map((a) => (
          <div key={a.username} className="flex items-center justify-between px-4 py-3 gap-4">
            {/* Left: avatar + username */}
            <div className="flex items-center gap-3 min-w-0">
              <Avatar username={a.username} size={32} />
              <div className="min-w-0">
                <a
                  href={`https://x.com/${a.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline text-blue-500 hover:text-blue-400"
                >
                  @{a.username}
                </a>
                {!a.baselined && (
                  <span className="ml-2 text-xs text-muted-foreground">pending baseline</span>
                )}
              </div>
            </div>

            {/* Right: stats + remove */}
            <div className="flex items-center gap-5 shrink-0">
              {/* Following count + last follow */}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {a.following_count !== null ? `${a.following_count.toLocaleString()} following` : "—"}
                </p>
                {a.last_new_follow && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    last follow {timeAgo(a.last_new_follow)}
                  </p>
                )}
              </div>

              {/* Last checked */}
              <div className="w-24 text-right">
                <p className="text-xs text-muted-foreground/50">
                  {a.last_checked ? `checked ${timeAgo(a.last_checked)}` : "—"}
                </p>
              </div>

              {/* Remove */}
              <button
                onClick={() => setConfirmUsername(a.username)}
                disabled={removing === a.username}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Remove confirmation dialog */}
      <Dialog.Root
        open={confirmUsername !== null}
        onOpenChange={(open) => { if (!open) setConfirmUsername(null); }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 40 }}
          />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card rounded-xl border p-6 shadow-xl"
            style={{ zIndex: 50 }}
          >
            <Dialog.Title className="text-base font-semibold text-foreground mb-1">
              Remove @{confirmUsername}?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-6">
              This account will no longer be tracked. Any existing follow history is kept, but no new alerts will fire.
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close
                render={
                  <Button variant="outline" onClick={() => setConfirmUsername(null)}>
                    Cancel
                  </Button>
                }
              />
              <Button
                onClick={confirmRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
