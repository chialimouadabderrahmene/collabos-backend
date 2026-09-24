"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi, type Draft, type JsonDocument } from "@/lib/api/opportunities";
import { DOCUMENT_FORMAT, DOCUMENT_SCHEMA_VERSION } from "./document-model";

/* ------------------------------------------------------ state machine */

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export interface ConflictInfo {
  /** Revision currently on the server (from the 409 `details`). */
  currentRevision: number | null;
  /** The server's draft, loaded so the user can see what changed. */
  serverDraft: Draft | null;
}

export interface AutosaveState {
  status: SaveStatus;
  revision: number;
  lastSavedAt: Date | null;
  error: string | null;
  conflict: ConflictInfo | null;
}

export type AutosaveAction =
  | { type: "edit" }
  | { type: "save-start" }
  | { type: "save-success"; revision: number; at: Date; stillDirty: boolean }
  | { type: "save-error"; message: string }
  | { type: "conflict"; conflict: ConflictInfo }
  | { type: "resolved"; revision: number; at: Date };

export function autosaveReducer(state: AutosaveState, action: AutosaveAction): AutosaveState {
  switch (action.type) {
    case "edit":
      // While a conflict is open, edits stay local; nothing is sent.
      return state.status === "conflict" ? state : { ...state, status: "dirty", error: null };
    case "save-start":
      return { ...state, status: "saving" };
    case "save-success":
      return {
        ...state,
        status: action.stillDirty ? "dirty" : "saved",
        revision: action.revision,
        lastSavedAt: action.at,
        error: null,
      };
    case "save-error":
      return { ...state, status: "error", error: action.message };
    case "conflict":
      return { ...state, status: "conflict", conflict: action.conflict };
    case "resolved":
      return {
        ...state,
        status: "saved",
        revision: action.revision,
        lastSavedAt: action.at,
        conflict: null,
        error: null,
      };
    default:
      return state;
  }
}

/* ------------------------------------------------------------- hook */

export const AUTOSAVE_DELAY_MS = 1200;

interface Options {
  opportunityId: string;
  initialRevision: number;
  /** Returns the editor's current JSON document. */
  getContent: () => JsonDocument;
  /** Replaces the editor content without triggering another save. */
  replaceContent: (content: JsonDocument) => void;
  enabled: boolean;
  onSaved?: (draft: Draft) => void;
}

export function useDraftAutosave({
  opportunityId,
  initialRevision,
  getContent,
  replaceContent,
  enabled,
  onSaved,
}: Options) {
  const initial: AutosaveState = {
    status: "idle",
    revision: initialRevision,
    lastSavedAt: null,
    error: null,
    conflict: null,
  };
  const [state, dispatchState] = useReducer(autosaveReducer, initial);

  // The latest state, updated synchronously on every action. Async code
  // (after awaits) must read this, never the render-time `state`.
  const stateRef = useRef<AutosaveState>(initial);
  const dispatch = useCallback((action: AutosaveAction) => {
    stateRef.current = autosaveReducer(stateRef.current, action);
    dispatchState(action);
  }, []);
  const currentStatus = (): SaveStatus => stateRef.current.status;

  const revisionRef = useRef(initialRevision);
  const inFlight = useRef<Promise<void> | null>(null);
  const dirtySinceSend = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persists the current document once. Resolves when that save settles. */
  const saveOnce = useCallback(async (): Promise<void> => {
    dirtySinceSend.current = false;
    dispatch({ type: "save-start" });
    try {
      const draft = await opportunitiesApi.saveDraft(opportunityId, {
        format: DOCUMENT_FORMAT,
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        content: getContent(),
        baseRevision: revisionRef.current,
      });
      revisionRef.current = draft.revision;
      dispatch({
        type: "save-success",
        revision: draft.revision,
        at: new Date(draft.updatedAt),
        stillDirty: dirtySinceSend.current,
      });
      onSaved?.(draft);
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        const currentRevision =
          typeof error.details?.currentRevision === "number" ? error.details.currentRevision : null;
        const serverDraft = await opportunitiesApi.getDraft(opportunityId).catch(() => null);
        dispatch({ type: "conflict", conflict: { currentRevision, serverDraft } });
      } else {
        dispatch({
          type: "save-error",
          message: error instanceof ApiError ? error.message : "Couldn't save — check your connection.",
        });
      }
    }
  }, [dispatch, getContent, onSaved, opportunityId]);

  /**
   * Single-flight save loop: one request at a time; edits made while a save
   * is in flight trigger exactly one follow-up save. Stops on conflict/error.
   */
  const send = useCallback(async (): Promise<void> => {
    if (!enabled || currentStatus() === "conflict") {
      return;
    }
    if (inFlight.current) {
      dirtySinceSend.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      try {
        do {
          await saveOnce();
        } while (dirtySinceSend.current && currentStatus() === "dirty");
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [enabled, saveOnce]);

  /** Call on every editor change. */
  const markDirty = useCallback(() => {
    if (!enabled) {
      return;
    }
    dispatch({ type: "edit" });
    if (inFlight.current) {
      dirtySinceSend.current = true;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => void send(), AUTOSAVE_DELAY_MS);
  }, [dispatch, enabled, send]);

  /** Saves immediately (before preview/publish). Resolves once persisted. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const before = currentStatus();
    if (before === "dirty" || before === "error") {
      await send();
    } else if (inFlight.current) {
      await inFlight.current;
    }
    const after = currentStatus();
    return after === "saved" || after === "idle";
  }, [send]);

  /** Conflict resolution A: discard local edits, load the server version. */
  const reloadLatest = useCallback(async () => {
    const draft = await opportunitiesApi.getDraft(opportunityId);
    replaceContent(draft.format === "blank" ? { type: "doc", content: [{ type: "paragraph" }] } : draft.content);
    revisionRef.current = draft.revision;
    dispatch({ type: "resolved", revision: draft.revision, at: new Date(draft.updatedAt) });
  }, [dispatch, opportunityId, replaceContent]);

  /** Conflict resolution B (explicit user choice): save my version on top of
   * the latest server revision. */
  const keepMine = useCallback(async () => {
    const latest = await opportunitiesApi.getDraft(opportunityId);
    const draft = await opportunitiesApi.saveDraft(opportunityId, {
      format: DOCUMENT_FORMAT,
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      content: getContent(),
      baseRevision: latest.revision,
    });
    revisionRef.current = draft.revision;
    dispatch({ type: "resolved", revision: draft.revision, at: new Date(draft.updatedAt) });
    onSaved?.(draft);
  }, [dispatch, getContent, onSaved, opportunityId]);

  // Warn before leaving with unsaved or in-flight changes.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (["dirty", "saving", "error", "conflict"].includes(currentStatus())) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return { state, markDirty, flush, reloadLatest, keepMine };
}
