/**
 * HTML5 Ad Preview Service Worker
 *
 * Serves extracted HTML5 zip files from memory and injects MRAID bridge.
 * Version: 4 - Tracking pixel interception
 */

const SW_VERSION = 4;
const PREVIEW_PATH = '/html5-preview/';

// In-memory cache for extracted files
let fileCache = new Map();
let mraidConfig = { width: 300, height: 250 };

console.log('[HTML5 SW] Service worker loaded, version:', SW_VERSION);

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  const { type, files, config } = event.data;
  console.log('[HTML5 SW] Received message:', type);

  if (type === 'LOAD_HTML5') {
    fileCache.clear();
    const loadStart = Date.now();
    let complianceFiles = [];

    if (files) {
      Object.entries(files).forEach(([path, data]) => {
        fileCache.set(path, data);
        // Collect file info for compliance
        complianceFiles.push({
          path: path,
          size: data.content ? data.content.length : 0,
          contentType: data.contentType || 'application/octet-stream'
        });
      });
      console.log('[HTML5 SW] Loaded', fileCache.size, 'files:', Array.from(fileCache.keys()));
    }
    if (config) {
      mraidConfig = config;
    }

    // Respond directly to the sender (most reliable method)
    if (event.source) {
      console.log('[HTML5 SW] Responding to message source');
      event.source.postMessage({ type: 'HTML5_READY' });
      // Send compliance file data
      if (complianceFiles.length > 0) {
        event.source.postMessage({
          type: 'compliance-files',
          files: complianceFiles,
          totalSize: complianceFiles.reduce((sum, f) => sum + f.size, 0),
          loadStart: loadStart
        });
        console.log('[HTML5 SW] Sent compliance data for', complianceFiles.length, 'files');
      }
    } else {
      // Fallback: Notify all clients
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        console.log('[HTML5 SW] Notifying', clients.length, 'clients (fallback)');
        clients.forEach(client => {
          client.postMessage({ type: 'HTML5_READY' });
          // Send compliance file data
          if (complianceFiles.length > 0) {
            client.postMessage({
              type: 'compliance-files',
              files: complianceFiles,
              totalSize: complianceFiles.reduce((sum, f) => sum + f.size, 0),
              loadStart: loadStart
            });
          }
        });
      });
    }
  }

  if (type === 'CLEAR_HTML5') {
    fileCache.clear();
    console.log('[HTML5 SW] Cache cleared');
  }

  if (type === 'UPDATE_CONFIG') {
    if (config) {
      mraidConfig = config;
      console.log('[HTML5 SW] Config updated:', config);
    }
  }
});

