"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type SelectionContextValue = {
  selectedApplicationId: number | null;
  setSelectedApplicationId: (id: number | null) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);

  return (
    <SelectionContext.Provider value={{ selectedApplicationId, setSelectedApplicationId }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}
