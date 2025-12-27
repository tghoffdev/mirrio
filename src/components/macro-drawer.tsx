"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  detectMacros,
  getMacroDescription,
  getFormatDisplay,
  type DetectedMacro,
} from "@/lib/macros/detector";
import {
  type TextElement,
  getTypeLabel,
  getTypeColor,
  updateTextElement,
  resetAllTextElements,
} from "@/lib/dco/scanner";

interface MacroDrawerProps {
  tag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** DCO: Scanned text elements from the ad */
  textElements?: TextElement[];
  /** DCO: Callback when text elements are modified */
  onTextElementsChange?: (elements: TextElement[]) => void;
  /** DCO: Trigger a rescan */
  onRescan?: () => void;
  /** Whether current ad is cross-origin (e.g., Celtra preview) */
  isCrossOrigin?: boolean;
}

export function MacroDrawer({
  tag,
  open,
  onOpenChange,
  textElements = [],
  onTextElementsChange,
  onRescan,
  isCrossOrigin = false,
}: MacroDrawerProps) {
  const macros = useMemo(() => detectMacros(tag), [tag]);
  const [activeTab, setActiveTab] = useState<"macros" | "text">("macros");

  // Handle text change for a specific element
  const handleTextChange = useCallback(
    (elementId: string, newText: string) => {
      const element = textElements.find((el) => el.id === elementId);
      if (element) {
        updateTextElement(element, newText);
        // Trigger re-render by updating state
        onTextElementsChange?.([...textElements]);
      }
    },
    [textElements, onTextElementsChange]
  );

  // Reset all text elements to original values
  const handleResetAll = useCallback(() => {
    resetAllTextElements(textElements);
    onTextElementsChange?.([...textElements]);
  }, [textElements, onTextElementsChange]);

  // Check if any text has been modified
  const hasModifications = textElements.some(
    (el) => el.currentText !== el.originalText
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[400px] font-mono p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-xs font-mono font-normal text-foreground/50 uppercase tracking-widest">
            Tag Inspector
          </SheetTitle>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "macros" | "text")}
          className="flex-1 flex flex-col"
        >
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="macros" className="flex-1 text-xs">
              Macros
              {macros.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-foreground/10 px-1.5 py-0.5 rounded">
                  {macros.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 text-xs">
              Text
              {textElements.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-foreground/10 px-1.5 py-0.5 rounded">
                  {textElements.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Macros Tab */}
          <TabsContent
            value="macros"
            className="flex-1 overflow-y-auto px-4 pb-4 mt-0"
          >
            <div className="space-y-1 pt-3">
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
                    <MacroItem
                      key={`${macro.format}:${macro.name}`}
                      macro={macro}
                    />
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          {/* Text Tab */}
          <TabsContent
            value="text"
            className="flex-1 overflow-y-auto px-4 pb-4 mt-0"
          >
            <div className="space-y-3 pt-3">
              {isCrossOrigin ? (
                <div className="text-center py-8 text-foreground/40 text-sm">
                  <p>Text editing unavailable</p>
                  <p className="text-xs mt-2 text-foreground/30">
                    External preview URLs (Celtra, etc.) are cross-origin and cannot be scanned.
                  </p>
                </div>
              ) : textElements.length === 0 ? (
                <div className="text-center py-8 text-foreground/40 text-sm">
                  <p>No text elements found</p>
                  <p className="text-xs mt-2 text-foreground/30">
                    Load an ad tag to scan for editable text
                  </p>
                  {onRescan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRescan}
                      className="mt-4"
                    >
                      Scan Ad
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
                      {textElements.length} element
                      {textElements.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex gap-2">
                      {onRescan && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onRescan}
                          className="h-6 px-2 text-[10px]"
                        >
                          Rescan
                        </Button>
                      )}
                      {hasModifications && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetAll}
                          className="h-6 px-2 text-[10px] text-amber-400 hover:text-amber-300"
                        >
                          Reset All
                        </Button>
                      )}
                    </div>
                  </div>

                  {textElements.map((element) => (
                    <TextElementItem
                      key={element.id}
                      element={element}
                      onChange={(newText) =>
                        handleTextChange(element.id, newText)
                      }
                    />
                  ))}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
        <code className="text-sm text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
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

interface TextElementItemProps {
  element: TextElement;
  onChange: (newText: string) => void;
}

function TextElementItem({ element, onChange }: TextElementItemProps) {
  const isModified = element.currentText !== element.originalText;
  const typeColor = getTypeColor(element.type);
  const typeLabel = getTypeLabel(element.type);

  return (
    <div className="group p-2 rounded bg-foreground/5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeColor}`}>
          {typeLabel}
        </span>
        <div className="flex items-center gap-2">
          {isModified && (
            <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Modified
            </span>
          )}
          <span className="text-[9px] text-foreground/30">
            {element.fontSize.toFixed(0)}px
          </span>
        </div>
      </div>
      <Input
        value={element.currentText}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm bg-background/50 border-border/50"
      />
      {isModified && (
        <div className="text-[10px] text-foreground/30 truncate">
          Original: {element.originalText}
        </div>
      )}
    </div>
  );
}

interface MacroEdgeTabProps {
  macroCount: number;
  textCount: number;
  onClick: () => void;
}

export function MacroEdgeTab({
  macroCount,
  textCount,
  onClick,
}: MacroEdgeTabProps) {
  const totalCount = macroCount + textCount;

  return (
    <button
      onClick={onClick}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-background border border-r-0 border-border rounded-l px-1.5 py-3 hover:bg-foreground/5 transition-colors group"
      style={{ writingMode: "vertical-rl" }}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/50 group-hover:text-foreground/80 transition-colors flex items-center gap-2">
        <span>Inspect</span>
        {totalCount > 0 && (
          <span className="bg-foreground/10 text-foreground/70 px-1 py-0.5 rounded text-[9px]">
            {totalCount}
          </span>
        )}
      </span>
    </button>
  );
}
