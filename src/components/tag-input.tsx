"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ZipUpload } from "@/components/zip-upload";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

/**
 * TagInput Component
 *
 * Textarea for pasting raw MRAID ad tags, plus HTML5 zip upload.
 */

interface SampleTag {
  label: string;
  tag: string;
}

// Sample tags organized by category
const SAMPLE_TAGS: SampleTag[] = [
  {
    label: "300x250 Banner",
    tag: `<script src="mraid.js"></script>
<div style="width:300px;height:250px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Summer Sale</div>
    <div style="font-size:14px;opacity:0.9;">Up to 50% off everything</div>
    <div style="margin-top:16px;background:#fff;color:#764ba2;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Shop Now</div>
  </div>
</div>`,
  },
  {
    label: "320x50 Banner",
    tag: `<script src="mraid.js"></script>
<div style="width:320px;height:50px;background:linear-gradient(135deg,#06b6d4,#0891b2);display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
  <span style="color:#fff;font-weight:bold;">Limited Time Offer - Click Here</span>
</div>`,
  },
  {
    label: "Video Banner",
    tag: `<script src="mraid.js"></script>
<script>
  var video;
  function mraidReady() {
    if (mraid.getState() === 'loading') {
      mraid.addEventListener('ready', onReady);
    } else {
      onReady();
    }
  }
  function onReady() {
    video = document.getElementById('vid');
    mraid.addEventListener('viewableChange', function(viewable) {
      if (viewable) { video.play(); } else { video.pause(); }
    });
    if (mraid.isViewable()) video.play();
  }
  function handleClick() { mraid.open('https://example.com/landing'); }
  function closeAd() { mraid.close(); }
  mraidReady();
</script>
<div style="position:relative;width:320px;height:480px;background:#000;font-family:sans-serif;">
  <video id="vid" playsinline muted loop style="width:100%;height:100%;object-fit:cover;">
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
  </video>
  <div onclick="handleClick()" style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:#e94560;color:#fff;padding:12px 32px;border-radius:6px;cursor:pointer;font-weight:600;">
    Shop Now
  </div>
  <div onclick="closeAd()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;background:rgba(0,0,0,0.5);border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✕</div>
</div>`,
  },
  {
    label: "With Macros",
    tag: `<script src="https://ads.example.com/serve.js?click=[CLICK_URL]&cache=%%CACHEBUSTER%%&ts=[TIMESTAMP]"></script>
<div style="width:300px;height:250px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">New Collection</div>
    <div style="font-size:14px;opacity:0.9;">Discover the latest styles</div>
    <div style="margin-top:16px;background:#fff;color:#7c3aed;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Learn More</div>
  </div>
</div>`,
  },
  {
    label: "Multi-line Copy",
    tag: `<script src="mraid.js"></script>
<div style="width:300px;height:250px;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:20px;font-weight:bold;margin-bottom:8px;">Free Shipping</div>
    <div style="font-size:13px;opacity:0.9;line-height:1.4;">On all orders over $50.<br/>Use code SHIP50 at checkout.</div>
    <div style="margin-top:16px;background:#fff;color:#ea580c;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Order Now</div>
  </div>
</div>`,
  },
];

export type InputMode = "tag" | "html5";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  onHtml5Load: (result: ZipLoadResult) => void;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  onLoad,
  onHtml5Load,
  inputMode,
  onInputModeChange,
  disabled,
}: TagInputProps) {
  const handleSelectTag = (tag: string) => {
    console.log("[TagInput] Sample tag selected", {
      tagLength: tag.length,
      tagPreview: tag.substring(0, 100) + "...",
    });
    onChange(tag);
  };

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
            placeholder="Paste MRAID tag here..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-[150px] max-h-[150px] overflow-y-auto font-mono text-sm resize-none"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button onClick={onLoad} disabled={disabled || !value.trim()}>
              Load Tag
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={disabled}>
                  Sample Tags
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-foreground/50">
                  Sample Tags
                </DropdownMenuLabel>
                {SAMPLE_TAGS.map((sample) => (
                  <DropdownMenuItem
                    key={sample.label}
                    onClick={() => handleSelectTag(sample.tag)}
                  >
                    {sample.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="html5" className="mt-3">
        <ZipUpload onLoad={onHtml5Load} disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}
