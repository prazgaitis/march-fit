"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type FeedbackItem = {
  id: string;
};

interface FeedbackListContextValue {
  items: FeedbackItem[];
  setItems: (items: FeedbackItem[]) => void;
}

const FeedbackListContext = createContext<FeedbackListContextValue>({
  items: [],
  setItems: () => {},
});

export function FeedbackListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  return (
    <FeedbackListContext.Provider value={{ items, setItems }}>
      {children}
    </FeedbackListContext.Provider>
  );
}

export function useFeedbackList() {
  return useContext(FeedbackListContext);
}
