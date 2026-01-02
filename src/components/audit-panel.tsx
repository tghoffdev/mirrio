"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
import { analytics } from "@/lib/analytics";
import { ComplianceTab } from "@/components/compliance-tab";
import { type ComplianceResult, getStatusColor } from "@/lib/compliance";

/** Editable macro with replacement value */
export interface EditableMacro extends DetectedMacro {
  /** User-provided replacement value */
  value: string;
}

/** MRAID event fired by the ad */
export interface MRAIDEvent {
  id: string;
  type: string;
  args?: unknown[];
  timestamp: number;
}

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
  /** MRAID events fired by the ad */
  mraidEvents?: MRAIDEvent[];
  /** Callback when macros are edited - returns modified tag */
  onMacrosChange?: (modifiedTag: string) => void;
  /** Callback to reload the ad with macro changes applied */
  onReloadWithChanges?: (modifiedTag: string) => void;
  /** Callback to reload the ad with text changes (stores and re-applies DOM mods) */
  onTextReloadWithChanges?: () => void;
  /** Macros scanned from HTML5 iframe content */
  html5Macros?: DetectedMacro[];
  /** Callback to replace macro in DOM (for HTML5 content) */
  onMacroReplaceInDOM?: (macro: DetectedMacro, value: string) => void;
  /** Whether content is HTML5 (affects macro editing behavior) */
  isHtml5?: boolean;
  /** Compliance check results */
  complianceResult?: ComplianceResult | null;
  /** Run compliance checks */
  onRunCompliance?: () => void;
  /** Selected DSP for compliance rules */
  selectedDSP?: string;
  /** Change selected DSP */
  onDSPChange?: (dsp: string) => void;
  /** Whether there is content loaded */
  hasContent?: boolean;
}

