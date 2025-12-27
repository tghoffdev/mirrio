/**
 * MRAID Bridge
 *
 * Generates the mraid.js bridge script to inject into iframes.
 * Implements minimal MRAID 3.0 spec methods with mock responses.
 */

export interface MRAIDBridgeOptions {
  width: number;
  height: number;
  placementType?: "inline" | "interstitial";
}

/**
 * Generates MRAID bridge script content
 * This script is injected into the iframe before the ad tag
 */
export function generateMRAIDBridge(options: MRAIDBridgeOptions): string {
  const { width, height, placementType = "inline" } = options;

  return `
(function() {
  // Simulate mobile/app environment for proper ad rendering
  // Some ad SDKs detect touch support to decide video vs image
  if (!('ontouchstart' in window)) {
    window.ontouchstart = null;
  }

  // Ensure touch events are supported
  if (typeof window.TouchEvent === 'undefined') {
    window.TouchEvent = function TouchEvent() {};
  }

  // MRAID Environment object (MRAID 3.0)
  window.MRAID_ENV = {
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
  // Start in loading state - transition to default after DOM ready
  var state = 'loading';
  var viewable = false;

  // MRAID object
  window.mraid = {
    _initialized: true,

    // Version
    getVersion: function() { return '3.0'; },

    // State management
    getState: function() { return state; },

    // Placement
    getPlacementType: function() { return '${placementType}'; },

    // Viewability
    isViewable: function() { return viewable; },

    // Dimensions
    getScreenSize: function() {
      return { width: ${width}, height: ${height} };
    },
    getCurrentPosition: function() {
      return { x: 0, y: 0, width: ${width}, height: ${height} };
    },
    getMaxSize: function() {
      return { width: ${width}, height: ${height} };
    },
    getDefaultPosition: function() {
      return { x: 0, y: 0, width: ${width}, height: ${height} };
    },

    // Expand properties (for expandable ads)
    getExpandProperties: function() {
      return {
        width: ${width},
        height: ${height},
        useCustomClose: false,
        isModal: true
      };
    },
    setExpandProperties: function(props) {
      // No-op in mock
    },

    // Resize properties
    getResizeProperties: function() {
      return {
        width: ${width},
        height: ${height},
        offsetX: 0,
        offsetY: 0,
        customClosePosition: 'top-right',
        allowOffscreen: false
      };
    },
    setResizeProperties: function(props) {
      // No-op in mock
    },

    // Orientation properties
    getOrientationProperties: function() {
      return {
        allowOrientationChange: true,
        forceOrientation: 'none'
      };
    },
    setOrientationProperties: function(props) {
      // No-op in mock
    },

    // Location (MRAID 3.0)
    getLocation: function() {
      return null; // Location not available
    },

    // Supports - MRAID 3.0 features
    supports: function(feature) {
      var supported = {
        'sms': false,
        'tel': false,
        'calendar': false,
        'storePicture': false,
        'inlineVideo': true,
        'vpaid': false,
        'location': false,
        // MRAID 3.0 additions
        'audioVolumeChange': true,
        'exposureChange': true
      };
      return supported[feature] || false;
    },

    // MRAID 3.0 Audio
    getAudioVolumePercentage: function() {
      return 100; // Volume at 100%
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

    // Helper to notify parent of MRAID calls
    _notifyParent: function(type, args) {
      try {
        window.parent.postMessage({
          type: 'mraid-event',
          event: type,
          args: args || [],
          timestamp: Date.now()
        }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    },

    // Actions
    open: function(url) {
      mraid._notifyParent('open', [url]);
      if (url) {
        window.open(url, '_blank');
      }
    },
    close: function() {
      mraid._notifyParent('close');
      // No-op - can't close the preview
    },
    expand: function(url) {
      mraid._notifyParent('expand', [url]);
      // No-op in mock - would expand the ad
      if (url) {
        window.open(url, '_blank');
      }
    },
    resize: function() {
      mraid._notifyParent('resize');
      // No-op in mock
    },

    // Video (MRAID 3.0)
    playVideo: function(url) {
      mraid._notifyParent('playVideo', [url]);
      if (url) {
        window.open(url, '_blank');
      }
    },

    // Store picture
    storePicture: function(url) {
      mraid._notifyParent('storePicture', [url]);
      // Not supported
    },

    // Calendar
    createCalendarEvent: function(params) {
      mraid._notifyParent('createCalendarEvent', [params]);
      // Not supported
    },

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

  // Fire events after DOM is ready - this ensures any video/image elements
  // defined after the MRAID script are available when events fire
  function fireEvents() {
    // Update state before firing events
    state = 'default';
    viewable = true;

    // Fire ready event
    mraid._fireEvent('ready');

    // Fire stateChange event
    mraid._fireEvent('stateChange', 'default');

    // Fire viewableChange event
    mraid._fireEvent('viewableChange', true);

    console.log('[MRAID Mock] Events fired - state: default, viewable: true');
  }

  // Wait for DOM to be ready before firing events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireEvents);
  } else {
    // DOM already loaded, fire on next tick
    setTimeout(fireEvents, 0);
  }

  console.log('[MRAID Mock] Initialized');

})();
`;
}
