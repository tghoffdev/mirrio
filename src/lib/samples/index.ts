/**
 * Sample Tag & Bundle Library
 *
 * A comprehensive collection of sample ad tags for testing.
 * Based on official documentation and real-world tag patterns.
 *
 * NOTE: Some vendor tags are "loader tags" that fetch creatives from
 * external CDNs. These are included for reference/detection testing
 * but won't render actual content. See `renderable` flag on each sample.
 */

export interface SampleTag {
  id: string;
  name: string;
  vendor: string;
  size: { width: number; height: number };
  description: string;
  features: string[];
  tag: string;
  /** Whether this tag will actually render content (vs being a loader/pointer) */
  renderable: boolean;
  /** Optional note about limitations */
  note?: string;
}

export interface SampleBundle {
  id: string;
  name: string;
  size: { width: number; height: number };
  description: string;
  features: string[];
  /** Path relative to public/ */
  path: string;
}

export interface SampleCategory {
  vendor: string;
  displayName: string;
  color: string;
  tags: SampleTag[];
  /** Optional note about the vendor's tag limitations */
  vendorNote?: string;
}

// ============================================================================
// GOOGLE DCM/CM360 SAMPLES (Reference Only - Won't Render)
// ============================================================================

const googleDcmTags: SampleTag[] = [
  {
    id: "dcm-300x250-ins",
    name: "INS Tag (Standard)",
    vendor: "google-dcm",
    size: { width: 300, height: 250 },
    description: "Standard DCM INS tag format - for reference only",
    features: ["DCM INS", "Iframe Mode", "Click Tracking"],
    renderable: false,
    note: "Requires HTML5 export from Google Studio",
    tag: `<!-- Google Campaign Manager INS Tag - 300x250 -->
<!-- NOTE: This is a loader tag - actual creative requires Google's ad servers -->
<ins class='dcmads'
  style='display:inline-block;width:300px;height:250px'
  data-dcm-placement='N7480.1664088DOUBLECLICK.NETTEST/B8299600.114131924'
  data-dcm-param-custom_key='custom_value'
  data-dcm-rendering-mode='iframe'>
  <script src='https://www.googletagservices.com/dcm/dcmads.js'></script>
</ins>`,
  },
  {
    id: "dcm-320x50-mobile",
    name: "Mobile Banner (GDPR)",
    vendor: "google-dcm",
    size: { width: 320, height: 50 },
    description: "Mobile INS tag with GDPR consent parameters",
    features: ["DCM INS", "GDPR", "Mobile"],
    renderable: false,
    note: "Requires HTML5 export from Google Studio",
    tag: `<!-- Google Campaign Manager Mobile Tag - 320x50 -->
<ins class='dcmads'
  style='display:inline-block;width:320px;height:50px'
  data-dcm-placement='N9200.284657.MYSITE/B7841342.2'
  data-dcm-rendering-mode='script'
  data-dcm-https-only
  data-dcm-gdpr-applies='gdpr=\${GDPR}'
  data-dcm-gdpr-consent='gdpr_consent=\${GDPR_CONSENT_755}'
  data-dcm-addtl-consent='addtl_consent=\${ADDTL_CONSENT}'
  data-dcm-ltd='false'
  data-dcm-resettable-device-id=''
  data-dcm-app-id=''>
  <script src='https://www.googletagservices.com/dcm/dcmads.js'></script>
</ins>`,
  },
];

// ============================================================================
// FLASHTALKING SAMPLES
// ============================================================================

