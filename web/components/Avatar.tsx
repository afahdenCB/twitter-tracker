"use client";

import { useState } from "react";

interface AvatarProps {
  username: string;
  size?: number;
}

export default function Avatar({ username, size = 32 }: AvatarProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        style={{ width: size, height: size, minWidth: size }}
        className="rounded-full bg-muted flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ width: size * 0.55, height: size * 0.55 }}
          className="text-muted-foreground"
        >
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://unavatar.io/x/${username}`}
      alt={username}
      width={size}
      height={size}
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full object-cover"
      onError={() => setErrored(true)}
    />
  );
}
