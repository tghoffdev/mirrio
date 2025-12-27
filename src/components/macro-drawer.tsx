"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  detectMacros,
  getMacroDescription,
  getFormatDisplay,
  type DetectedMacro,
} from "@/lib/macros/detector";

interface MacroDrawerProps {
  tag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MacroDrawer({ tag, open, onOpenChange }: MacroDrawerProps) {
  const macros = useMemo(() => detectMacros(tag), [tag]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[400px] font-mono">
        <SheetHeader className="pb-4 border-b border-border/50">
          <SheetTitle className="text-xs font-mono font-normal text-foreground/50 uppercase tracking-widest">
            Detected Macros
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
          {macros.length === 0 ? (
            <div className="text-center py-8 text-foreground/40 text-sm">
              <p>No macros detected</p>
              <p className="text-xs mt-2 text-foreground/30">
                Paste a tag with macros like [CLICK_URL] or %%CACHEBUSTER%%
              </p>
            </div>
          ) : (
            <>
              <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-3">
                {macros.length} macro{macros.length !== 1 ? "s" : ""} found
              </div>
              {macros.map((macro) => (
                <MacroItem key={`${macro.format}:${macro.name}`} macro={macro} />
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MacroItem({ macro }: { macro: DetectedMacro }) {
  const description = getMacroDescription(macro.name);
  const formatDisplay = getFormatDisplay(macro.format);

  return (
    <div className="group p-2 rounded hover:bg-foreground/5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          {macro.raw}
        </code>
        <div className="flex items-center gap-2 text-[10px] text-foreground/40">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {formatDisplay}
          </span>
          {macro.count > 1 && (
            <span className="bg-foreground/10 px-1.5 py-0.5 rounded">
              ×{macro.count}
            </span>
          )}
        </div>
      </div>
      {description && (
        <p className="text-[11px] text-foreground/50 mt-1 pl-1">
          {description}
        </p>
      )}
    </div>
  );
}

interface MacroEdgeTabProps {
  macroCount: number;
  onClick: () => void;
}

export function MacroEdgeTab({ macroCount, onClick }: MacroEdgeTabProps) {
  return (
    <button
      onClick={onClick}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-background border border-r-0 border-border rounded-l px-1.5 py-3 hover:bg-foreground/5 transition-colors group"
      style={{ writingMode: "vertical-rl" }}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/50 group-hover:text-foreground/80 transition-colors flex items-center gap-2">
        <span>Macros</span>
        {macroCount > 0 && (
          <span className="bg-foreground/10 text-foreground/70 px-1 py-0.5 rounded text-[9px]">
            {macroCount}
          </span>
        )}
      </span>
    </button>
  );
}