const flashtalkingTags: SampleTag[] = [
  {
    id: "ft-300x250-standard",
    name: "Standard JS Tag",
    vendor: "flashtalking",
    size: { width: 300, height: 250 },
    description: "Flashtalking script tag format - for reference only",
    features: ["FT Script", "Noscript Fallback", "Cache Buster"],
    renderable: false,
    note: "Loader tag - creative served from Flashtalking CDN",
    tag: `<!-- Flashtalking Standard Tag - 300x250 -->
<!-- NOTE: This is a loader tag - actual creative requires Flashtalking's servers -->
<script language="Javascript1.1" type="text/javascript">
var ftClick = "";
var ft300x250_OOBclickTrack = "";
var ftRandom = Math.random()*1000000;
var ftBuildTag1 = "<scr";
var ftBuildTag2 = "</";
var ftTag = ftBuildTag1 + 'ipt language="javascript1.1" type="text/javascript" ';
ftTag += 'src="https://servedby.flashtalking.com/imp/3/55444;544455;201;js;PubName;Type300x250Sep18/?click=' + ftClick + '&cachebuster=' + ftRandom + '"';
ftTag += '>' + ftBuildTag2 + 'script>';
document.write(ftTag);
</script>
<noscript>
<a href="https://servedby.flashtalking.com/click/3/55444;544455;1;554;0/?ft_width=300&ft_height=250&url=3729836" target="_blank">
<img border="0" src="https://servedby.flashtalking.com/imp/3/55444;544455;1;554;gif;PubName;Type300x250Sep18/?" width="300" height="250">
</a>
</noscript>`,
  },
  {
    id: "ft-300x250-mraid",
    name: "MRAID Creative",
    vendor: "flashtalking",
    size: { width: 300, height: 250 },
    description: "Self-contained Flashtalking MRAID tag",
    features: ["FT SDK", "MRAID", "Click Tracking"],
    renderable: true,
    tag: `<!-- Flashtalking MRAID Creative - 300x250 -->
<script src="mraid.js"></script>
<script>
var FT = FT || {};
FT.manifest = {
  "placementId": "12345678",
  "campaignId": "87654321",
  "clickTag": "[FT_CLICK]"
};

FT.click = function(url) {
  var finalUrl = url || FT.manifest.clickTag;
  if (typeof mraid !== 'undefined') {
    mraid.open(finalUrl);
  } else {
    window.open(finalUrl, '_blank');
  }
};

// Signal ready
if (typeof mraid !== 'undefined') {
  if (mraid.getState() === 'loading') {
    mraid.addEventListener('ready', function() { console.log('FT: MRAID Ready'); });
  }
}
</script>
<div onclick="FT.click()" style="width:300px;height:250px;background:linear-gradient(135deg,#ff6b35 0%,#f7931e 100%);font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;position:relative;">
  <div style="color:white;font-size:24px;font-weight:bold;text-align:center;padding:0 20px;">Limited Time Offer</div>
  <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-top:8px;">Save big on your next purchase</div>
  <div style="background:white;color:#ff6b35;padding:10px 28px;border-radius:25px;margin-top:20px;font-weight:bold;font-size:13px;">Shop Now</div>
  <div style="position:absolute;bottom:8px;right:8px;color:rgba(255,255,255,0.5);font-size:9px;">Ad by Flashtalking</div>
</div>`,
  },
  {
    id: "ft-160x600-skyscraper",
    name: "Skyscraper",
    vendor: "flashtalking",
    size: { width: 160, height: 600 },
    description: "Self-contained vertical skyscraper",
    features: ["FT SDK", "Tall Format", "MRAID"],
    renderable: true,
    tag: `<!-- Flashtalking Skyscraper - 160x600 -->
<script src="mraid.js"></script>
<script>
var FT = FT || {};
FT.manifest = { clickTag: "[FT_CLICK]" };
FT.click = function() {
  if (typeof mraid !== 'undefined') mraid.open(FT.manifest.clickTag);
};
</script>
<div onclick="FT.click()" style="width:160px;height:600px;background:linear-gradient(180deg,#0f0c29 0%,#302b63 50%,#24243e 100%);font-family:Arial,sans-serif;display:flex;flex-direction:column;cursor:pointer;overflow:hidden;">
  <div style="padding:20px 15px;text-align:center;">
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:10px;margin:0 auto 15px;display:flex;align-items:center;justify-content:center;">
      <span style="color:white;font-size:20px;">*</span>
    </div>
    <div style="color:white;font-size:16px;font-weight:bold;line-height:1.3;">Premium Subscription</div>
  </div>
  <div style="flex:1;padding:15px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.8);font-size:11px;">
      <span style="color:#f5576c;">+</span> Unlimited access
    </div>
    <div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.8);font-size:11px;">
      <span style="color:#f5576c;">+</span> No ads
    </div>
    <div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.8);font-size:11px;">
      <span style="color:#f5576c;">+</span> Offline mode
    </div>
  </div>
  <div style="padding:20px 15px;">
    <div style="background:linear-gradient(90deg,#f093fb 0%,#f5576c 100%);color:white;padding:12px;border-radius:8px;text-align:center;font-weight:bold;font-size:12px;">Try Free</div>
  </div>
</div>`,
  },
];

