import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ArchiveButton from "@/components/detail/ArchiveButton";
import type { Application } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  archiveApplication: vi.fn(),
  restoreApplication: vi.fn(),
}));

import * as api from "@/lib/api";

const mockArchive = vi.mocked(api.archiveApplication);
const mockRestore = vi.mocked(api.restoreApplication);

const makeApp = (overrides?: Partial<Application>): Application => ({
  id: 1,
  company: "Acme Corp",
  role: "Engineer",
  status: "applied",
  priority: "medium",
  location_mode: "remote",
  job_link: "",
  employment_type: "Full Time",
  current_stage: "Applied",
  is_draft: false,
  draft_created_at: null,
  archived_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ArchiveButton — active application", () => {
  it("renders Archive button", () => {
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("clicking Archive opens confirmation Dialog", async () => {
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(screen.getByText("Archive application?")).toBeInTheDocument()
    );
  });

  it("Dialog contains the selected company name", async () => {
    render(
      <ArchiveButton
        application={makeApp({ company: "Acme Corp" })}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument()
    );
  });

  it("cancelling closes the Dialog without calling the API", async () => {
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => screen.getByText("Archive application?"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Archive application?")).not.toBeInTheDocument()
    );
    expect(mockArchive).not.toHaveBeenCalled();
  });

  it("confirming calls archiveApplication with the correct ID", async () => {
    mockArchive.mockResolvedValue(undefined);
    const onMutated = vi.fn().mockResolvedValue(undefined);
    render(
      <ArchiveButton
        application={makeApp({ id: 42 })}
        isArchived={false}
        onMutated={onMutated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => screen.getByText("Archive application?"));

    // Click the confirm Archive button inside the dialog (there are two "Archive" buttons now)
    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    // The dialog confirm button is the one inside the dialog footer
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(42));
  });

  it("successful archive calls onMutated", async () => {
    mockArchive.mockResolvedValue(undefined);
    const onMutated = vi.fn().mockResolvedValue(undefined);
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={onMutated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => screen.getByText("Archive application?"));

    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });

  it("failed mutation renders readable error text", async () => {
    mockArchive.mockRejectedValue(new Error("server error"));
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => screen.getByText("Archive application?"));

    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() =>
      expect(screen.getByText("Could not update application.")).toBeInTheDocument()
    );
  });

  it("duplicate submission is prevented while pending", async () => {
    let resolve!: () => void;
    mockArchive.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(
      <ArchiveButton
        application={makeApp()}
        isArchived={false}
        onMutated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => screen.getByText("Archive application?"));

    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    const confirmBtn = archiveButtons[archiveButtons.length - 1];
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    resolve();
    await waitFor(() => expect(mockArchive).toHaveBeenCalledTimes(1));
  });
});

describe("ArchiveButton — archived application", () => {
  it("renders Restore button", () => {
    render(
      <ArchiveButton
        application={makeApp({ archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
        onMutated={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("clicking Restore calls restoreApplication directly", async () => {
    mockRestore.mockResolvedValue(undefined);
    const onMutated = vi.fn().mockResolvedValue(undefined);
    render(
      <ArchiveButton
        application={makeApp({ id: 7, archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
        onMutated={onMutated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith(7));
  });

  it("successful restore calls onMutated", async () => {
    mockRestore.mockResolvedValue(undefined);
    const onMutated = vi.fn().mockResolvedValue(undefined);
    render(
      <ArchiveButton
        application={makeApp({ archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
        onMutated={onMutated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });
});
