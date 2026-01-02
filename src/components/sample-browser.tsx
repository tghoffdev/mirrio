"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sampleCategories,
  sampleBundles,
  type SampleTag,
  type SampleBundle,
} from "@/lib/samples";

interface SampleBrowserProps {
  onSelectTag: (tag: string, width: number, height: number) => void;
  onSelectBundle: (path: string, width: number, height: number) => void;
  trigger?: React.ReactNode;
}

export function SampleBrowser({
  onSelectTag,
  onSelectBundle,
  trigger,
}: SampleBrowserProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tags");
  const [activeVendor, setActiveVendor] = useState(sampleCategories[0]?.vendor || "celtra");

  const handleSelectTag = (sample: SampleTag) => {
    onSelectTag(sample.tag, sample.size.width, sample.size.height);
    setOpen(false);
  };

  const handleSelectBundle = async (bundle: SampleBundle) => {
    onSelectBundle(bundle.path, bundle.size.width, bundle.size.height);
    setOpen(false);
  };

  const activeCategory = sampleCategories.find((c) => c.vendor === activeVendor);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="text-xs">
            Samples
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Sample Library</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="tags" className="flex-1">
              Ad Tags
              <span className="ml-2 text-xs opacity-60">
                {sampleCategories.reduce((sum, c) => sum + c.tags.length, 0)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="bundles" className="flex-1">
              HTML5 Bundles
              <span className="ml-2 text-xs opacity-60">{sampleBundles.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tags" className="flex-1 overflow-hidden flex gap-4 mt-4">
            {/* Vendor Sidebar */}
            <div className="w-40 shrink-0 space-y-1 overflow-y-auto">
              {sampleCategories.map((cat) => {
                const renderableCount = cat.tags.filter((t) => t.renderable).length;
                const hasLimitedSupport = renderableCount < cat.tags.length;
                return (
                  <button
                    key={cat.vendor}
                    onClick={() => setActiveVendor(cat.vendor)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      activeVendor === cat.vendor
                        ? "bg-foreground/10 text-foreground"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cat.color}>{cat.displayName}</span>
                      {hasLimitedSupport && (
                        <span className="text-[8px] text-amber-400" title="Some samples are reference-only">
                          *
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] opacity-50">
                      {renderableCount === cat.tags.length
                        ? `${cat.tags.length} samples`
                        : `${renderableCount}/${cat.tags.length} renderable`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tag List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {/* Vendor Note */}
              {activeCategory?.vendorNote && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs mb-3">
                  <span className="font-medium">Note:</span> {activeCategory.vendorNote}
                </div>
              )}

              {activeCategory?.tags.map((sample) => (
                <div
                  key={sample.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    sample.renderable
                      ? "border-border bg-foreground/5 hover:bg-foreground/10"
                      : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/5"
                  }`}
                  onClick={() => handleSelectTag(sample)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${!sample.renderable ? "text-foreground/60" : ""}`}>
                          {sample.name}
                        </span>
                        <span className="text-xs text-foreground/50">
                          {sample.size.width}x{sample.size.height}
                        </span>
                        {!sample.renderable && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                            Reference Only
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/60 mt-1">
                        {sample.description}
                      </p>
                      {sample.note && (
                        <p className="text-[10px] text-amber-400/80 mt-1 italic">
                          {sample.note}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sample.features.map((feature) => (
                          <span
                            key={feature}
                            className="text-[10px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/70"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 text-xs">
                      {sample.renderable ? "Load" : "View"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bundles" className="flex-1 overflow-y-auto mt-4">
            <div className="grid grid-cols-2 gap-3">
              {sampleBundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className="p-4 rounded-lg border border-border bg-foreground/5 hover:bg-foreground/10 cursor-pointer transition-colors"
                  onClick={() => handleSelectBundle(bundle)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-lg">
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{bundle.name}</div>
                      <div className="text-xs text-foreground/50">
                        {bundle.size.width}x{bundle.size.height}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/60 mt-3">{bundle.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {bundle.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/70"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