// ============================================================================
// SIZMEK SAMPLES
// ============================================================================

const sizmekTags: SampleTag[] = [
  {
    id: "sizmek-300x250-script",
    name: "Standard Script Tag",
    vendor: "sizmek",
    size: { width: 300, height: 250 },
    description: "Sizmek script tag format - for reference only",
    features: ["Sizmek Script", "Noscript", "Timestamp"],
    renderable: false,
    note: "Loader tag - creative served from Sizmek CDN",
    tag: `<!-- Sizmek Standard Script Tag - 300x250 -->
<!-- NOTE: This is a loader tag - actual creative requires Sizmek's servers -->
<script src="https://bs.serving-sys.com/BurstingPipe/adServer.bs?cn=rsb&c=28&pli=5845412&PluID=0&w=300&h=250&ord=[timestamp]"></script>
<noscript>
<a href="https://bs.serving-sys.com/BurstingPipe/adServer.bs?cn=brd&FlightID=5845412&Page=&PluID=0&Pos=8795" target="_blank">
<img src="https://bs.serving-sys.com/BurstingPipe/adServer.bs?cn=bsr&FlightID=5845412&Page=&PluID=0&Pos=8795" border=0 width=300 height=250>
</a>
</noscript>`,
  },
  {
    id: "sizmek-300x250-inline",
    name: "HTML5 Inline",
    vendor: "sizmek",
    size: { width: 300, height: 250 },
    description: "Self-contained Sizmek HTML5 with EB SDK simulation",
    features: ["EB SDK", "Dynamic Vars", "HTML5"],
    renderable: true,
    tag: `<!-- Sizmek HTML5 Inline - 300x250 -->
<script src="mraid.js"></script>
<script>
var EB = EB || {};
EB._adConfig = {
  customJSVars: {
    headline1: "Summer Collection",
    subhead1: "New arrivals are here",
    cta: "Shop Now"
  }
};

EB.clickthrough = function(url) {
  var finalUrl = url || '[CLICK_URL]';
  if (typeof mraid !== 'undefined') {
    mraid.open(finalUrl);
  } else {
    window.open(finalUrl, '_blank');
  }
};

function initAd() {
  if(EB._adConfig) {
    document.getElementById('headline').textContent = EB._adConfig.customJSVars.headline1;
    document.getElementById('subhead').textContent = EB._adConfig.customJSVars.subhead1;
    document.getElementById('cta').textContent = EB._adConfig.customJSVars.cta;
  }
}

document.addEventListener('DOMContentLoaded', initAd);
</script>
<div onclick="EB.clickthrough()" style="width:300px;height:250px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
  <div id="headline" style="color:white;font-size:24px;font-weight:bold;text-align:center;">Summer Collection</div>
  <div id="subhead" style="color:rgba(255,255,255,0.9);font-size:14px;margin-top:8px;">New arrivals are here</div>
  <div id="cta" style="background:white;color:#764ba2;padding:10px 28px;border-radius:20px;margin-top:20px;font-weight:bold;font-size:13px;">Shop Now</div>
</div>`,
  },
  {
    id: "sizmek-970x250-billboard",
    name: "Billboard",
    vendor: "sizmek",
    size: { width: 970, height: 250 },
    description: "Self-contained billboard format",
    features: ["EB SDK", "Large Format", "Multi-CTA"],
    renderable: true,
    tag: `<!-- Sizmek Billboard - 970x250 -->
<script src="mraid.js"></script>
<script>
var EB = EB || {};
EB.clickthrough = function(url) {
  if (typeof mraid !== 'undefined') mraid.open(url || '[CLICK_URL]');
};
</script>
<div style="width:970px;height:250px;background:linear-gradient(90deg,#141e30 0%,#243b55 100%);font-family:Arial,sans-serif;display:flex;overflow:hidden;cursor:pointer;" onclick="EB.clickthrough()">
  <div style="flex:1;padding:40px;display:flex;flex-direction:column;justify-content:center;">
    <div style="color:#00d4ff;font-size:12px;text-transform:uppercase;letter-spacing:2px;">New Collection</div>
    <div style="color:white;font-size:36px;font-weight:bold;margin-top:10px;line-height:1.2;">The Future of<br>Smart Living</div>
    <div style="display:flex;gap:15px;margin-top:25px;">
      <div style="background:#00d4ff;color:#141e30;padding:12px 30px;border-radius:4px;font-weight:bold;font-size:14px;">Explore Now</div>
      <div style="border:2px solid rgba(255,255,255,0.3);color:white;padding:12px 30px;border-radius:4px;font-size:14px;">Learn More</div>
    </div>
  </div>
  <div style="width:400px;display:flex;align-items:center;justify-content:center;background:rgba(0,212,255,0.1);">
    <div style="width:180px;height:180px;background:linear-gradient(135deg,#00d4ff 0%,#0099cc 100%);border-radius:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px rgba(0,212,255,0.3);">
      <span style="font-size:72px;">+</span>
    </div>
  </div>
</div>`,
  },
];

