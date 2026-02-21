import type { LucideIcon } from "lucide-react";

export interface MobileNavItem {
  label: string;
  icon: LucideIcon;
  href: (challengeId: string, userId: string) => string;
}

export interface MobileNavLayout {
  leftItems: MobileNavItem[];
  rightItems: MobileNavItem[];
  overflowItems: MobileNavItem[];
}

export function buildMobileNavLayout(items: MobileNavItem[]): MobileNavLayout {
  const home = items.find((item) => item.label === "Home");
  const notifications = items.find((item) => item.label === "Notifications");
  const forum = items.find((item) => item.label === "Forum");

  const leftItems = [home, notifications].filter(
    (item): item is MobileNavItem => Boolean(item)
  );
  const rightItems = [forum].filter(
    (item): item is MobileNavItem => Boolean(item)
  );

  const visibleLabels = new Set([...leftItems, ...rightItems].map((item) => item.label));
  const overflowItems = items.filter((item) => !visibleLabels.has(item.label));

  return {
    leftItems,
    rightItems,
    overflowItems,
  };
}
