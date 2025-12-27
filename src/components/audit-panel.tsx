"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
  generateModifiedTag,
} from "@/lib/dco/scanner";
import { Textarea } from "@/components/ui/textarea";

interface AuditPanelProps {
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

export function AuditPanel({
  tag,
  open,
  onOpenChange,
  textElements = [],
  onTextElementsChange,
  onRescan,
  isCrossOrigin = false,
}: AuditPanelProps) {
  const macros = useMemo(() => detectMacros(tag), [tag]);
  const [activeTab, setActiveTab] = useState<"macros" | "text">("macros");
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle text change for a specific element
  const handleTextChange = useCallback(
    (elementId: string, newText: string) => {
      const element = textElements.find((el) => el.id === elementId);
      if (element) {
        updateTextElement(element, newText);
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

  // Generate modified tag when showing export
  const exportResult = useMemo(() => {
    if (!showExport || !hasModifications) return null;
    return generateModifiedTag(tag, textElements);
  }, [showExport, hasModifications, tag, textElements]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!exportResult) return;
    try {
      await navigator.clipboard.writeText(exportResult.tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [exportResult]);

  // Reset export view when panel closes
  useEffect(() => {
    if (!open) {
      setShowExport(false);
      setCopied(false);
    }
  }, [open]);

  const totalCount = macros.length + textElements.length;

  return (
    <div className="relative h-full flex">
      {/* Main content area - slides in/out */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${open ? "w-[320px] opacity-100" : "w-0 opacity-0"}
        `}
      >
        <div className="w-[320px] h-full border-l border-border bg-background flex flex-col">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-mono font-normal text-foreground/50 uppercase tracking-widest">
              Audit
            </span>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "macros" | "text")}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-3 mt-2 shrink-0">
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
              className="flex-1 overflow-y-auto px-3 pb-3 mt-0"
            >
              <div className="space-y-1 pt-2">
                {macros.length === 0 ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    <p>No macros detected</p>
                    <p className="text-xs mt-2 text-foreground/30">
                      Paste a tag with macros like [CLICK_URL]
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-2">
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
              className="flex-1 overflow-y-auto px-3 pb-3 mt-0"
            >
              <div className="space-y-2 pt-2">
                {isCrossOrigin ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    <p>Text editing unavailable</p>
                    <p className="text-xs mt-2 text-foreground/30">
                      External preview URLs are cross-origin
                    </p>
                  </div>
                ) : textElements.length === 0 ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    <p>No text elements found</p>
                    <p className="text-xs mt-2 text-foreground/30">
                      Load an ad tag to scan for text
                    </p>
                    {onRescan && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRescan}
                        className="mt-3"
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
                      <div className="flex gap-1">
                        {onRescan && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRescan}
                            className="h-5 px-2 text-[10px]"
                          >
                            Rescan
                          </Button>
                        )}
                        {hasModifications && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetAll}
                            className="h-5 px-2 text-[10px] text-amber-400 hover:text-amber-300"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Export Section */}
                    {hasModifications && (
                      <div className="border border-border/50 rounded p-2 bg-foreground/5">
                        {!showExport ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExport(true)}
                            className="w-full text-xs h-7"
                          >
                            Generate Modified Tag
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-foreground/50 uppercase tracking-wider">
                                Modified Tag
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowExport(false)}
                                  className="h-5 px-2 text-[10px]"
                                >
                                  Close
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCopy}
                                  className="h-5 px-2 text-[10px]"
                                >
                                  {copied ? "Copied!" : "Copy"}
                                </Button>
                              </div>
                            </div>

                            {(exportResult?.warnings?.length ?? 0) > 0 && exportResult && (
                              <div className="text-[10px] text-amber-400 space-y-0.5">
                                {exportResult.warnings.map((w, i) => (
                                  <div key={i}>⚠ {w}</div>
                                ))}
                              </div>
                            )}

                            <Textarea
                              value={exportResult?.tag ?? ""}
                              readOnly
                              className="h-24 text-[10px] font-mono bg-background/50 resize-none"
                            />

                            <div className="text-[9px] text-foreground/40">
                              {exportResult?.replacements ?? 0} replacement
                              {(exportResult?.replacements ?? 0) !== 1 ? "s" : ""}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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
        </div>
      </div>

      {/* Tab button on the right edge */}
      <button
        onClick={() => onOpenChange(!open)}
        className={`
          shrink-0 w-6 h-full border-l border-border
          flex items-center justify-center
          transition-colors duration-200
          ${open
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
            : "bg-background hover:bg-foreground/5 text-foreground/50 hover:text-foreground/80"
          }
        `}
      >
        <span
          className="text-[10px] font-mono uppercase tracking-widest whitespace-nowrap"
          style={{ writingMode: "vertical-rl" }}
        >
          Audit
          {totalCount > 0 && !open && (
            <span className="ml-1 text-[9px] bg-foreground/10 px-1 py-0.5 rounded">
              {totalCount}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function MacroItem({ macro }: { macro: DetectedMacro }) {
  const description = getMacroDescription(macro.name);
  const formatDisplay = getFormatDisplay(macro.format);

  return (
    <div className="group p-1.5 rounded hover:bg-foreground/5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded truncate">
          {macro.raw}
        </code>
        <div className="flex items-center gap-1 text-[9px] text-foreground/40 shrink-0">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {formatDisplay}
          </span>
          {macro.count > 1 && (
            <span className="bg-foreground/10 px-1 py-0.5 rounded">
              ×{macro.count}
            </span>
          )}
        </div>
      </div>
      {description && (
        <p className="text-[10px] text-foreground/50 mt-0.5 pl-1 truncate">
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
    <div className="group p-1.5 rounded bg-foreground/5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${typeColor}`}>
          {typeLabel}
        </span>
        <div className="flex items-center gap-1">
          {isModified && (
            <span className="text-[8px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
              Modified
            </span>
          )}
          <span className="text-[8px] text-foreground/30">
            {element.fontSize.toFixed(0)}px
          </span>
        </div>
      </div>
      <Input
        value={element.currentText}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs bg-background/50 border-border/50"
      />
      {isModified && (
        <div className="text-[9px] text-foreground/30 truncate">
          Original: {element.originalText}
        </div>
      )}
    </div>
  );
}