// ============================================================================
// ADFORM SAMPLES
// ============================================================================

const adformTags: SampleTag[] = [
  {
    id: "adform-300x250-dhtml",
    name: "DHTML Banner",
    vendor: "adform",
    size: { width: 300, height: 250 },
    description: "Self-contained Adform HTML5 with DHTML.js simulation",
    features: ["DHTML.js", "clickTAG", "HTML5"],
    renderable: true,
    tag: `<!-- Adform DHTML Banner - 300x250 -->
<script src="mraid.js"></script>
<script>
// Adform DHTML.js simulation
var dhtml = dhtml || {};
dhtml.getVar = function(name, defaultVal) {
  var params = { 'clickTAG': '[CLICK_URL]', 'landingPageTarget': '_blank' };
  return params[name] || defaultVal;
};

var clickTAGvalue = dhtml.getVar('clickTAG', 'https://example.com');
var landingpagetarget = dhtml.getVar('landingPageTarget', '_blank');

function handleClick() {
  if (typeof mraid !== 'undefined') {
    mraid.open(clickTAGvalue);
  } else {
    window.open(clickTAGvalue, landingpagetarget);
  }
}
</script>
<div id="banner" onclick="handleClick()" style="width:300px;height:250px;background:linear-gradient(135deg,#5f2c82 0%,#49a09d 100%);font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
  <div style="color:white;font-size:14px;text-transform:uppercase;letter-spacing:3px;opacity:0.8;">Exclusive</div>
  <div style="color:white;font-size:32px;font-weight:bold;margin-top:8px;">Big Savings</div>
  <div style="color:white;font-size:48px;font-weight:bold;margin:5px 0;">25% OFF</div>
  <div style="background:white;color:#5f2c82;padding:12px 32px;border-radius:30px;margin-top:15px;font-weight:bold;font-size:14px;">Claim Offer</div>
</div>`,
  },
  {
    id: "adform-320x480-interstitial",
    name: "Mobile Interstitial",
    vendor: "adform",
    size: { width: 320, height: 480 },
    description: "Self-contained full-screen mobile interstitial",
    features: ["DHTML.js", "Interstitial", "Close Button"],
    renderable: true,
    tag: `<!-- Adform Mobile Interstitial - 320x480 -->
<script src="mraid.js"></script>
<script>
var dhtml = dhtml || {};
dhtml.clickTag = '[CLICK_URL]';
dhtml.click = function() {
  if (typeof mraid !== 'undefined') mraid.open(dhtml.clickTag);
};
dhtml.close = function() {
  if (typeof mraid !== 'undefined') mraid.close();
};
</script>
<div style="width:320px;height:480px;background:linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%);font-family:Arial,sans-serif;position:relative;overflow:hidden;">
  <div onclick="dhtml.close()" style="position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;">
    <span style="color:white;font-size:18px;">X</span>
  </div>
  <div onclick="dhtml.click()" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;box-sizing:border-box;cursor:pointer;text-align:center;">
    <div style="width:100px;height:100px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:25px;display:flex;align-items:center;justify-content:center;margin-bottom:30px;">
      <span style="font-size:48px;color:white;">!</span>
    </div>
    <div style="color:white;font-size:28px;font-weight:bold;line-height:1.3;">You've Been Selected!</div>
    <div style="color:rgba(255,255,255,0.8);font-size:16px;margin-top:15px;line-height:1.5;">Claim your exclusive reward before it expires</div>
    <div style="background:linear-gradient(90deg,#f093fb 0%,#f5576c 100%);color:white;padding:16px 40px;border-radius:30px;margin-top:30px;font-weight:bold;font-size:16px;">Claim Now</div>
    <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:20px;">Limited time offer</div>
  </div>
</div>`,
  },
];

