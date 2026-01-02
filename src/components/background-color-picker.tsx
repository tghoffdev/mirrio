"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BackgroundColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  { color: "#0f0f23", label: "Dark Blue" },
  { color: "#000000", label: "Black" },
  { color: "#ffffff", label: "White" },
  { color: "#1a1a1a", label: "Dark Gray" },
  { color: "#f5f5f5", label: "Light Gray" },
  { color: "#18181b", label: "Zinc" },
];

export function BackgroundColorPicker({
  value,
  onChange,
}: BackgroundColorPickerProps) {
  return (
    <div className="space-y-3">
      {/* Preset colors */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.color}
            onClick={() => onChange(preset.color)}
            className={`w-8 h-8 rounded border-2 transition-all ${
              value === preset.color
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/50"
            }`}
            style={{ backgroundColor: preset.color }}
            title={preset.label}
          />
        ))}
      </div>

      {/* Custom color input */}
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm h-8 flex-1"
        />
        <label
          className="w-8 h-8 rounded border border-border flex-shrink-0 cursor-pointer relative overflow-hidden"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
    </div>
  );
}
