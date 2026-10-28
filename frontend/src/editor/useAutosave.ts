// Autosave (architecture.md, "Undo vs autosave" and "Races / two tabs").
// - saves ~1 s after the last change, sending the revision it started from
// - network or server trouble: "Reconnecting…", retries with growing waits
// - another tab saved first, design gone, content refused, logged out:
//   stops and says so; retrying could never succeed
// - leaving the editor saves once more; closing the tab with unsaved
//   changes asks first
import { useEffect, useRef } from "react";
import { api, ConflictError, NotFoundError, SignedOutError, ValidationError } from "../data";
import type { EditorStore, SaveState } from "./store";

const DEBOUNCE_MS = 1000;
const MAX_WAIT_MS = 30_000;

export function useAutosave(store: EditorStore) {
  const run = useRef({
    savedEdits: 0,
    inFlight: null as Promise<void> | null,
    timer: undefined as number | undefined,
    attempt: 0,
    stopped: false,
  });

  useEffect(() => {
    const r = run.current;

    const stop = (save: SaveState) => {
      r.stopped = true;
      store.getState().setSave(save);
    };

    const schedule = (ms: number) => {
      window.clearTimeout(r.timer);
      r.timer = window.setTimeout(() => void saveNow(), ms);
    };

    const saveNow = async () => {
      const s = store.getState();
      if (r.stopped || r.inFlight || s.readOnly || s.edits === r.savedEdits) return;
      const editsAtStart = s.edits;
      s.setSave({ kind: "saving" });
      r.inFlight = (async () => {
        try {
          const saved = await api.saveContent(s.design.id, s.content, s.revision);
          r.attempt = 0;
          r.savedEdits = editsAtStart;
          store.getState().setRevision(saved.revision);
        } catch (err) {
          if (err instanceof ConflictError) stop({ kind: "conflict" });
          else if (err instanceof NotFoundError) stop({ kind: "gone" });
          else if (err instanceof SignedOutError) stop({ kind: "signed-out" });
          else if (err instanceof ValidationError) stop({ kind: "refused", message: err.message });
          else {
            r.attempt += 1;
            store.getState().setSave({ kind: "retrying" });
            schedule(Math.min(1000 * 2 ** r.attempt, MAX_WAIT_MS));
          }
        }
      })();
      await r.inFlight;
      r.inFlight = null;
      if (r.stopped) return;
      const now = store.getState();
      if (now.edits !== r.savedEdits) {
        // changed while saving: save again (unless a retry is already waiting)
        if (r.attempt === 0) schedule(DEBOUNCE_MS);
      } else {
        now.setSave({ kind: "saved" });
      }
    };

    const unsubscribe = store.subscribe((s, prev) => {
      if (s.edits === prev.edits) return;
      if (r.attempt === 0) schedule(DEBOUNCE_MS);
      // until the save lands the edit only lives in this tab, so never show "Saved" in the meantime (BUG-006)
      if (!r.stopped && s.save.kind === "saved") s.setSave({ kind: "saving" });
    });

    // "save now and wait" (e.g. before moving the design to Trash), after any save in flight
    store.setState({
      flush: async () => {
        window.clearTimeout(r.timer);
        if (r.inFlight) await r.inFlight;
        r.attempt = 0;
        await saveNow();
      },
    });

    const warnBeforeClose = (e: BeforeUnloadEvent) => {
      if (!r.stopped && (r.inFlight || store.getState().edits !== r.savedEdits)) e.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeClose);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", warnBeforeClose);
      window.clearTimeout(r.timer);
      // leaving the editor (e.g. the Home button): save what's left, after any save in flight
      void (r.inFlight ?? Promise.resolve()).then(() => {
        r.attempt = 0;
        return saveNow();
      });
    };
  }, [store]);
}
