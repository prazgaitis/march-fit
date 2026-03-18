"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type FeedbackItem = {
  id: string;
};

interface FeedbackListContextValue {
  items: FeedbackItem[];
  setItems: (items: FeedbackItem[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const FeedbackListContext = createContext<FeedbackListContextValue>({
  items: [],
  setItems: () => {},
  selectedId: null,
  setSelectedId: () => {},
});

export function FeedbackListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <FeedbackListContext.Provider
      value={{ items, setItems, selectedId, setSelectedId }}
    >
      {children}
    </FeedbackListContext.Provider>
  );
}

export function useFeedbackList() {
  return useContext(FeedbackListContext);
}
