"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZipUpload } from "@/components/zip-upload";
import { SampleBrowser } from "@/components/sample-browser";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

/**
 * TagInput Component
 *
 * Textarea for pasting raw MRAID ad tags, plus HTML5 zip upload.
 */

export type InputMode = "tag" | "html5";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  onHtml5Load: (result: ZipLoadResult) => void;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  onSelectSampleTag: (tag: string, width: number, height: number) => void;
  onSelectSampleBundle: (path: string, width: number, height: number) => void;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  onLoad,
  onHtml5Load,
  inputMode,
  onInputModeChange,
  onSelectSampleTag,
  onSelectSampleBundle,
  disabled,
}: TagInputProps) {

  return (
    <Tabs value={inputMode} onValueChange={(v) => onInputModeChange(v as InputMode)}>
      <TabsList className="w-full">
        <TabsTrigger value="tag" className="flex-1">
          Paste Tag
        </TabsTrigger>
        <TabsTrigger value="html5" className="flex-1">
          Upload HTML5
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tag" className="mt-3">
        <div className="space-y-2">
          <Textarea
            placeholder="Paste a tag here..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-[150px] max-h-[150px] overflow-y-auto font-mono text-sm resize-none"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button onClick={onLoad} disabled={disabled || !value.trim()}>
              Load Tag
            </Button>
            <SampleBrowser
              onSelectTag={onSelectSampleTag}
              onSelectBundle={onSelectSampleBundle}
              trigger={
                <Button variant="outline" disabled={disabled}>
                  Samples
                </Button>
              }
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="html5" className="mt-3">
        <ZipUpload onLoad={onHtml5Load} disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}
