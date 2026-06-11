import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NotesTab from "@/components/detail/NotesTab";
import type { ApplicationNote } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchNotes: vi.fn(),
}));

import * as api from "@/lib/api";

const mockFetchNotes = vi.mocked(api.fetchNotes);

const makeNote = (id: number): ApplicationNote => ({
  id,
  text: `Note text ${id}`,
  created_at: "2024-06-01T10:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotesTab", () => {
  it("fetches notes on mount", async () => {
    mockFetchNotes.mockResolvedValue([]);
    render(<NotesTab applicationId={1} />);
    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledWith(1));
  });

  it("renders loading state initially", () => {
    mockFetchNotes.mockReturnValue(new Promise(() => {}));
    render(<NotesTab applicationId={1} />);
    expect(screen.getByText("Loading notes…")).toBeInTheDocument();
  });

  it("renders returned note text", async () => {
    mockFetchNotes.mockResolvedValue([makeNote(1), makeNote(2)]);
    render(<NotesTab applicationId={1} />);
    await waitFor(() => {
      expect(screen.getByText("Note text 1")).toBeInTheDocument();
      expect(screen.getByText("Note text 2")).toBeInTheDocument();
    });
  });

  it("renders empty state when no notes returned", async () => {
    mockFetchNotes.mockResolvedValue([]);
    render(<NotesTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("No notes yet.")).toBeInTheDocument()
    );
  });

  it("renders error state on fetch failure", async () => {
    mockFetchNotes.mockRejectedValue(new Error("fail"));
    render(<NotesTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Could not load notes.")).toBeInTheDocument()
    );
  });

  it("refetches when applicationId changes", async () => {
    mockFetchNotes.mockResolvedValue([]);
    const { rerender } = render(<NotesTab applicationId={1} />);
    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledWith(1));

    await act(async () => {
      rerender(<NotesTab applicationId={2} />);
    });

    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledWith(2));
  });
});
