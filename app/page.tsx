import AppShell from "@/components/layout/AppShell";
import { SelectionProvider } from "@/lib/SelectionContext";

export default function Home() {
  return (
    <SelectionProvider>
      <AppShell />
    </SelectionProvider>
  );
}