export function AuditPanel({
  tag,
  open,
  onOpenChange,
  textElements = [],
  onTextElementsChange,
  onRescan,
  isCrossOrigin = false,
  mraidEvents = [],
  onMacrosChange,
  onReloadWithChanges,
  onTextReloadWithChanges,
  html5Macros = [],
  onMacroReplaceInDOM,
  isHtml5 = false,
  complianceResult,
  onRunCompliance,
  selectedDSP = "generic",
  onDSPChange,
  hasContent = false,
}: AuditPanelProps) {
  // Track the "base tag" for macro detection - the original tag before any macro replacements
  const [baseTag, setBaseTag] = useState(tag);
  const [macroValues, setMacroValues] = useState<Record<string, string>>({});

  // Stabilize html5Macros to prevent re-renders when reference changes but content is same
  const html5MacrosKeyRef = useRef<string>("");
  const stableHtml5MacrosRef = useRef<DetectedMacro[]>([]);

  // Create a key from macro names to detect actual changes
  const html5MacrosKey = useMemo(() => {
    return html5Macros.map(m => `${m.format}:${m.name}:${m.raw}`).join("|");
  }, [html5Macros]);

  // Only update the stable ref when content actually changes
  if (html5MacrosKey !== html5MacrosKeyRef.current) {
    html5MacrosKeyRef.current = html5MacrosKey;
    stableHtml5MacrosRef.current = html5Macros;
  }

  // Detect macros - only from HTML5 scanned content (skip tag-based detection to avoid false positives)
  const detectedMacros = useMemo(() => {
    // Only use HTML5 scanned macros - tag-based detection causes too many false positives
    // with vendor tags (Celtra, DCM, etc.) that have query params like &name=
    return stableHtml5MacrosRef.current.sort((a, b) => a.name.localeCompare(b.name));
  }, [html5MacrosKey]);

  // Ref to access macroValues without adding to effect dependencies
  const macroValuesRef = useRef(macroValues);
  macroValuesRef.current = macroValues;

  // Update base tag only when a completely new tag is loaded (not when macros are applied)
  // This effect should only run when tag or baseTag changes, NOT when macroValues changes
  useEffect(() => {
    if (!tag) {
      if (baseTag !== "") {
        setBaseTag("");
      }
      setMacroValues(prev => Object.keys(prev).length === 0 ? prev : {});
      return;
    }

    // Check if this tag is derived from baseTag by applying current macro values
    // Use ref to avoid dependency on macroValues
    let derived = baseTag;
    for (const [macroRaw, value] of Object.entries(macroValuesRef.current)) {
      if (value.trim()) {
        derived = derived.split(macroRaw).join(value);
      }
    }
    if (derived === tag) {
      return;
    }

    // Check if this looks like a new tag (contains macros not derived from baseTag)
    const newMacros = detectMacros(tag);
    const baseMacros = detectMacros(baseTag);

    // If there are new macros that weren't in the base, it's a new tag
    const hasNewMacros = newMacros.some(
      nm => !baseMacros.find(bm => bm.raw === nm.raw)
    );

    // If base is empty, or there are new macros, it's a new tag
    const isNewTag = !baseTag || hasNewMacros;

    if (isNewTag) {
      setBaseTag(tag);
      setMacroValues({});
      setLastTextModifiedTag(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, baseTag]);

  const [activeTab, setActiveTab] = useState<"macros" | "text" | "compliance">("macros");
  const [logExpanded, setLogExpanded] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  // Store the last generated modified tag for text (persists after reload)
  const [lastTextModifiedTag, setLastTextModifiedTag] = useState<string | null>(null);

  // Handle macro value change
  const handleMacroChange = useCallback((macro: DetectedMacro, value: string) => {
    setMacroValues(prev => ({ ...prev, [macro.raw]: value }));

    // Track macro edit
    if (value.trim()) {
      analytics.macroEdit(macro.name);
    }

    // For HTML5 content, also replace in DOM immediately
    if (isHtml5 && onMacroReplaceInDOM && value.trim()) {
      onMacroReplaceInDOM(macro, value);
    }
  }, [isHtml5, onMacroReplaceInDOM]);

  // Get modified tag with macro replacements applied
  const getModifiedTag = useCallback(() => {
    let modifiedTag = baseTag;
    for (const [macroRaw, value] of Object.entries(macroValues)) {
      if (value.trim()) {
        modifiedTag = modifiedTag.split(macroRaw).join(value);
      }
    }
    return modifiedTag;
  }, [baseTag, macroValues]);

  // Apply macro replacements to tag (use baseTag so we always start from original)
  const applyMacros = useCallback(() => {
    onMacrosChange?.(getModifiedTag());
  }, [getModifiedTag, onMacrosChange]);

  // Reload ad with macro changes applied
  const reloadWithChanges = useCallback(() => {
    const macroCount = Object.values(macroValues).filter(v => v.trim()).length;
    analytics.macroReload(macroCount);
    onReloadWithChanges?.(getModifiedTag());
  }, [getModifiedTag, onReloadWithChanges, macroValues]);

  // Check if any macros have values
  const hasMacroValues = Object.values(macroValues).some(v => v.trim());

  // Clear all macro values
  const clearMacroValues = useCallback(() => {
    setMacroValues({});
  }, []);

  // Handle text change for a specific element
  const handleTextChange = useCallback(
    (elementId: string, newText: string) => {
      const element = textElements.find((el) => el.id === elementId);
      if (element) {
        // Track text edit
        if (newText !== element.originalText) {
          analytics.textEdit(element.type);
        }
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

  const totalCount = detectedMacros.length + textElements.length;

  return (
    <div className="relative h-full flex">
      {/* Main content area - slides in/out */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${open ? "w-[320px] opacity-100" : "w-0 opacity-0"}
        `}
      >
        <div className="w-[320px] h-full border-l border-border bg-background flex flex-col relative">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-mono font-normal text-emerald-400/70 uppercase tracking-widest">
              Audit
            </span>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "macros" | "text" | "compliance")}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-3 mt-2 shrink-0">
              <TabsTrigger value="macros" className="flex-1 text-xs">
                Macros
                {detectedMacros.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-foreground/10 px-1.5 py-0.5 rounded">
                    {detectedMacros.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1 text-xs">
                Personalize
                {textElements.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-foreground/10 px-1.5 py-0.5 rounded">
                    {textElements.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex-1 text-xs">
                Comply
                {complianceResult && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${getStatusColor(complianceResult.overallStatus)}`}>
                    {complianceResult.overallStatus === "pass" ? "✓" :
                     complianceResult.overallStatus === "fail" ? complianceResult.checks.filter(c => c.status === "fail").length :
                     complianceResult.overallStatus === "warn" ? "!" : "..."}
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
                {/* Reload with changes button - at top */}
                {hasMacroValues && onReloadWithChanges && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reloadWithChanges}
                    className="w-full mb-2 h-7 text-xs text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/10"
                  >
                    <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload with changes
                  </Button>
                )}
                {detectedMacros.length === 0 ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    {isHtml5 ? (
                      <>
                        <p>No macros detected</p>
                        <p className="text-xs mt-2 text-foreground/30">
                          Scans for [MACRO], {"{{macro}}"}, __MACRO__, etc.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>Macros available for HTML5 bundles</p>
                        <p className="text-xs mt-2 text-foreground/30">
                          Upload a .zip to detect and edit dynamic values
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
                        {detectedMacros.length} macro{detectedMacros.length !== 1 ? "s" : ""} found
                      </div>
                      {hasMacroValues && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearMacroValues}
                            className="h-5 px-2 text-[10px] text-foreground/50 hover:text-foreground"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                    {detectedMacros.map((macro) => (
                      <MacroItem
                        key={`${macro.format}:${macro.name}`}
                        macro={macro}
                        value={macroValues[macro.raw] || ""}
                        onChange={(value) => handleMacroChange(macro, value)}
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
                {/* Reload with changes button - at top */}
                {hasModifications && onTextReloadWithChanges && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Save modified tag for export before reload
                      const result = generateModifiedTag(tag, textElements);
                      setLastTextModifiedTag(result.tag);
                      // Track text reload
                      analytics.textReload(textElements.length);
                      // Use text-specific reload that stores/re-applies DOM mods
                      onTextReloadWithChanges();
                    }}
                    className="w-full mb-1 h-7 text-xs text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/10"
                  >
                    <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload with changes
                  </Button>
                )}
                {isCrossOrigin ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    <p>Personalization unavailable</p>
                    <p className="text-xs mt-2 text-foreground/30">
                      External preview URLs are cross-origin
                    </p>
                  </div>
                ) : textElements.length === 0 ? (
                  <div className="text-center py-6 text-foreground/40 text-sm">
                    {isHtml5 ? (
                      <>
                        <p>No editable text found</p>
                        <p className="text-xs mt-2 text-foreground/30">
                          Text elements will appear after scan
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
                      </>
                    ) : (
                      <>
                        <p>Personalization available for HTML5 bundles</p>
                        <p className="text-xs mt-2 text-foreground/30">
                          Upload a .zip to edit text and dynamic content
                        </p>
                      </>
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

                    {/* Export Section - show for tag-based content only (not HTML5) */}
                    {!isHtml5 && (hasModifications || lastTextModifiedTag) && (
                      <div className="border border-border/50 rounded p-2 bg-foreground/5">
                        {!showExport ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExport(true)}
                            className="w-full text-xs h-7"
                          >
                            {hasModifications ? "Generate Modified Tag" : "View Modified Tag"}
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
                                  onClick={async () => {
                                    const tagToCopy = hasModifications
                                      ? (exportResult?.tag ?? "")
                                      : (lastTextModifiedTag ?? "");
                                    try {
                                      await navigator.clipboard.writeText(tagToCopy);
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    } catch (err) {
                                      console.error("Failed to copy:", err);
                                    }
                                  }}
                                  className="h-5 px-2 text-[10px]"
                                >
                                  {copied ? "Copied!" : "Copy"}
                                </Button>
                              </div>
                            </div>

                            {hasModifications && (exportResult?.warnings?.length ?? 0) > 0 && exportResult && (
                              <div className="text-[10px] text-amber-400 space-y-0.5">
                                {exportResult.warnings.map((w, i) => (
                                  <div key={i}>⚠ {w}</div>
                                ))}
                              </div>
                            )}

                            <Textarea
                              value={hasModifications ? (exportResult?.tag ?? "") : (lastTextModifiedTag ?? "")}
                              readOnly
                              className="h-24 text-[10px] font-mono bg-background/50 resize-none"
                            />

                            {hasModifications && (
                              <div className="text-[9px] text-foreground/40">
                                {exportResult?.replacements ?? 0} replacement
                                {(exportResult?.replacements ?? 0) !== 1 ? "s" : ""}
                              </div>
                            )}
                            {!hasModifications && lastTextModifiedTag && (
                              <div className="text-[9px] text-foreground/40">
                                Previously applied changes
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* HTML5 info message - changes are live DOM edits */}
                    {isHtml5 && hasModifications && (
                      <div className="text-[10px] text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
                        Changes apply live to DOM. Click "Reload with changes" to persist through reload.
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

            {/* Compliance Tab */}
            <TabsContent
              value="compliance"
              className="flex-1 overflow-y-auto px-3 pb-3 mt-0"
            >
              <ComplianceTab
                result={complianceResult}
                onRun={onRunCompliance}
                selectedDSP={selectedDSP}
                onDSPChange={onDSPChange}
                hasContent={hasContent}
              />
            </TabsContent>
          </Tabs>

          {/* Collapsible Log Panel - overlay from bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-background border-t border-border shadow-lg">
            {/* Log header - always visible */}
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-foreground/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-3 h-3 text-foreground/40 transition-transform ${logExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span className="text-[10px] text-foreground/40 uppercase tracking-wider">
                  Log
                </span>
                {mraidEvents.length > 0 && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                    {mraidEvents.length}
                  </span>
                )}
              </div>
              {!logExpanded && mraidEvents.length > 0 && (
                <span className="text-[9px] text-foreground/30 truncate max-w-[150px]">
                  {mraidEvents[mraidEvents.length - 1]?.type}
                </span>
              )}
            </button>

            {/* Expanded log content - grows upward */}
            <div
              className={`transition-all duration-200 ease-out overflow-hidden ${
                logExpanded ? "max-h-[300px]" : "max-h-0"
              }`}
            >
              <div className="px-3 pb-2 space-y-1 overflow-y-auto max-h-[280px]">
                {mraidEvents.length === 0 ? (
                  <div className="text-center py-4 text-foreground/30 text-[10px]">
                    Events will appear here as they fire
                  </div>
                ) : (
                  [...mraidEvents].reverse().map((event) => (
                    <div
                      key={event.id}
                      className="bg-foreground/5 border border-border/50 rounded px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            event.type === 'pixel' || event.type === 'impression' || event.type === 'view'
                              ? 'bg-purple-500'
                              : event.type === 'open' || event.type === 'click'
                              ? 'bg-cyan-500'
                              : 'bg-emerald-500'
                          }`} />
                          <code className={`text-xs ${
                            event.type === 'pixel' || event.type === 'impression' || event.type === 'view'
                              ? 'text-purple-400'
                              : event.type === 'open' || event.type === 'click'
                              ? 'text-cyan-400'
                              : 'text-emerald-400'
                          }`}>{event.type}</code>
                        </div>
                        <span className="text-[9px] text-foreground/30">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      {event.args && event.args.length > 0 && (
                        <div className="text-[10px] text-foreground/50 mt-0.5 truncate pl-3.5">
                          {typeof event.args[0] === 'string' ? event.args[0] : JSON.stringify(event.args[0])}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab button on the right edge */}
      <div className="shrink-0 ml-1">
        <button
          onClick={() => onOpenChange(!open)}
          className={`
            w-6 h-full border-l border-border rounded-tr-md rounded-br-md
            flex items-center justify-center
            transition-all duration-200
            ${open
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
              : "text-emerald-400/50 hover:text-emerald-400/80"
            }
          `}
          style={!open ? {
            background: "linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.15) 100%)"
          } : undefined}
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
    </div>
  );
}

interface MacroItemProps {
  macro: DetectedMacro;
  value: string;
  onChange: (value: string) => void;
}

function MacroItem({ macro, value, onChange }: MacroItemProps) {
  const [expanded, setExpanded] = useState(false);
  const description = getMacroDescription(macro.name);
  const formatDisplay = getFormatDisplay(macro.format);
  const hasValue = value.trim().length > 0;
  const hasMultiple = macro.count > 1;

  // If multiple occurrences, show collapsible header
  if (hasMultiple && !expanded) {
    return (
      <div
        className="group p-1.5 rounded bg-foreground/5 cursor-pointer hover:bg-foreground/10 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className="w-3 h-3 text-foreground/40 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <code className={`text-xs px-1.5 py-0.5 rounded truncate ${
              hasValue
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-cyan-400 bg-cyan-500/10"
            }`}>
              {macro.raw}
            </code>
          </div>
          <span className="text-[9px] bg-foreground/10 px-1.5 py-0.5 rounded text-foreground/50 shrink-0">
            {macro.count} occurrences
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group p-1.5 rounded bg-foreground/5 space-y-1.5">
      {hasMultiple && (
        <div
          className="flex items-center gap-1 text-[9px] text-foreground/40 cursor-pointer hover:text-foreground/60 transition-colors -mb-0.5"
          onClick={() => setExpanded(false)}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span>{macro.count} occurrences</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <code className={`text-xs px-1.5 py-0.5 rounded truncate ${
          hasValue
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-cyan-400 bg-cyan-500/10"
        }`}>
          {macro.raw}
        </code>
        <div className="flex items-center gap-1 text-[9px] text-foreground/40 shrink-0">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {formatDisplay}
          </span>
        </div>
      </div>
      {description && (
        <p className="text-[10px] text-foreground/50 truncate">
          {description}
        </p>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Replacement value..."
        className="h-7 text-xs bg-background/50 border-border/50"
      />
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

/** Event cards component for displaying MRAID calls */
export function MRAIDEventCards({ events }: { events: MRAIDEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2 max-w-xs">
      {events.slice(-5).map((event) => (
        <div
          key={event.id}
          className="bg-background/95 border border-border rounded-lg px-3 py-2 shadow-lg animate-in slide-in-from-left-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <code className="text-xs text-emerald-400">{event.type}</code>
          </div>
          {event.args && event.args.length > 0 && (
            <div className="text-[10px] text-foreground/50 mt-1 truncate">
              {JSON.stringify(event.args[0])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