// ============================================================================
// GENERIC MRAID SAMPLES
// ============================================================================

const genericTags: SampleTag[] = [
  {
    id: "generic-300x250-basic",
    name: "Basic MRAID Banner",
    vendor: "generic",
    size: { width: 300, height: 250 },
    description: "Simple MRAID-compliant banner with proper ready check",
    features: ["MRAID 2.0", "Ready Check", "Click Tracking"],
    renderable: true,
    tag: `<!-- Generic MRAID Banner - 300x250 -->
<script src="mraid.js"></script>
<script>
function doReadyCheck() {
  if (typeof mraid === 'undefined') {
    showMyAd();
    return;
  }

  if (mraid.getState() === 'loading') {
    mraid.addEventListener('ready', mraidIsReady);
  } else {
    mraidIsReady();
  }
}

function mraidIsReady() {
  mraid.removeEventListener('ready', mraidIsReady);
  showMyAd();
}

function showMyAd() {
  document.getElementById('ad-container').style.display = 'flex';
}

function handleClick() {
  var clickUrl = '[CLICK_URL]';
  if (typeof mraid !== 'undefined') {
    mraid.open(clickUrl);
  } else {
    window.open(clickUrl, '_blank');
  }
}

doReadyCheck();
</script>
<div id="ad-container" onclick="handleClick()" style="display:none;width:300px;height:250px;background:linear-gradient(135deg,#00c6ff 0%,#0072ff 100%);font-family:Arial,sans-serif;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
  <div style="color:white;font-size:22px;font-weight:bold;text-align:center;">Your Ad Here</div>
  <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:8px;">300 x 250 Banner</div>
  <div style="background:white;color:#0072ff;padding:10px 28px;border-radius:20px;margin-top:20px;font-weight:bold;font-size:13px;">Click Me</div>
</div>`,
  },
  {
    id: "generic-300x250-expandable",
    name: "MRAID Expandable",
    vendor: "generic",
    size: { width: 300, height: 250 },
    description: "Expandable banner using mraid.expand()",
    features: ["MRAID", "Expand/Collapse", "State Change"],
    renderable: true,
    tag: `<!-- Generic MRAID Expandable - 300x250 -->
<script src="mraid.js"></script>
<style>
  #collapsed, #expanded { font-family: Arial, sans-serif; }
  #expanded { display: none; position: absolute; top: 0; left: 0; width: 600px; height: 400px; background: #1a252f; z-index: 100; }
</style>
<script>
function expand() {
  if (typeof mraid !== 'undefined') {
    mraid.expand();
    document.getElementById('collapsed').style.display = 'none';
    document.getElementById('expanded').style.display = 'flex';
  }
}

function closeAd() {
  if (typeof mraid !== 'undefined') {
    mraid.close();
  }
}

function handleClick() {
  if (typeof mraid !== 'undefined') {
    mraid.open('[CLICK_URL]');
  }
}

if (typeof mraid !== 'undefined') {
  mraid.addEventListener('stateChange', function(state) {
    if (state === 'default') {
      document.getElementById('collapsed').style.display = 'flex';
      document.getElementById('expanded').style.display = 'none';
    }
  });
}
</script>
<div id="collapsed" style="width:300px;height:250px;background:#2c3e50;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
  <div style="color:white;font-size:20px;font-weight:bold;">Discover More</div>
  <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:8px;">Interactive experience awaits</div>
  <div onclick="expand()" style="background:#e74c3c;color:white;padding:10px 24px;border-radius:4px;margin-top:20px;font-weight:bold;font-size:12px;cursor:pointer;">Expand</div>
</div>
<div id="expanded" style="flex-direction:column;align-items:center;justify-content:center;">
  <div onclick="closeAd()" style="position:absolute;top:10px;right:10px;width:30px;height:30px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;">X</div>
  <div style="color:white;font-size:24px;font-weight:bold;">Expanded Content</div>
  <div onclick="handleClick()" style="background:#e74c3c;color:white;padding:12px 32px;border-radius:4px;margin-top:20px;cursor:pointer;font-weight:bold;">Learn More</div>
</div>`,
  },
  {
    id: "generic-300x250-macros",
    name: "With Macros",
    vendor: "generic",
    size: { width: 300, height: 250 },
    description: "Banner with various macro formats for testing",
    features: ["MRAID", "Click Macros", "Cache Buster"],
    renderable: true,
    tag: `<!-- Generic MRAID with Macros - 300x250 -->
<script src="mraid.js"></script>
<script>
// Various macro formats for testing
var macros = {
  click: '[CLICK_URL]',
  clickEsc: '%%CLICK_URL_ESC%%',
  cacheBuster: '%%CACHEBUSTER%%',
  timestamp: '__TIMESTAMP__',
  random: '\${RANDOM}'
};

window.adClick = function() {
  if (typeof mraid !== 'undefined') {
    mraid.open(macros.click);
  }
};
</script>
<img src="https://tracking.example.com/pixel?cb=%%CACHEBUSTER%%&ts=__TIMESTAMP__" width="1" height="1" style="position:absolute;visibility:hidden;">
<div onclick="adClick()" style="width:300px;height:250px;background:#2d3436;font-family:'Courier New',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:20px;box-sizing:border-box;">
  <div style="color:#00cec9;font-size:11px;margin-bottom:15px;">MACRO TEST AD</div>
  <div style="color:#dfe6e9;font-size:10px;text-align:left;width:100%;line-height:1.8;">
    <div>[CLICK_URL]</div>
    <div>%%CACHEBUSTER%%</div>
    <div>__TIMESTAMP__</div>
    <div>\${RANDOM}</div>
  </div>
  <div style="background:#00cec9;color:#2d3436;padding:8px 20px;border-radius:4px;margin-top:15px;font-size:11px;font-weight:bold;">Test Click</div>
</div>`,
  },
  {
    id: "generic-320x50-mobile",
    name: "Mobile Banner",
    vendor: "generic",
    size: { width: 320, height: 50 },
    description: "Standard mobile banner",
    features: ["MRAID", "Mobile", "Compact"],
    renderable: true,
    tag: `<!-- Generic Mobile Banner - 320x50 -->
<script src="mraid.js"></script>
<script>
function handleClick() {
  var url = '[CLICK_URL]';
  if (typeof mraid !== 'undefined') {
    mraid.open(url);
  } else {
    window.open(url, '_blank');
  }
}
</script>
<div onclick="handleClick()" style="width:320px;height:50px;background:linear-gradient(90deg,#6c5ce7 0%,#a29bfe 100%);display:flex;align-items:center;justify-content:space-between;padding:0 15px;font-family:Arial,sans-serif;cursor:pointer;box-sizing:border-box;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:30px;height:30px;background:white;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;">A</div>
    <div>
      <div style="color:white;font-size:12px;font-weight:bold;">Download Our App</div>
      <div style="color:rgba(255,255,255,0.8);font-size:9px;">Available now</div>
    </div>
  </div>
  <div style="background:white;color:#6c5ce7;padding:6px 14px;border-radius:12px;font-size:10px;font-weight:bold;">Install</div>
</div>`,
  },
];

