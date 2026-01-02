/**
 * MRAID.js Mock - Served for <script src="mraid.js"> requests
 *
 * This file is loaded when ad tags include <script src="mraid.js">
 * If the inline mock already initialized window.mraid, we skip.
 * Otherwise, we initialize it here.
 */

(function() {
  // If already initialized by inline script, just ensure ready fires
  if (window.mraid && window.mraid._initialized) {
    console.log('[MRAID.js] Already initialized, skipping');
    return;
  }

  // Simulate mobile/app environment for proper ad rendering
  if (!('ontouchstart' in window)) {
    window.ontouchstart = null;
  }
  if (typeof window.TouchEvent === 'undefined') {
    window.TouchEvent = function TouchEvent() {};
  }

  // Default dimensions - will be overridden if inline mock ran first
  var width = window.innerWidth || 300;
  var height = window.innerHeight || 250;

  // MRAID Environment object (MRAID 3.0)
  window.MRAID_ENV = window.MRAID_ENV || {
    version: '3.0',
    sdk: 'MRAID Capture Tool',
    sdkVersion: '1.0.0',
    appId: 'mraid-capture-tool',
    ifa: '',
    limitAdTracking: true,
    coppa: false
  };

  // Event listeners storage
  var listeners = {};
  var state = 'loading'; // Start as loading, transition to default after DOM ready
  var viewable = false;  // Not viewable until ready

  // MRAID object
  window.mraid = {
    _initialized: true,

    // Version
    getVersion: function() { return '3.0'; },

    // State management
    getState: function() { return state; },

    // Placement
    getPlacementType: function() { return 'inline'; },

    // Viewability
    isViewable: function() { return viewable; },

    // Dimensions
    getScreenSize: function() {
      return { width: width, height: height };
    },
    getCurrentPosition: function() {
      return { x: 0, y: 0, width: width, height: height };
    },
    getMaxSize: function() {
      return { width: width, height: height };
    },
    getDefaultPosition: function() {
      return { x: 0, y: 0, width: width, height: height };
    },

    // Expand properties
    getExpandProperties: function() {
      return {
        width: width,
        height: height,
        useCustomClose: false,
        isModal: true
      };
    },
    setExpandProperties: function(props) {},

    // Resize properties
    getResizeProperties: function() {
      return {
        width: width,
        height: height,
        offsetX: 0,
        offsetY: 0,
        customClosePosition: 'top-right',
        allowOffscreen: false
      };
    },
    setResizeProperties: function(props) {},

    // Orientation properties
    getOrientationProperties: function() {
      return {
        allowOrientationChange: true,
        forceOrientation: 'none'
      };
    },
    setOrientationProperties: function(props) {},

    // Location (MRAID 3.0)
    getLocation: function() {
      return null;
    },

    // Supports
    supports: function(feature) {
      var supported = {
        'sms': false,
        'tel': false,
        'calendar': false,
        'storePicture': false,
        'inlineVideo': true,
        'vpaid': false,
        'location': false
      };
      return supported[feature] || false;
    },

    // Event handling
    addEventListener: function(event, listener) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(listener);

      // Only fire immediately if we've already transitioned to ready state
      // This handles late listeners that register after the ready event
      if (state !== 'loading') {
        if (event === 'ready') {
          setTimeout(function() { listener(); }, 0);
        }
        if (event === 'viewableChange' && viewable) {
          setTimeout(function() { listener(true); }, 0);
        }
        if (event === 'stateChange') {
          setTimeout(function() { listener(state); }, 0);
        }
      }
    },
    removeEventListener: function(event, listener) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(function(l) {
          return l !== listener;
        });
      }
    },

    // Actions - log events without opening new windows
    open: function(url) {
      console.log('[MRAID] open() called:', url);
      // Notify parent frame of click event
      try {
        window.parent.postMessage({
          type: 'mraid-event',
          event: 'open',
          args: [url],
          timestamp: Date.now()
        }, '*');
      } catch (e) {}
    },
    close: function() {
      console.log('[MRAID] close() called');
      if (state === 'expanded') {
        state = 'default';
        mraid._fireEvent('stateChange', 'default');
        try {
          window.parent.postMessage({
            type: 'mraid-event',
            event: 'close',
            args: [],
            timestamp: Date.now()
          }, '*');
        } catch (e) {}
      }
    },
    expand: function(url) {
      console.log('[MRAID] expand() called:', url);
      if (state === 'default') {
        state = 'expanded';
        mraid._fireEvent('stateChange', 'expanded');
        try {
          window.parent.postMessage({
            type: 'mraid-event',
            event: 'expand',
            args: [url],
            timestamp: Date.now()
          }, '*');
        } catch (e) {}
      }
    },
    resize: function() {
      console.log('[MRAID] resize() called');
    },
    playVideo: function(url) {
      console.log('[MRAID] playVideo() called:', url);
      try {
        window.parent.postMessage({
          type: 'mraid-event',
          event: 'playVideo',
          args: [url],
          timestamp: Date.now()
        }, '*');
      } catch (e) {}
    },
    storePicture: function(url) {},
    createCalendarEvent: function(params) {},

    // Internal: fire event to listeners
    _fireEvent: function(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(function(listener) {
          try {
            if (data !== undefined) {
              listener(data);
            } else {
              listener();
            }
          } catch (e) {
            console.warn('MRAID event listener error:', e);
          }
        });
      }
    }
  };

  console.log('[MRAID.js] Initialized');

  // Fire events after DOM is ready - this ensures any video/image elements
  // defined after the MRAID script are available when events fire
  function fireEvents() {
    // Update state before firing events
    state = 'default';
    viewable = true;

    // Fire events in correct order
    mraid._fireEvent('ready');
    mraid._fireEvent('stateChange', 'default');
    mraid._fireEvent('viewableChange', true);
    console.log('[MRAID.js] Events fired - state: default, viewable: true');
  }

  // Wait for DOM to be ready before firing events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireEvents);
  } else {
    // DOM already loaded, fire on next tick
    setTimeout(fireEvents, 0);
  }

})();
