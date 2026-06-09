"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type SelectedTrackerItem =
  | { kind: "draft"; draftId: string }
  | { kind: "application"; applicationId: number }
  | null;

type SelectionContextValue = {
  selection: SelectedTrackerItem;
  setSelection: (item: SelectedTrackerItem) => void;
  // Convenience aliases kept for backward compat with components still reading selectedApplicationId
  selectedApplicationId: number | null;
  setSelectedApplicationId: (id: number | null) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectedTrackerItem>(null);

  const selectedApplicationId =
    selection?.kind === "application" ? selection.applicationId : null;

  const setSelectedApplicationId = (id: number | null) => {
    setSelection(id === null ? null : { kind: "application", applicationId: id });
  };

  return (
    <SelectionContext.Provider
      value={{ selection, setSelection, selectedApplicationId, setSelectedApplicationId }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}
