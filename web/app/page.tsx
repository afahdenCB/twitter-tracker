"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Account {
  username: string;
  following_count: number | null;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tracked Accounts</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {accounts.map((a) => (
          <Card key={a.username} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-base font-medium">
                <a
                  href={`https://x.com/${a.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  @{a.username}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-gray-500">
                {a.following_count !== null
                  ? `${a.following_count.toLocaleString()} following`
                  : "No data yet"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
