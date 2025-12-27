/**
 * DCO Scanner
 *
 * Scans iframe DOM for editable text elements and classifies them.
 */

export type TextType = "headline" | "subhead" | "body" | "cta" | "legal" | "unknown";

export interface TextElement {
  /** Unique identifier */
  id: string;
  /** Reference to the actual DOM text node */
  node: Text;
  /** Original text content (for reset) */
  originalText: string;
  /** Current text content */
  currentText: string;
  /** Parent element tag name */
  parentTag: string;
  /** Classified type */
  type: TextType;
  /** Computed font size in px */
  fontSize: number;
}

let idCounter = 0;

function generateId(): string {
  return `text-${++idCounter}`;
}

/**
 * Classify text node based on heuristics
 */
function classifyText(node: Text, iframeWindow: Window): TextType {
  const parent = node.parentElement;
  const text = node.textContent?.trim() || "";

  if (!parent) return "unknown";

  // Get computed styles from iframe's window context
  const styles = iframeWindow.getComputedStyle(parent);
  const fontSize = parseFloat(styles.fontSize || "16");

  // By font size
  if (fontSize >= 24) return "headline";
  if (fontSize >= 18) return "subhead";
  if (fontSize <= 10) return "legal";

  // By content patterns (CTA-like text)
  if (text.length < 25 && /^(shop|buy|learn|click|get|try|start|join|sign|download|subscribe|order|add|view|see|discover|explore)/i.test(text)) {
    return "cta";
  }

  // By element type
  const tagName = parent.tagName.toUpperCase();
  if (tagName === "H1" || tagName === "H2") return "headline";
  if (tagName === "H3" || tagName === "H4") return "subhead";
  if (tagName === "BUTTON" || parent.closest("button") || parent.closest("a")) return "cta";

  // By text length
  if (text.length > 80) return "body";
  if (text.length < 10) return "unknown";

  return "body";
}

/**
 * Check if a text node should be included
 */
function shouldIncludeNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  // Skip script, style, noscript, svg, etc.
  const skipTags = ["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "DEFS", "CLIPPATH"];
  if (skipTags.includes(parent.tagName.toUpperCase())) return false;

  // Skip empty or whitespace-only
  const text = node.textContent?.trim();
  if (!text || text.length === 0) return false;

  // Skip very short text (likely punctuation or icons)
  if (text.length < 2) return false;

  // Skip hidden elements
  const style = parent.style;
  if (style.display === "none" || style.visibility === "hidden") return false;

  return true;
}

/**
 * Scan iframe DOM for text elements
 */
export function scanTextElements(iframe: HTMLIFrameElement): TextElement[] {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;

  if (!doc || !win) {
    console.warn("[DCO Scanner] Cannot access iframe document");
    return [];
  }

  const elements: TextElement[] = [];

  // Reset ID counter for consistent IDs per scan
  idCounter = 0;

  try {
    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return shouldIncludeNode(node as Text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const parent = textNode.parentElement;
      const text = textNode.textContent?.trim() || "";
      const fontSize = parent
        ? parseFloat(win.getComputedStyle(parent).fontSize || "16")
        : 16;

      elements.push({
        id: generateId(),
        node: textNode,
        originalText: text,
        currentText: text,
        parentTag: parent?.tagName || "UNKNOWN",
        type: classifyText(textNode, win),
        fontSize,
      });
    }
  } catch (error) {
    console.error("[DCO Scanner] Error scanning DOM:", error);
  }

  // Sort by type priority: headline > subhead > cta > body > legal > unknown
  const typePriority: Record<TextType, number> = {
    headline: 0,
    subhead: 1,
    cta: 2,
    body: 3,
    legal: 4,
    unknown: 5,
  };

  elements.sort((a, b) => {
    const priorityDiff = typePriority[a.type] - typePriority[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    // Within same type, sort by font size (larger first)
    return b.fontSize - a.fontSize;
  });

  return elements;
}

/**
 * Update a text element's content in the DOM
 */
export function updateTextElement(element: TextElement, newText: string): void {
  element.node.textContent = newText;
  element.currentText = newText;
}

/**
 * Reset a text element to its original content
 */
export function resetTextElement(element: TextElement): void {
  element.node.textContent = element.originalText;
  element.currentText = element.originalText;
}

/**
 * Reset all text elements to their original content
 */
export function resetAllTextElements(elements: TextElement[]): void {
  for (const element of elements) {
    resetTextElement(element);
  }
}

/**
 * Get display label for text type
 */
export function getTypeLabel(type: TextType): string {
  const labels: Record<TextType, string> = {
    headline: "Headline",
    subhead: "Subhead",
    body: "Body",
    cta: "CTA",
    legal: "Legal",
    unknown: "Text",
  };
  return labels[type];
}

/**
 * Get color for text type badge
 */
export function getTypeColor(type: TextType): string {
  const colors: Record<TextType, string> = {
    headline: "text-amber-400 bg-amber-500/10",
    subhead: "text-orange-400 bg-orange-500/10",
    body: "text-blue-400 bg-blue-500/10",
    cta: "text-green-400 bg-green-500/10",
    legal: "text-gray-400 bg-gray-500/10",
    unknown: "text-gray-400 bg-gray-500/10",
  };
  return colors[type];
}

export interface TagGenerationResult {
  /** The modified tag string */
  tag: string;
  /** Number of replacements made */
  replacements: number;
  /** Warnings (e.g., ambiguous replacements) */
  warnings: string[];
}

/**
 * Generate a modified tag by replacing original text with current text
 */
export function generateModifiedTag(
  originalTag: string,
  elements: TextElement[]
): TagGenerationResult {
  let tag = originalTag;
  let replacements = 0;
  const warnings: string[] = [];

  // Only process modified elements
  const modified = elements.filter((el) => el.currentText !== el.originalText);

  for (const element of modified) {
    const { originalText, currentText } = element;

    // Count occurrences of original text
    const regex = new RegExp(escapeRegex(originalText), "g");
    const matches = tag.match(regex);
    const count = matches?.length ?? 0;

    if (count === 0) {
      warnings.push(`"${truncate(originalText, 30)}" not found in tag`);
    } else if (count > 1) {
      // Replace all occurrences but warn
      tag = tag.replace(regex, currentText);
      replacements += count;
      warnings.push(
        `"${truncate(originalText, 30)}" appeared ${count}x - all replaced`
      );
    } else {
      // Exactly one match - safe to replace
      tag = tag.replace(originalText, currentText);
      replacements++;
    }
  }

  return { tag, replacements, warnings };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
