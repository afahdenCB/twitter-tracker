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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Follow {
  tracker: string;
  at: string;
}

interface ConvergenceEntry {
  user_id: string;
  username: string;
  name: string;
  followed_by: Follow[];
  count: number;
  latest_follow: string;
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Convergence</h1>
        <div className="flex gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minCount} onValueChange={setMinCount}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2+ trackers</SelectItem>
              <SelectItem value="3">3+ trackers</SelectItem>
              <SelectItem value="5">5+ trackers</SelectItem>
              <SelectItem value="10">10+ trackers</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No results for this filter.</p>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="w-24 text-center">Trackers</TableHead>
                <TableHead>Followed by</TableHead>
                <TableHead className="w-32">Latest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.user_id}>
                  <TableCell>
                    <div>
                      <a
                        href={`https://x.com/${e.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        @{e.username}
                      </a>
                      <p className="text-xs text-gray-500">{e.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-gray-900">{e.count}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {e.followed_by.map((f) => (
                        <Badge key={f.tracker} variant="secondary" className="text-xs">
                          @{f.tracker}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {timeAgo(e.latest_follow)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
