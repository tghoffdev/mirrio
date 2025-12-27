"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { MRAIDState } from "@/types";
import {
  createMRAIDContainer,
  sanitizeTag,
  type MRAIDContainerInstance,
} from "@/lib/mraid/container";

export interface UseMRAIDOptions {
  width: number;
  height: number;
}

export interface UseMRAIDReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
  isLoading: boolean;
  state: MRAIDState;
  error: string | null;
  currentTag: string | null;
  loadTag: (tag: string) => void;
  reload: () => void;
  clear: () => void;
}

export function useMRAID(options: UseMRAIDOptions): UseMRAIDReturn {
  const { width, height } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MRAIDContainerInstance | null>(null);
  const currentTagRef = useRef<string | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<MRAIDState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [currentTag, setCurrentTag] = useState<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }
  }, []);

  // Clear the container
  const clear = useCallback(() => {
    cleanup();
    setIsReady(false);
    setIsLoading(false);
    setState("loading");
    setError(null);
    setCurrentTag(null);
    currentTagRef.current = null;
  }, [cleanup]);

  // Load a tag into the container
  const loadTag = useCallback(
    (tag: string) => {
      console.log("[useMRAID] loadTag called", {
        tagLength: tag.length,
        tagPreview: tag.substring(0, 100) + "...",
        hasContainerRef: !!containerRef.current,
      });

      if (!containerRef.current) {
        console.error("[useMRAID] Container ref not available!");
        setError("Container ref not available");
        return;
      }

      // Cleanup existing instance
      console.log("[useMRAID] Cleaning up existing instance...");
      cleanup();

      // Reset state
      setIsLoading(true);
      setIsReady(false);
      setState("loading");
      setError(null);

      // Sanitize tag
      const sanitized = sanitizeTag(tag);
      console.log("[useMRAID] Tag sanitized", {
        originalLength: tag.length,
        sanitizedLength: sanitized.length,
      });
      currentTagRef.current = sanitized;
      setCurrentTag(sanitized);

      try {
        console.log("[useMRAID] Creating MRAID container...", { width, height });
        // Create new container
        instanceRef.current = createMRAIDContainer(
          containerRef.current,
          sanitized,
          {
            width,
            height,
            onReady: () => {
              console.log("[useMRAID] Container ready!");
              setIsLoading(false);
              setIsReady(true);
              setState("default");
            },
            onError: (err) => {
              console.error("[useMRAID] Container error:", err.message);
              setIsLoading(false);
              setError(err.message);
              setState("hidden");
            },
          }
        );
        console.log("[useMRAID] Container created successfully");
      } catch (err) {
        console.error("[useMRAID] Exception creating container:", err);
        setIsLoading(false);
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("hidden");
      }
    },
    [width, height, cleanup]
  );

  // Reload the current tag
  const reload = useCallback(() => {
    if (currentTagRef.current) {
      loadTag(currentTagRef.current);
    }
  }, [loadTag]);

  // Resize when dimensions change
  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.resize(width, height);
    }
  }, [width, height]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    containerRef,
    isReady,
    isLoading,
    state,
    error,
    currentTag,
    loadTag,
    reload,
    clear,
  };
}
