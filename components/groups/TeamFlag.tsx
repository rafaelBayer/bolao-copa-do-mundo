"use client";

import { useMemo, useState } from "react";
import {
  getTeamFallbackLabel,
  getTeamFlagSrcSet,
  getTeamFlagUrl,
} from "@/lib/world-cup/teamFlags";

type TeamFlagProps = {
  code?: string | null;
  name?: string | null;
  flagUrl?: string | null;
  className?: string;
};

export function TeamFlag({
  code,
  name,
  flagUrl,
  className = "",
}: TeamFlagProps) {
  const generatedFlagUrl = getTeamFlagUrl(code);
  const src = flagUrl || generatedFlagUrl;
  const srcSet = flagUrl ? undefined : getTeamFlagSrcSet(code);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackLabel = useMemo(() => getTeamFallbackLabel(code), [code]);

  return (
    <span
      className={`flex h-6 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-slate-800 text-[0.6rem] font-black text-slate-300 ring-1 ring-slate-700 light:bg-white light:text-slate-600 light:ring-slate-200 ${className}`}
    >
      {src && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          srcSet={srcSet}
          alt={name ? `Bandeira de ${name}` : ""}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        fallbackLabel
      )}
    </span>
  );
}