// ============================================================================
// HTML5 BUNDLE SAMPLES
// ============================================================================

const html5BundleTags: SampleTag[] = [
  {
    id: "html5-300x250-dv360",
    name: "DV360 Compatible",
    vendor: "html5",
    size: { width: 300, height: 250 },
    description: "Google Ads / DV360 compatible HTML5 banner",
    features: ["HTML5", "clickTag", "DV360"],
    renderable: true,
    tag: `<!-- HTML5 DV360 Compatible - 300x250 -->
<meta name="ad.size" content="width=300,height=250">
<script>var clickTag = "https://www.example.com";</script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  #tap-area { position: absolute; inset: 0; cursor: pointer; }
  #content {
    width: 300px;
    height: 250px;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
<div id="content">
  <div style="color:white;font-size:24px;font-weight:bold;text-align:center;">HTML5 Banner</div>
  <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:10px;">DV360 Compatible</div>
  <div style="background:white;color:#1e3c72;padding:10px 24px;border-radius:20px;margin-top:20px;font-weight:bold;">Click Here</div>
</div>
<div id="tap-area"></div>
<script>
  document.getElementById('tap-area').addEventListener('click', function() {
    window.open(clickTag, '_blank');
  });
</script>`,
  },
];

// ============================================================================
// SAMPLE BUNDLES (ZIP files)
// ============================================================================

