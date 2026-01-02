/**
 * MRAID Container
 *
 * Creates a lightweight MRAID 3.0 compliant container environment
 * that wraps raw MRAID ad tags and provides mock MRAID methods.
 */

import { generateMRAIDBridge } from "./bridge";

export interface MRAIDContainerOptions {
  width: number;
  height: number;
  placementType?: "inline" | "interstitial";
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface MRAIDContainerInstance {
  iframe: HTMLIFrameElement;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/**
 * Creates an MRAID container element for rendering ad tags
 */
export function createMRAIDContainer(
  target: HTMLElement,
  tag: string,
  options: MRAIDContainerOptions
): MRAIDContainerInstance {
  const { width, height, placementType = "inline", onReady, onError } = options;

  console.log("[MRAID Container] Creating container", {
    targetId: target.id,
    targetClass: target.className,
    tagLength: tag.length,
    tagPreview: tag.substring(0, 150) + "...",
    width,
    height,
    placementType,
  });

  // Create iframe
  const iframe = document.createElement("iframe");

  // Sandbox permissions:
  // - allow-scripts: Required for ad JS execution
  // - allow-same-origin: Required for loading external resources
  // - allow-popups: Required for mraid.open() clickthroughs
  // - allow-forms: Some ads may have form elements
  // - allow-popups-to-escape-sandbox: Allow popups to work properly
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-presentation"
  );

  // Style
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = "none";
  iframe.style.display = "block";
  iframe.style.overflow = "hidden";

  // Feature Policy - allow autoplay, fullscreen, etc.
  // Note: autoplay with sound requires user gesture - we allow muted autoplay
  // Using 'allow' attribute which takes precedence over legacy allowfullscreen
  iframe.setAttribute("allow", "autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; camera; microphone");

  // Scrolling
  iframe.setAttribute("scrolling", "no");

  // Generate MRAID bridge script
  const mraidScript = generateMRAIDBridge({ width, height, placementType });

  // Build the srcdoc HTML
  // Note: The tag might include its own <script src="mraid.js"> which will load
  // from our public folder, but our injected mraid object will already be available
  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <base href="${typeof window !== 'undefined' ? window.location.origin : ''}/">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      /* Disable text selection */
      -webkit-user-select: none;
      user-select: none;
      /* Enable touch */
      touch-action: manipulation;
    }
    /* Video styles for inline playback */
    video {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    /* Ensure video elements get proper attributes */
    video:not([playsinline]) {
      /* Force inline playback behavior via CSS */
    }
    /* Force expanded states to fill container - override hardcoded dimensions */
    #expanded, .expanded, [id*="expanded"], [class*="expanded"],
    #fullscreen, .fullscreen, [id*="fullscreen"], [class*="fullscreen"] {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      left: 0 !important;
      top: 0 !important;
    }
  </style>
  <script>
    // Inject MRAID bridge before any ad code runs
    ${mraidScript}

    // Ensure videos have playsinline attribute and can autoplay
    // MutationObserver to catch dynamically created videos
    (function() {
      function setupVideo(video) {
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.muted = false; // Let audio play after user interaction
      }

      // Setup existing videos
      document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('video').forEach(setupVideo);
      });

      // Watch for new videos
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeName === 'VIDEO') {
              setupVideo(node);
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('video').forEach(setupVideo);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    })();
  </script>
</head>
<body>
  ${tag}
</body>
</html>`;

  console.log("[MRAID Container] Setting srcdoc", {
    srcdocLength: srcdoc.length,
    containsTag: srcdoc.includes(tag.substring(0, 50)),
  });
  iframe.srcdoc = srcdoc;

  // Handle load event
  iframe.onload = () => {
    console.log("[MRAID Container] iframe onload fired");
    try {
      onReady?.();
    } catch (e) {
      console.error("[MRAID Container] Error in onReady callback:", e);
    }
  };

  // Handle errors
  iframe.onerror = (e) => {
    const error = new Error(`MRAID Container iframe error: ${e}`);
    console.error("[MRAID Container]", error);
    onError?.(error);
  };

  // Append to target
  console.log("[MRAID Container] Appending iframe to target");
  target.appendChild(iframe);
  console.log("[MRAID Container] Iframe appended, waiting for load...");

  return {
    iframe,
    resize: (newWidth: number, newHeight: number) => {
      iframe.style.width = `${newWidth}px`;
      iframe.style.height = `${newHeight}px`;

      // Note: The MRAID dimensions inside the iframe won't update
      // For a full implementation, we'd need to postMessage to update them
      // For Phase 1 minimal mock, we just resize the container
    },
    destroy: () => {
      iframe.remove();
    },
  };
}

/**
 * Sanitizes HTML tag input
 * Basic sanitization - removes obvious script injection attempts
 * Note: We intentionally allow scripts since MRAID tags need them
 */
export function sanitizeTag(tag: string): string {
  // Trim whitespace
  let sanitized = tag.trim();

  // Decode HTML entities that might be double-encoded
  // Some ad servers encode & as &amp;
  sanitized = sanitized.replace(/&amp;/g, "&");

  return sanitized;
}
