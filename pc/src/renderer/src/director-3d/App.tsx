import "./styles/index.css";
import { useEffect, useState } from "react";
import { Plus, Route, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DirectorDeskShell } from "./app/layout/DirectorDeskShell";
import { DirectorCanvas } from "./editor/canvas/DirectorCanvas";
import { ViewportSensitivitySettings } from "./editor/canvas/ViewportSensitivitySettings";
import {
  clearDirectorDeskHostBridge,
  initDirectorDeskHostBridge,
  setDirectorDeskProjectId,
} from "./editor/io/hostBridge";
import { useDirectorStore } from "./editor/store/directorStore";
import {
  createDirectorDeskRecord,
  ensureDirectorDeskRecordForId,
  ensureDirectorDeskRecords,
  getInitialDirectorDeskId,
  touchDirectorDeskRecord,
  writeActiveDirectorDeskId,
  writeDirectorDeskRecords,
  type DirectorDeskRecord,
} from "./editor/workspaces/directorDeskRegistry";

export interface Director3DAppProps {
  instanceId?: string;
  projectId?: string;
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function App({ instanceId, projectId }: Director3DAppProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewMode = useDirectorStore((state) => state.viewMode);
  const setViewMode = useDirectorStore((state) => state.setViewMode);
  const motionStudioOpen = useDirectorStore((state) => state.motionStudioOpen);
  const setMotionStudioOpen = useDirectorStore((state) => state.setMotionStudioOpen);
  const [directorDeskView, setDirectorDeskView] = useState(() => {
    const records = ensureDirectorDeskRecords();
    const targetId = instanceId?.trim() || getInitialDirectorDeskId(records) || records[0]?.id;
    return {
      records,
      activeDeskId: targetId || createDirectorDeskRecord(records, t("director3d.shell.defaultDeskName")).id,
    };
  });
  const { records: directorDesks, activeDeskId } = directorDeskView;

  function openDirectorDesk(
    id: string,
    records = directorDesks,
    options: { loadScene?: boolean } = {}
  ) {
    if (!id) return;

    const { loadScene = true } = options;
    const ensured = ensureDirectorDeskRecordForId(records, id);
    const nextRecords = touchDirectorDeskRecord(ensured.records, id);
    setDirectorDeskView({ records: nextRecords, activeDeskId: id });
    writeActiveDirectorDeskId(id);
    if (loadScene) {
      useDirectorStore.getState().openScopedScene(id);
    }
  }

  useEffect(() => {
    setDirectorDeskProjectId(projectId ?? null);
    return () => {
      setDirectorDeskProjectId(null);
      clearDirectorDeskHostBridge();
    };
  }, [projectId]);

  useEffect(() => {
    initDirectorDeskHostBridge();
    openDirectorDesk(activeDeskId, directorDesks);
  }, []);

  function handleCreateDesk() {
    const record = createDirectorDeskRecord(directorDesks, t("director3d.shell.defaultDeskName"));
    const nextRecords = [...directorDesks, record];
    writeDirectorDeskRecords(nextRecords);
    openDirectorDesk(record.id, nextRecords);
  }

  function handleClose() {
    navigate({ to: ".." });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.repeat) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        useDirectorStore.getState().copySelectedObjects();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        useDirectorStore.getState().pasteClipboardObjects();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        useDirectorStore.getState().undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <button className="top-bar-title top-bar-home-button" type="button" onClick={handleClose}>
            {t("director3d.shell.title")}
          </button>
          <div className="director-desk-switcher" aria-label={t("director3d.shell.selectDesk")}>
            <select
              className="director-desk-select"
              aria-label={t("director3d.shell.selectDesk")}
              value={activeDeskId}
              onChange={(event) => openDirectorDesk(event.currentTarget.value)}
            >
              {directorDesks.map((desk) => (
                <option key={desk.id} value={desk.id}>
                  {desk.name}
                </option>
              ))}
            </select>
            <button className="director-desk-create-button" type="button" onClick={handleCreateDesk}>
              <Plus aria-hidden="true" size={14} strokeWidth={1.9} />
              {t("director3d.shell.newDesk")}
            </button>
          </div>
        </div>
        <div className="top-bar-center">
          <div className="mode-toggle ui-segmented" role="group" aria-label={t("director3d.shell.viewMode")}>
            <button
              className={`mode-toggle-button ui-segmented-item ${viewMode === "director" ? "ui-segmented-item-active" : ""}`}
              aria-pressed={viewMode === "director"}
              type="button"
              onClick={() => setViewMode("director")}
            >
              {t("director3d.shell.directorView")}
            </button>
            <button
              className={`mode-toggle-button ui-segmented-item ${viewMode === "camera" ? "ui-segmented-item-active" : ""}`}
              aria-label={t("director3d.shell.cameraView")}
              aria-pressed={viewMode === "camera"}
              title={t("director3d.shell.cameraViewTitle")}
              type="button"
              onClick={() => setViewMode("camera")}
            >
              {t("director3d.shell.cameraView")}
            </button>
          </div>
          <button
            className={`top-bar-motion-button${motionStudioOpen ? " is-active" : ""}`}
            type="button"
            aria-label={motionStudioOpen ? t("director3d.shell.closeMotion") : t("director3d.shell.openMotion")}
            aria-pressed={motionStudioOpen}
            onClick={() => {
              setViewMode("director");
              setMotionStudioOpen(!motionStudioOpen);
            }}
          >
            <Route aria-hidden="true" size={15} />
            {t("director3d.shell.motion")}
          </button>
          <ViewportSensitivitySettings />
        </div>
        <div className="top-bar-actions">
          <button
            className="top-bar-action-button"
            type="button"
            aria-label={t("director3d.shell.close")}
            title={t("director3d.shell.close")}
            onClick={handleClose}
          >
            <X aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>
      <DirectorDeskShell>
        <DirectorCanvas />
      </DirectorDeskShell>
    </div>
  );
}
