import { useState } from "react";
import { useTranslation } from "react-i18next";
import { requestViewportCapture } from "../io/captureBridge";
import { serializeProject } from "../io/exportProjectJson";
import { parseProject } from "../io/importProjectJson";
import {
  buildCaptureFileName,
  DEFAULT_SCREENSHOT_FILE_NAME_BASE,
} from "../io/screenshotExport";
import {
  DEFAULT_CAPTURE_FALLBACK_FILE_NAME_BASE,
  postDirectorDeskCapturesToHost,
} from "../io/hostBridge";
import { getDirector3dErrorMessage } from "../io/errorMessages";
import { summarizeCaptureResults } from "../io/captureResult";
import { useDirectorStore } from "../store/directorStore";
import { CapturePreviewModal } from "./CapturePreviewModal";

export function CapturePanel() {
  const { t } = useTranslation();
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [previewCaptures, setPreviewCaptures] = useState<Array<{ dataUrl: string; fileName: string; error?: string }>>([]);
  const project = useDirectorStore((state) => state.project);
  const replaceProject = useDirectorStore((state) => state.replaceProject);
  const saveLatestSnapshot = useDirectorStore((state) => state.saveLatestSnapshot);
  const restoreLatestSnapshot = useDirectorStore((state) => state.restoreLatestSnapshot);

  async function handleCapture(preset: "current" | "four" | "twelve") {
    setCaptureStatus(null);
    try {
      const results = await requestViewportCapture({
        preset,
        source: "capture-panel",
      });
      const captures = results.map((result, index) => ({
        dataUrl: result.dataUrl,
        fileName: buildCaptureFileName(result, DEFAULT_SCREENSHOT_FILE_NAME_BASE, index),
      }));
      const saved = await postDirectorDeskCapturesToHost(
        captures,
        DEFAULT_CAPTURE_FALLBACK_FILE_NAME_BASE
      );
      const summary = summarizeCaptureResults(saved, t);
      setPreviewCaptures(summary.previewCaptures);
      setCaptureStatus(summary.status);
    } catch (error) {
      setCaptureStatus(getDirector3dErrorMessage(error, t));
    }
  }

  return (
    <section className="panel-card">
      <h2>{t("director3d.captures")}</h2>
      <button className="capture-action" type="button" onClick={() => void handleCapture("current")}>
        {t("director3d.capture.currentView")}
      </button>
      <button className="capture-action" type="button" onClick={() => void handleCapture("four")}>
        {t("director3d.capture.fourView")}
      </button>
      <button className="capture-action" type="button" onClick={() => void handleCapture("twelve")}>
        {t("director3d.capture.twelveView")}
      </button>
      {captureStatus ? <p className="capture-status">{captureStatus}</p> : null}
      <button
        className="capture-action"
        type="button"
        onClick={() => {
          const blob = new Blob([serializeProject(project)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
        }}
      >
        {t("director3d.capture.exportProjectJson")}
      </button>
      <input
        className="ui-field"
        aria-label={t("director3d.capture.importProjectJson")}
        accept="application/json"
        type="file"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          replaceProject(parseProject(await file.text()));
        }}
      />
      <button className="capture-action" type="button" onClick={saveLatestSnapshot}>
        {t("director3d.capture.saveLatestSnapshot")}
      </button>
      <button className="capture-action" type="button" onClick={restoreLatestSnapshot}>
        {t("director3d.capture.restoreLatestSnapshot")}
      </button>
      <CapturePreviewModal
        isOpen={previewCaptures.length > 0}
        captures={previewCaptures}
        onClose={() => setPreviewCaptures([])}
      />
    </section>
  );
}
