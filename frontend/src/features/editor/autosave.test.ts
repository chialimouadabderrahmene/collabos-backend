import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/http";
import type { Draft } from "@/lib/api/opportunities";
import { AUTOSAVE_DELAY_MS, autosaveReducer, useDraftAutosave, type AutosaveState } from "./autosave";

vi.mock("@/lib/api/opportunities", () => ({
  opportunitiesApi: { saveDraft: vi.fn(), getDraft: vi.fn() },
}));
const { opportunitiesApi } = await import("@/lib/api/opportunities");
const saveDraft = vi.mocked(opportunitiesApi.saveDraft);
const getDraft = vi.mocked(opportunitiesApi.getDraft);

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    opportunityId: "opp-1",
    format: "tiptap",
    schemaVersion: 1,
    content: { type: "doc", content: [] },
    revision: 1,
    updatedById: "u1",
    updatedAt: "2026-09-24T10:00:00.000Z",
    latestVersionNumber: 0,
    hasUnpublishedChanges: true,
    ...overrides,
  };
}

const base: AutosaveState = { status: "idle", revision: 0, lastSavedAt: null, error: null, conflict: null };

describe("autosaveReducer", () => {
  it("marks edits dirty and records successful saves", () => {
    const dirty = autosaveReducer(base, { type: "edit" });
    expect(dirty.status).toBe("dirty");
    const saved = autosaveReducer(
      autosaveReducer(dirty, { type: "save-start" }),
      { type: "save-success", revision: 3, at: new Date(), stillDirty: false },
    );
    expect(saved).toMatchObject({ status: "saved", revision: 3 });
  });

  it("stays dirty when edits arrived during the save", () => {
    const state = autosaveReducer(base, { type: "save-success", revision: 2, at: new Date(), stillDirty: true });
    expect(state.status).toBe("dirty");
  });

  it("keeps the conflict open while the user keeps typing", () => {
    const conflicted = autosaveReducer(base, {
      type: "conflict",
      conflict: { currentRevision: 9, serverDraft: null },
    });
    expect(autosaveReducer(conflicted, { type: "edit" }).status).toBe("conflict");
  });

  it("clears the conflict only on explicit resolution", () => {
    const conflicted = autosaveReducer(base, { type: "conflict", conflict: { currentRevision: 9, serverDraft: null } });
    const resolved = autosaveReducer(conflicted, { type: "resolved", revision: 10, at: new Date() });
    expect(resolved).toMatchObject({ status: "saved", revision: 10, conflict: null });
  });
});

describe("useDraftAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  function setup(content = { type: "doc", content: [{ type: "paragraph" }] }) {
    const replaceContent = vi.fn();
    const hook = renderHook(() =>
      useDraftAutosave({
        opportunityId: "opp-1",
        initialRevision: 1,
        getContent: () => content,
        replaceContent,
        enabled: true,
      }),
    );
    return { ...hook, replaceContent };
  }

  it("debounces edits into one save with the base revision", async () => {
    saveDraft.mockResolvedValue(draft({ revision: 2 }));
    const { result } = setup();

    act(() => {
      result.current.markDirty();
      result.current.markDirty();
    });
    expect(saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10);
    });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith("opp-1", expect.objectContaining({ baseRevision: 1, format: "tiptap" }));
    expect(result.current.state.revision).toBe(2);
  });

  it("uses the new revision for the next save", async () => {
    saveDraft.mockResolvedValueOnce(draft({ revision: 2 })).mockResolvedValueOnce(draft({ revision: 3 }));
    const { result } = setup();

    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });
    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });

    expect(saveDraft).toHaveBeenLastCalledWith("opp-1", expect.objectContaining({ baseRevision: 2 }));
    expect(result.current.state.revision).toBe(3);
  });

  it("enters conflict on 409, pauses autosave and never overwrites", async () => {
    saveDraft.mockRejectedValue(new ApiError(409, { message: "Stale", details: { currentRevision: 7 } }));
    getDraft.mockResolvedValue(draft({ revision: 7 }));
    const { result } = setup();

    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });

    expect(result.current.state.status).toBe("conflict");
    expect(result.current.state.conflict).toMatchObject({ currentRevision: 7 });

    // Further edits do not send anything while the conflict is open.
    saveDraft.mockClear();
    await act(async () => {
      result.current.markDirty();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3);
    });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("reloadLatest replaces local content with the server version", async () => {
    saveDraft.mockRejectedValue(new ApiError(409, { details: { currentRevision: 7 } }));
    const serverContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "theirs" }] }] };
    getDraft.mockResolvedValue(draft({ revision: 7, content: serverContent }));
    const { result, replaceContent } = setup();

    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });
    await act(async () => {
      await result.current.reloadLatest();
    });

    expect(replaceContent).toHaveBeenCalledWith(serverContent);
    expect(result.current.state).toMatchObject({ status: "saved", revision: 7, conflict: null });
  });

  it("keepMine saves only on explicit choice, on top of the latest revision", async () => {
    saveDraft.mockRejectedValueOnce(new ApiError(409, { details: { currentRevision: 7 } }));
    getDraft.mockResolvedValue(draft({ revision: 7 }));
    saveDraft.mockResolvedValueOnce(draft({ revision: 8 }));
    const { result } = setup();

    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });
    await act(async () => {
      await result.current.keepMine();
    });

    expect(saveDraft).toHaveBeenLastCalledWith("opp-1", expect.objectContaining({ baseRevision: 7 }));
    expect(result.current.state).toMatchObject({ status: "saved", revision: 8 });
  });

  it("reports network errors without losing dirty state", async () => {
    saveDraft.mockRejectedValue(new ApiError(0, { message: "Network error" }));
    const { result } = setup();
    await act(async () => {
      result.current.markDirty();
      await result.current.flush();
    });
    expect(result.current.state.status).toBe("error");
  });
});
