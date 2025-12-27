/**
 * HTML5 Ad Preview Service Worker
 *
 * Serves extracted HTML5 zip files from memory and injects MRAID bridge.
 * Version: 2 - Direct message response
 */

const SW_VERSION = 2;
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
    if (files) {
      Object.entries(files).forEach(([path, data]) => {
        fileCache.set(path, data);
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
    } else {
      // Fallback: Notify all clients
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        console.log('[HTML5 SW] Notifying', clients.length, 'clients (fallback)');
        clients.forEach(client => {
          client.postMessage({ type: 'HTML5_READY' });
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
    sdk: 'Mirrio Capture',
    sdkVersion: '1.0.0',
    appId: 'mirrio-capture',
    ifa: '',
    limitAdTracking: true,
    coppa: false
  };

  var listeners = {};
  var state = 'loading';
  var viewable = false;

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
    open: function(url) { if (url) window.open(url, '_blank'); },
    close: function() {},
    expand: function(url) { if (url) window.open(url, '_blank'); },
    resize: function() {},
    playVideo: function(url) { if (url) window.open(url, '_blank'); },
    storePicture: function(url) {},
    createCalendarEvent: function(params) {},
    _fireEvent: function(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(function(listener) {
          try { if (data !== undefined) listener(data); else listener(); }
          catch (e) { console.warn('MRAID event listener error:', e); }
        });
      }
    }
  };

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

  console.log('[MRAID Mock] Initialized');
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
