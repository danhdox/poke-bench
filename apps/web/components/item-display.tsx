"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeItemId, getItemSpriteUrl } from "../lib/item-sprites";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DexItemEntry = {
  id: string;
  name: string;
  shortDesc?: string | null;
};

type ItemDisplayProps = {
  itemName?: string | null;
  tooltipDescription?: string | null;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  showName?: boolean;
  fallbackLabel?: string;
};

export function ItemDisplay({
  itemName,
  tooltipDescription,
  className,
  textClassName,
  iconClassName,
  showName = true,
  fallbackLabel = "None",
}: ItemDisplayProps) {
  const [itemDetail, setItemDetail] = useState<DexItemEntry | null>(null);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const itemId = useMemo(() => (itemName ? normalizeItemId(itemName) : null), [itemName]);

  useEffect(() => {
    setSpriteFailed(false);
  }, [itemName]);

  useEffect(() => {
    if (!itemId || !itemName || tooltipDescription) {
      setItemDetail(null);
      return;
    }

    let cancelled = false;

    async function loadItemDetail() {
      const response = await fetch(`/api/dex/items/${itemId}`, { cache: "force-cache" }).catch(() => null);
      if (!response?.ok) {
        return;
      }

      const payload = (await response.json()) as DexItemEntry;
      if (!cancelled) {
        setItemDetail(payload);
      }
    }

    void loadItemDetail();

    return () => {
      cancelled = true;
    };
  }, [itemId, itemName, tooltipDescription]);

  if (!itemName) {
    return <span className={cn("font-medium text-foreground", textClassName)}>{fallbackLabel}</span>;
  }

  const resolvedName = itemDetail?.name ?? itemName;
  const resolvedDescription =
    tooltipDescription ?? itemDetail?.shortDesc ?? "No item description available.";

  const trigger = (
    <div className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background/70",
          iconClassName
        )}
      >
        {!spriteFailed ? (
          <img
            src={getItemSpriteUrl(itemName)}
            alt={resolvedName}
            className="size-5 object-contain"
            loading="lazy"
            decoding="async"
            onError={() => setSpriteFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Item</span>
        )}
      </div>
      {showName ? (
        <span className={cn("truncate font-medium text-foreground", textClassName)}>{resolvedName}</span>
      ) : null}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent sideOffset={6} className="max-w-64 space-y-1.5 px-3 py-2 text-left">
          <div className="font-medium">{resolvedName}</div>
          <div className="text-[11px] leading-5 text-background/85">{resolvedDescription}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
