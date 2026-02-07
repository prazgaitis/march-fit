"use client";

import { useState, useEffect } from "react";
import { Settings, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Theme {
  id: string;
  name: string;
  description: string;
  preview: string; // HSL color for preview
  variables: {
    [key: string]: string;
  };
}

const themes: Theme[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean and modern theme",
    preview: "hsl(222.2 84% 20%)",
    variables: {
      primary: "oklch(0.205 0 0)",
      secondary: "oklch(0.97 0 0)",
      accent: "oklch(0.97 0 0)",
      "sidebar-primary": "oklch(0.205 0 0)",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Fresh green theme for wellness",
    preview: "hsl(158 64% 52%)",
    variables: {
      primary: "oklch(0.726 0.156 166.77)",
      secondary: "oklch(0.962 0.020 166.77)",
      accent: "oklch(0.922 0.040 166.77)",
      "sidebar-primary": "oklch(0.726 0.156 166.77)",
    },
  },
  {
    id: "orange",
    name: "Energy",
    description: "Vibrant orange theme for motivation",
    preview: "hsl(25 95% 53%)",
    variables: {
      primary: "oklch(0.726 0.156 50.23)",
      secondary: "oklch(0.962 0.020 50.23)",
      accent: "oklch(0.922 0.040 50.23)",
      "sidebar-primary": "oklch(0.726 0.156 50.23)",
    },
  },
  {
    id: "purple",
    name: "Purple",
    description: "Premium purple theme",
    preview: "hsl(263 70% 50%)",
    variables: {
      primary: "oklch(0.575 0.175 285.75)",
      secondary: "oklch(0.962 0.020 285.75)",
      accent: "oklch(0.922 0.040 285.75)",
      "sidebar-primary": "oklch(0.575 0.175 285.75)",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Warm rose theme",
    preview: "hsl(330 81% 60%)",
    variables: {
      primary: "oklch(0.726 0.156 340.89)",
      secondary: "oklch(0.962 0.020 340.89)",
      accent: "oklch(0.922 0.040 340.89)",
      "sidebar-primary": "oklch(0.726 0.156 340.89)",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Cyberpunk neon theme with dark backgrounds",
    preview: "hsl(199 89% 48%)",
    variables: {
      // Core colors - dark cyberpunk palette
      background: "oklch(0.08 0.02 240)",
      foreground: "oklch(0.95 0.01 180)",

      // Cards and surfaces - darker with subtle neon glow
      card: "oklch(0.12 0.03 240)",
      "card-foreground": "oklch(0.95 0.01 180)",
      popover: "oklch(0.10 0.03 240)",
      "popover-foreground": "oklch(0.95 0.01 180)",

      // Primary - electric cyan
      primary: "oklch(0.70 0.25 199)",
      "primary-foreground": "oklch(0.08 0.02 240)",

      // Secondary - dark purple
      secondary: "oklch(0.15 0.05 270)",
      "secondary-foreground": "oklch(0.95 0.01 180)",

      // Muted surfaces
      muted: "oklch(0.13 0.03 240)",
      "muted-foreground": "oklch(0.65 0.02 180)",

      // Accent - neon pink
      accent: "oklch(0.75 0.20 320)",
      "accent-foreground": "oklch(0.08 0.02 240)",

      // Borders - subtle neon glow
      border: "oklch(0.25 0.05 199)",
      input: "oklch(0.20 0.05 199)",
      ring: "oklch(0.70 0.25 199)",

      // Sidebar - darker theme
      sidebar: "oklch(0.10 0.03 240)",
      "sidebar-foreground": "oklch(0.95 0.01 180)",
      "sidebar-primary": "oklch(0.70 0.25 199)",
      "sidebar-primary-foreground": "oklch(0.08 0.02 240)",
      "sidebar-accent": "oklch(0.15 0.05 270)",
      "sidebar-accent-foreground": "oklch(0.95 0.01 180)",
      "sidebar-border": "oklch(0.25 0.05 199)",
      "sidebar-ring": "oklch(0.70 0.25 199)",

      // Border radius - more angular cyberpunk style
      radius: "0.25rem",

      // Chart colors - neon cyberpunk palette
      "chart-1": "oklch(0.70 0.25 199)", // electric cyan
      "chart-2": "oklch(0.75 0.20 320)", // neon pink
      "chart-3": "oklch(0.65 0.20 120)", // neon green
      "chart-4": "oklch(0.70 0.25 60)",  // electric yellow
      "chart-5": "oklch(0.65 0.20 280)", // electric purple

      // Destructive colors - neon red
      destructive: "oklch(0.65 0.25 15)",
      "destructive-foreground": "oklch(0.95 0.01 180)",
    },
  },
  {
    id: "retro-synthwave",
    name: "Retro Synthwave",
    description: "80s-inspired magenta and electric purple vibes",
    preview: "hsl(316 73% 52%)",
    variables: {
      // Core colors - dark retro palette with vibrant accents
      background: "oklch(0.09 0.04 280)",
      foreground: "oklch(0.94 0.02 320)",

      // Cards and surfaces - dark purple with magenta hints
      card: "oklch(0.13 0.06 290)",
      "card-foreground": "oklch(0.94 0.02 320)",
      popover: "oklch(0.11 0.05 285)",
      "popover-foreground": "oklch(0.94 0.02 320)",

      // Primary - electric magenta
      primary: "oklch(0.68 0.24 316)",
      "primary-foreground": "oklch(0.09 0.04 280)",

      // Secondary - deep purple
      secondary: "oklch(0.16 0.08 285)",
      "secondary-foreground": "oklch(0.94 0.02 320)",

      // Muted surfaces - subtle purple
      muted: "oklch(0.15 0.06 290)",
      "muted-foreground": "oklch(0.70 0.03 320)",

      // Accent - electric cyan-pink
      accent: "oklch(0.72 0.26 195)",
      "accent-foreground": "oklch(0.09 0.04 280)",

      // Borders - bright magenta glow
      border: "oklch(0.35 0.12 316)",
      input: "oklch(0.25 0.10 316)",
      ring: "oklch(0.68 0.24 316)",

      // Sidebar - retro theme
      sidebar: "oklch(0.11 0.05 285)",
      "sidebar-foreground": "oklch(0.94 0.02 320)",
      "sidebar-primary": "oklch(0.68 0.24 316)",
      "sidebar-primary-foreground": "oklch(0.09 0.04 280)",
      "sidebar-accent": "oklch(0.16 0.08 285)",
      "sidebar-accent-foreground": "oklch(0.94 0.02 320)",
      "sidebar-border": "oklch(0.35 0.12 316)",
      "sidebar-ring": "oklch(0.68 0.24 316)",

      // Border radius - slightly rounded retro style
      radius: "0.5rem",

      // Chart colors - retro synthwave palette
      "chart-1": "oklch(0.68 0.24 316)", // electric magenta
      "chart-2": "oklch(0.72 0.26 195)", // electric cyan
      "chart-3": "oklch(0.75 0.22 270)", // electric purple
      "chart-4": "oklch(0.70 0.25 340)", // hot pink
      "chart-5": "oklch(0.65 0.20 240)", // electric blue

      // Destructive colors - hot pink
      destructive: "oklch(0.65 0.25 340)",
      "destructive-foreground": "oklch(0.94 0.02 320)",
    },
  },
];

export function DevConfigurator() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    // Remove any existing theme data attribute
    root.removeAttribute("data-theme");

    // Apply CSS custom properties for the theme
    if (theme.id === "default") {
      // Reset to default values by removing custom properties
      Object.keys(theme.variables).forEach(key => {
        root.style.removeProperty(`--${key}`);
      });
    } else {
      // Apply theme variables
      Object.entries(theme.variables).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });

      // Set data attribute for special theme styling
      root.setAttribute("data-theme", theme.id);
    }

    // Store in localStorage for persistence
    localStorage.setItem("dev-theme", theme.id);
  };

  const handleThemeChange = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(themeId);
      applyTheme(theme);
    }
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("dev-theme");
    if (savedTheme) {
      const theme = themes.find(t => t.id === savedTheme);
      if (theme) {
        setCurrentTheme(savedTheme);
        applyTheme(theme);
      }
    }
  }, []);

  // Apply initial theme on mount if needed
  useEffect(() => {
    const currentThemeData = themes.find(t => t.id === currentTheme);
    if (currentThemeData && currentTheme !== 'default') {
      applyTheme(currentThemeData);
    }
  }, [currentTheme]);

  // Only render in development mode
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          onClick={() => setIsOpen(true)}
        >
          <Settings className="h-6 w-6" />
          <span className="sr-only">Open dev configurator</span>
        </Button>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Dev Configurator
            </DialogTitle>
            <DialogDescription>
              Development mode customization options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Theme Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <Label className="text-base font-medium">Theme</Label>
              </div>

              <Select value={currentTheme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a theme" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-border"
                             style={{ backgroundColor: theme.preview }}
                             title={`${theme.name} theme`} />
                        <div>
                          <div className="font-medium">{theme.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {theme.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Theme Preview */}
              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded-full border border-border ${
                      currentTheme === 'tokyo-night'
                        ? 'shadow-[0_0_10px] shadow-cyan-400/50'
                        : currentTheme === 'retro-synthwave'
                        ? 'shadow-[0_0_8px] shadow-fuchsia-400/60'
                        : ''
                    }`}
                    style={{ backgroundColor: themes.find(t => t.id === currentTheme)?.preview }}
                  />
                  <span className="font-medium">
                    {themes.find(t => t.id === currentTheme)?.name} Theme
                  </span>
                  {currentTheme === 'tokyo-night' && (
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full">
                      NEON
                    </span>
                  )}
                  {currentTheme === 'retro-synthwave' && (
                    <span className="text-xs px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 rounded-full">
                      RETRO
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {themes.find(t => t.id === currentTheme)?.description}
                </p>
                {currentTheme === 'tokyo-night' && (
                  <div className="mt-2 text-xs text-cyan-300">
                    ✨ Includes: Glow effects, animated borders, custom scrollbars, and neon palette
                  </div>
                )}
                {currentTheme === 'retro-synthwave' && (
                  <div className="mt-2 text-xs text-fuchsia-300">
                    🌟 Includes: Scan line effects, retro glows, button lift animations, and 80s color palette
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Changes persist in dev mode
            </p>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}