// Generate MRAID bridge script
function generateMRAIDBridge(width, height) {
  return `
<script>
(function() {
  if (!('ontouchstart' in window)) {
    window.ontouchstart = null;
  }
  if (typeof window.TouchEvent === 'undefined') {
    window.TouchEvent = function TouchEvent() {};
  }

  window.MRAID_ENV = {
    version: '3.0',
    sdk: 'Doppelist',
    sdkVersion: '1.0.0',
    appId: 'doppelist',
    ifa: '',
    limitAdTracking: true,
    coppa: false
  };

  var listeners = {};
  var state = 'loading';
  var viewable = false;

  // Helper to notify parent of events
  function notifyParent(type, args) {
    try {
      window.parent.postMessage({ type: 'mraid-event', event: type, args: args || [], timestamp: Date.now() }, '*');
      console.log('[MRAID Bridge] Event sent to parent:', type, args);
    } catch (e) {
      console.warn('[MRAID Bridge] Failed to notify parent:', e);
    }
  }

  window.mraid = {
    _initialized: true,
    getVersion: function() { return '3.0'; },
    getState: function() { return state; },
    getPlacementType: function() { return 'inline'; },
    isViewable: function() { return viewable; },
    getScreenSize: function() { return { width: ${width}, height: ${height} }; },
    getCurrentPosition: function() { return { x: 0, y: 0, width: ${width}, height: ${height} }; },
    getMaxSize: function() { return { width: ${width}, height: ${height} }; },
    getDefaultPosition: function() { return { x: 0, y: 0, width: ${width}, height: ${height} }; },
    getExpandProperties: function() { return { width: ${width}, height: ${height}, useCustomClose: false, isModal: true }; },
    setExpandProperties: function(props) {},
    getResizeProperties: function() { return { width: ${width}, height: ${height}, offsetX: 0, offsetY: 0, customClosePosition: 'top-right', allowOffscreen: false }; },
    setResizeProperties: function(props) {},
    getOrientationProperties: function() { return { allowOrientationChange: true, forceOrientation: 'none' }; },
    setOrientationProperties: function(props) {},
    getLocation: function() { return null; },
    supports: function(feature) {
      var supported = { 'sms': false, 'tel': false, 'calendar': false, 'storePicture': false, 'inlineVideo': true, 'vpaid': false, 'location': false, 'audioVolumeChange': true, 'exposureChange': true };
      return supported[feature] || false;
    },
    getAudioVolumePercentage: function() { return 100; },
    addEventListener: function(event, listener) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
      if (state !== 'loading') {
        if (event === 'ready') setTimeout(function() { listener(); }, 0);
        if (event === 'viewableChange' && viewable) setTimeout(function() { listener(true); }, 0);
        if (event === 'stateChange') setTimeout(function() { listener(state); }, 0);
      }
    },
    removeEventListener: function(event, listener) {
      if (listeners[event]) listeners[event] = listeners[event].filter(function(l) { return l !== listener; });
    },
    open: function(url) {
      console.log('[MRAID] open() called:', url);
      notifyParent('open', [url]);
    },
    close: function() {
      console.log('[MRAID] close() called');
      notifyParent('close');
    },
    expand: function(url) {
      console.log('[MRAID] expand() called:', url);
      notifyParent('expand', [url]);
    },
    resize: function() {
      console.log('[MRAID] resize() called');
      notifyParent('resize');
    },
    playVideo: function(url) {
      console.log('[MRAID] playVideo() called:', url);
      notifyParent('playVideo', [url]);
    },
    storePicture: function(url) {
      notifyParent('storePicture', [url]);
    },
    createCalendarEvent: function(params) {
      notifyParent('createCalendarEvent', [params]);
    },
    _fireEvent: function(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(function(listener) {
          try { if (data !== undefined) listener(data); else listener(); }
          catch (e) { console.warn('MRAID event listener error:', e); }
        });
      }
    }
  };

  // Intercept window.open to prevent new tabs/windows
  var originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log('[MRAID Bridge] window.open intercepted:', url);
    notifyParent('open', [url]);
    return null; // Prevent actual window opening
  };

  // Intercept link clicks that try to open new windows
  document.addEventListener('click', function(e) {
    var target = e.target;
    // Walk up to find anchor tag
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (target && target.tagName === 'A') {
      var href = target.href;
      var targetAttr = target.getAttribute('target');
      // Intercept clicks that would navigate away or open new window
      if (href && (targetAttr === '_blank' || targetAttr === '_top' || targetAttr === '_parent')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[MRAID Bridge] Link click intercepted:', href);
        notifyParent('open', [href]);
        return false;
      }
    }
  }, true);

  // Setup clickTag variable for HTML5 ads
  Object.defineProperty(window, 'clickTag', {
    get: function() { return 'javascript:void(0)'; },
    set: function(url) {
      console.log('[MRAID Bridge] clickTag set to:', url);
      window._clickTagUrl = url;
    }
  });
  Object.defineProperty(window, 'clickTAG', {
    get: function() { return window.clickTag; },
    set: function(url) { window.clickTag = url; }
  });

  // Intercept Image() for tracking pixel detection
  var OriginalImage = window.Image;
  window.Image = function(width, height) {
    var img = new OriginalImage(width, height);
    var originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                                 Object.getOwnPropertyDescriptor(img.__proto__, 'src');

    Object.defineProperty(img, 'src', {
      get: function() {
        return originalSrcDescriptor ? originalSrcDescriptor.get.call(this) : this.getAttribute('src');
      },
      set: function(url) {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          // Detect tracking pixel patterns
          var isTracker = /track|pixel|beacon|imp|view|click|event|log|analytics|collect/i.test(url);
          if (isTracker) {
            // Extract event type from URL
            var eventType = 'pixel';
            if (/imp/i.test(url)) eventType = 'impression';
            else if (/view/i.test(url)) eventType = 'view';
            else if (/click/i.test(url)) eventType = 'click';
            else if (/track/i.test(url)) eventType = 'tracking';

            console.log('[MRAID Bridge] Tracking pixel intercepted:', eventType, url);
            notifyParent('pixel', [eventType, url]);
          }
        }
        if (originalSrcDescriptor && originalSrcDescriptor.set) {
          originalSrcDescriptor.set.call(this, url);
        } else {
          this.setAttribute('src', url);
        }
      },
      configurable: true
    });

    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  // Also intercept sendBeacon for modern tracking
  if (navigator.sendBeacon) {
    var originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      console.log('[MRAID Bridge] sendBeacon intercepted:', url);
      notifyParent('beacon', [url]);
      return originalSendBeacon(url, data);
    };
  }

  function fireEvents() {
    state = 'default';
    viewable = true;
    mraid._fireEvent('ready');
    mraid._fireEvent('stateChange', 'default');
    mraid._fireEvent('viewableChange', true);
    console.log('[MRAID Mock] Events fired - state: default, viewable: true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireEvents);
  } else {
    setTimeout(fireEvents, 0);
  }

  console.log('[MRAID Mock] Initialized with click interceptors');
})();
</script>
`;
}

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests to our preview path
  if (!url.pathname.startsWith(PREVIEW_PATH)) {
    return;
  }

  // Get the file path relative to preview root
  let filePath = url.pathname.slice(PREVIEW_PATH.length);

  // Default to index.html
  if (!filePath || filePath === '') {
    filePath = 'index.html';
  }

  event.respondWith(handlePreviewRequest(filePath));
});

