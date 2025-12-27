"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

interface VendorSamples {
  vendor: string;
  color: string;
  samples: SampleTag[];
}

// Vendor-organized sample tags
const VENDOR_SAMPLES: VendorSamples[] = [
  {
    vendor: "Celtra",
    color: "text-blue-400",
    samples: [
      {
        label: "Celtra v3",
        tag: `<script src="mraid.js"></script>
<div class="celtra-ad-v3">
    <img src="data:image/png,celtra" style="display: none" onerror="
        (function(img) {
            var params = {'accountId':'1d489087','clickUrl':'','clickEvent':'advertiser','externalAdServer':'Custom','tagVersion':'html-standard-9'};
            var req = document.createElement('script');
            req.id = params.scriptId = 'celtra-script-' + (window.celtraScriptIndex = (window.celtraScriptIndex||0)+1);
            params.clientTimestamp = new Date/1000;
            params.clientTimeZoneOffsetInMinutes = new Date().getTimezoneOffset();
            params.hostPageLoadId=window.celtraHostPageLoadId=window.celtraHostPageLoadId||(Math.random()+'').slice(2);
            var qs = '';
            for (var k in params) {
                qs += '&amp;' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            }
            var src = 'https://cdn.celtra.com/ads/acf4983a/mraid-ad.js?' + qs;
            if (src.length >= 8192) {
                src = 'https://ads.celtra.com/acf4983a/mraid-ad.js?' + qs;
            }
            req.src = src;
            img.parentNode.insertBefore(req, img.nextSibling);
        })(this);
    "/>
</div>`,
      },
      {
        label: "Celtra v4",
        tag: `<div class="celtra-ad-v4">
    <!-- celtra-tag-payload
        (function(e){try{
            var params={'accountId':'1d489087','clickUrl':'','clickEvent':'advertiser','externalAdServer':'Custom','preferredClickThroughWindow':'new','tagVersion':'html-universal-11'};
            params.hostPageLoadId=window.celtraHostPageLoadId=window.celtraHostPageLoadId||(Math.random()+'').slice(2);var t=params,a=window,n=document,r=n.createElement.bind(document),c=encodeURIComponent,i=e.parentNode,o=e.tagName&&'script'==e.tagName.toLowerCase(),l='celtra-executed',d={urldecode:decodeURIComponent,htmldecode:function(e){var t=r('div');t.innerHTML=e;return t.textContent},eval:eval,raw:function(e){return e}},s=r('script');s.id=t.scriptId='celtra-script-'+(a.celtraScriptIndex=(a.celtraScriptIndex||0)+1);t.clientTimestamp=new Date/1e3;t.clientTimeZoneOffsetInMinutes=(new Date).getTimezoneOffset();if(-1!==i.className.indexOf(l))return;i.className+=' '+l;var v=Object.keys(t).map(function(e){return c(e)+'='+c(t[e])}).join('&');var m='https://cdn.celtra.com/ads/85bdcedb/universal.js'+'?'+v;s.src=m;i.insertBefore(s,e.nextSibling);
        }catch(e){console.error(e)}})(s); -->
    <script>
        var e=document.currentScript;[].slice.call(e.parentNode.childNodes).forEach(function(t){8==t.nodeType&&t.textContent.startsWith(' celtra-tag-payload')&&new Function('s',t.textContent.substring(19))(e)});
    </script>
</div>`,
      },
    ],
  },
  {
    vendor: "Google DCM",
    color: "text-red-400",
    samples: [
      {
        label: "DCM INS Tag",
        tag: `<ins class='dcmads'
 style='display:inline-block;width:300px;height:250px'
 data-dcm-placement='N123456.123456SITENAME/B12345678.12345678'
 data-dcm-rendering-mode='script'
 data-dcm-https-only>
  <script src='https://www.googletagservices.com/dcm/dcmads.js'></script>
  <!-- Fallback content when ad doesn't load -->
  <div style="width:300px;height:250px;background:linear-gradient(135deg,#ea4335,#fbbc05);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
    <div>
      <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Google DCM</div>
      <div style="font-size:14px;opacity:0.9;">Sample Ad Placeholder</div>
      <div style="font-size:11px;opacity:0.7;margin-top:12px;">300×250</div>
    </div>
  </div>
</ins>`,
      },
      {
        label: "DoubleClick Banner",
        tag: `<div style="width:320px;height:50px;background:linear-gradient(135deg,#4285f4,#34a853);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;">
  <span style="font-weight:bold;">Google DoubleClick Banner</span>
</div>
<script src="https://googleads.g.doubleclick.net/pagead/ads?client=sample"></script>`,
      },
    ],
  },
  {
    vendor: "Flashtalking",
    color: "text-purple-400",
    samples: [
      {
        label: "Flashtalking CDN",
        tag: `<div style="width:300px;height:250px;background:linear-gradient(135deg,#9333ea,#c026d3);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Flashtalking</div>
    <div style="font-size:14px;opacity:0.9;">Rich Media Ad</div>
    <div style="font-size:11px;opacity:0.7;margin-top:12px;">300×250</div>
  </div>
</div>
<script src="https://cdn.flashtalking.com/ads/123456/preview.js"></script>`,
      },
      {
        label: "ServedBy Tag",
        tag: `<div style="width:320px;height:50px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;">
  <span style="font-weight:bold;">Flashtalking ServedBy</span>
</div>
<script type="text/javascript">
var ftExpTrack = "";
var ftClick = "";
var ftRandom = Math.random()*1000000;
var ft_flashSrc = "https://servedby.flashtalking.com/imp/1/123456;12345678;501;swf;SampleClient;300x250SampleAd/?cachebuster="+ftRandom;
</script>`,
      },
      {
        label: "Innovid Tag",
        tag: `<div style="width:300px;height:250px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Innovid</div>
    <div style="font-size:14px;opacity:0.9;">Video Ad Platform</div>
    <div style="font-size:11px;opacity:0.7;margin-top:12px;">CTV / Digital</div>
  </div>
</div>
<script src="https://s.innovid.com/1234567890abcdef/12345678/tags.js"></script>`,
      },
    ],
  },
  {
    vendor: "Sizmek",
    color: "text-orange-400",
    samples: [
      {
        label: "Serving-Sys Tag",
        tag: `<div style="width:300px;height:250px;background:linear-gradient(135deg,#f97316,#fb923c);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;text-align:center;padding:20px;">
  <div>
    <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Sizmek</div>
    <div style="font-size:14px;opacity:0.9;">Display Ad</div>
    <div style="font-size:11px;opacity:0.7;margin-top:12px;">300×250</div>
  </div>
</div>
<script type="text/javascript" src="https://bs.serving-sys.com/Serving/adServer.bs?cn=display&c=23&pli=12345678&adid=123456789"></script>`,
      },
      {
        label: "EBLoader Tag",
        tag: `<div style="width:320px;height:50px;background:linear-gradient(135deg,#ea580c,#f59e0b);display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;">
  <span style="font-weight:bold;">Sizmek EBLoader</span>
</div>
<script src="https://secure-ds.serving-sys.com/BurstingScript/EBLoader.js" type="text/javascript"></script>
<script type="text/javascript">
if (typeof(EB) == 'undefined') {
  EB = {};
  EB.registerModule = function() {};
  EB.addEventListener = function() {};
}
</script>`,
      },
    ],
  },
  {
    vendor: "Generic MRAID",
    color: "text-gray-400",
    samples: [
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
        label: "Simple Banner",
        tag: `<script src="mraid.js"></script>
<div style="width:320px;height:50px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
  <span style="color:#fff;font-weight:bold;">Generic MRAID Banner</span>
</div>`,
      },
    ],
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
                {VENDOR_SAMPLES.map((vendorGroup, idx) => (
                  <div key={vendorGroup.vendor}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className={vendorGroup.color}>
                      {vendorGroup.vendor}
                    </DropdownMenuLabel>
                    {vendorGroup.samples.map((sample) => (
                      <DropdownMenuItem
                        key={sample.label}
                        onClick={() => handleSelectTag(sample.tag)}
                      >
                        {sample.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
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