export const sampleBundles: SampleBundle[] = [
  {
    id: "bundle-300x250-basic",
    name: "Basic HTML5 Bundle",
    size: { width: 300, height: 250 },
    description: "Simple HTML5 ad with click tracking",
    features: ["HTML5", "ClickTag", "Gradient"],
    path: "samples/bundles/basic-300x250.zip",
  },
  {
    id: "bundle-300x250-animated",
    name: "Animated Banner",
    size: { width: 300, height: 250 },
    description: "CSS keyframe animations with floating elements",
    features: ["HTML5", "CSS Animation", "Keyframes"],
    path: "samples/bundles/animated-300x250.zip",
  },
  {
    id: "bundle-320x50-mobile",
    name: "Mobile Banner",
    size: { width: 320, height: 50 },
    description: "Mobile-optimized HTML5 bundle",
    features: ["HTML5", "Mobile", "MRAID"],
    path: "samples/bundles/mobile-320x50.zip",
  },
  {
    id: "bundle-300x250-dco",
    name: "DCO Template",
    size: { width: 300, height: 250 },
    description: "Dynamic creative with macro placeholders",
    features: ["HTML5", "DCO", "Macros"],
    path: "samples/bundles/dco-300x250.zip",
  },
];

// ============================================================================
// CATEGORIES & EXPORTS
// ============================================================================

export const sampleCategories: SampleCategory[] = [
  {
    vendor: "google-dcm",
    displayName: "Google DCM",
    color: "text-red-400",
    tags: googleDcmTags,
    vendorNote: "DCM INS tags are loader tags that fetch creatives from Google's servers. To preview Google creatives, export the HTML5 bundle from Google Studio and upload it here.",
  },
  {
    vendor: "flashtalking",
    displayName: "Flashtalking",
    color: "text-orange-400",
    tags: flashtalkingTags,
    vendorNote: "Standard FT script tags are loaders. MRAID tags with inline content will render.",
  },
  {
    vendor: "sizmek",
    displayName: "Sizmek",
    color: "text-yellow-400",
    tags: sizmekTags,
    vendorNote: "Script tags are loaders. HTML5 tags with inline content will render.",
  },
  {
    vendor: "adform",
    displayName: "Adform",
    color: "text-teal-400",
    tags: adformTags,
  },
  {
    vendor: "generic",
    displayName: "Generic MRAID",
    color: "text-blue-400",
    tags: genericTags,
  },
  {
    vendor: "html5",
    displayName: "HTML5",
    color: "text-green-400",
    tags: html5BundleTags,
  },
];

export function getAllTags(): SampleTag[] {
  return sampleCategories.flatMap((cat) => cat.tags);
}

export function getTagsByVendor(vendor: string): SampleTag[] {
  const category = sampleCategories.find((cat) => cat.vendor === vendor);
  return category?.tags || [];
}

export function getTagById(id: string): SampleTag | undefined {
  return getAllTags().find((tag) => tag.id === id);
}

export function getTagsBySize(width: number, height: number): SampleTag[] {
  return getAllTags().filter(
    (tag) => tag.size.width === width && tag.size.height === height
  );
}

export function getRenderableTags(): SampleTag[] {
  return getAllTags().filter((tag) => tag.renderable);
}