async function handlePreviewRequest(filePath) {
  // Look for exact match first
  let fileData = fileCache.get(filePath);

  // Try with leading slash removed
  if (!fileData && filePath.startsWith('/')) {
    fileData = fileCache.get(filePath.slice(1));
  }

  // Try common variations
  if (!fileData) {
    // Check if it's in a subdirectory
    for (const [path, data] of fileCache.entries()) {
      if (path.endsWith('/' + filePath) || path === filePath) {
        fileData = data;
        break;
      }
    }
  }

  if (!fileData) {
    console.warn('[HTML5 SW] File not found:', filePath, 'Available:', Array.from(fileCache.keys()));
    return new Response('Not Found', { status: 404 });
  }

  const { content, contentType } = fileData;

  // For HTML files, inject MRAID bridge
  if (contentType === 'text/html') {
    let html = content;

    // Inject MRAID bridge right after <head> or at start of document
    const mraidBridge = generateMRAIDBridge(mraidConfig.width, mraidConfig.height);

    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + mraidBridge);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', '<HEAD>' + mraidBridge);
    } else if (html.includes('<html>') || html.includes('<HTML>')) {
      html = html.replace(/<html>/i, '<html><head>' + mraidBridge + '</head>');
    } else {
      // Prepend if no head tag found
      html = mraidBridge + html;
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }

  // For binary content (images, etc), convert base64 back to blob
  if (typeof content === 'string' && content.startsWith('data:')) {
    // It's a data URL, extract the blob
    const response = await fetch(content);
    const blob = await response.blob();
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600'
      }
    });
  }

  // Return text content directly
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'max-age=3600'
    }
  });
}

// Activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
