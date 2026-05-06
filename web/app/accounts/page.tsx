"use client";

import { useEffect, useState } from "react";

interface Account {
  username: string;
  following_count: number | null;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Tracked Accounts</h1>
      <div className="bg-card rounded-lg border divide-y">
        {accounts.map((a) => (
          <div key={a.username} className="flex items-center justify-between px-4 py-3">
            <a
              href={`https://x.com/${a.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline text-foreground"
            >
              @{a.username}
            </a>
            <span className="text-sm text-muted-foreground">
              {a.following_count !== null
                ? `${a.following_count.toLocaleString()} following`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
