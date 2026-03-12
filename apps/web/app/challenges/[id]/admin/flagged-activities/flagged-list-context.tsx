"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type FlaggedItem = {
  activity: { id: string };
};

interface FlaggedListContextValue {
  /** The currently visible items in the sidebar (in display order) */
  items: FlaggedItem[];
  setItems: (items: FlaggedItem[]) => void;
}

const FlaggedListContext = createContext<FlaggedListContextValue>({
  items: [],
  setItems: () => {},
});

export function FlaggedListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  return (
    <FlaggedListContext.Provider value={{ items, setItems }}>
      {children}
    </FlaggedListContext.Provider>
  );
}

export function useFlaggedList() {
  return useContext(FlaggedListContext);
}
