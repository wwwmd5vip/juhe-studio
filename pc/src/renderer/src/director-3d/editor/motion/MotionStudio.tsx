import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Download,
  Gauge,
  MousePointer2,
  Move3D,
  Pause,
  Play,
  Plus,
  Route,
  SlidersHorizontal,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { requestReferenceVideoExport, type ReferenceVideoExportQuality } from "../io/referenceVideoExport";
import { getCameraMotionPath } from "../schema/cameraMotion";
import {
  getAnimatedCameraFocusTarget,
  getDirectorObjectFocusTarget,
  isCameraFocusableObject,
} from "../schema/cameraTarget";
import { getObjectMotionSnapshot } from "../schema/objectMotion";
import type { CameraShotSnapshot } from "../store/directorStore";
import { useDirectorStore } from "../store/directorStore";
import {
  CAMERA_MOTION_PRESETS,
  findMatchingCameraMotionPreset,
  getCameraMotionPresetPatch,
} from "./cameraMotionPresets";

export function getActiveCameraWaypointIndex(progress: number, times: number[]) {
  if (times.length === 0) return -1;
  let active = 0;
  for (let index = 1; index < times.length; index += 1) {
    if (progress + 0.0001 < times[index]) break;
    active = index;
  }
  return active;
}

export function MotionStudio({
  getViewportCameraSnapshot,
  onLoadCameraSnapshot,
  onStartPilot,
}: {
  getViewportCameraSnapshot: () => CameraShotSnapshot;
  onLoadCameraSnapshot?: (snapshot: CameraShotSnapshot) => void;
  onStartPilot?: (editKeyframeId?: string | null) => void;
}) {
  const { t } = useTranslation();
  const open = useDirectorStore((state) => state.motionStudioOpen);
  const viewMode = useDirectorStore((state) => state.viewMode);
  const cameraPilotMode = useDirectorStore((state) => state.cameraPilotMode);
  const activeCamera = useDirectorStore((state) =>
    state.project.cameras.find((item) => item.id === state.project.activeCameraId) ?? state.project.cameras[0]
  );
  const selectedCameraKeyframeId = useDirectorStore((state) => state.selectedCameraKeyframeId);
  const selectedCameraKeyframeIds = useDirectorStore((state) => state.selectedCameraKeyframeIds);
  const cameraMotionProgress = useDirectorStore((state) => state.cameraMotionProgress);
  const cameraMotionPlaying = useDirectorStore((state) => state.cameraMotionPlaying);
  const cameraPilotFollowTarget = useDirectorStore((state) => state.cameraPilotFollowTarget);
  const sceneObjects = useDirectorStore((state) => state.project.objects);
  const setMotionStudioOpen = useDirectorStore((state) => state.setMotionStudioOpen);
  const setViewMode = useDirectorStore((state) => state.setViewMode);
  const ensureMotionCamera = useDirectorStore((state) => state.ensureMotionCamera);
  const startCameraPilot = useDirectorStore((state) => state.startCameraPilot);
  const recordCameraMotionSnapshot = useDirectorStore((state) => state.recordCameraMotionSnapshot);
  const selectCameraMotionKeyframe = useDirectorStore((state) => state.selectCameraMotionKeyframe);
  const setCameraMotionKeyframeSelection = useDirectorStore((state) => state.setCameraMotionKeyframeSelection);
  const setCameraMotionProgress = useDirectorStore((state) => state.setCameraMotionProgress);
  const setCameraMotionPlaying = useDirectorStore((state) => state.setCameraMotionPlaying);
  const updateCameraMotionPath = useDirectorStore((state) => state.updateCameraMotionPath);
  const updateCameraMotionKeyframe = useDirectorStore((state) => state.updateCameraMotionKeyframe);
  const deleteCameraMotionKeyframe = useDirectorStore((state) => state.deleteCameraMotionKeyframe);
  const moveCameraMotionKeyframe = useDirectorStore((state) => state.moveCameraMotionKeyframe);
  const insertCameraMotionKeyframeAfter = useDirectorStore((state) => state.insertCameraMotionKeyframeAfter);
  const setCameraPilotFollowTarget = useDirectorStore((state) => state.setCameraPilotFollowTarget);
  const beginUndoBatch = useDirectorStore((state) => state.beginUndoBatch);
  const endUndoBatch = useDirectorStore((state) => state.endUndoBatch);
  const [batchSelectionEnabled, setBatchSelectionEnabled] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFps, setExportFps] = useState(30);
  const [exportQuality, setExportQuality] = useState<ReferenceVideoExportQuality>("720p");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [arrivalTimeDraft, setArrivalTimeDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    ensureMotionCamera(getViewportCameraSnapshot());
  }, [ensureMotionCamera, open]);

  const activeMotionPath = activeCamera ? getCameraMotionPath(activeCamera) : null;
  const activeSelectedKeyframe = activeMotionPath?.keyframes.find((item) => item.id === selectedCameraKeyframeId) ?? null;

  useEffect(() => {
    setArrivalTimeDraft(
      activeSelectedKeyframe && activeMotionPath
        ? (activeSelectedKeyframe.time * activeMotionPath.duration).toFixed(1)
        : ""
    );
  }, [activeMotionPath?.duration, activeSelectedKeyframe?.id, activeSelectedKeyframe?.time]);

  if (!open || !activeCamera) return null;

  const motionPath = activeMotionPath!;
  const trackableObjects = sceneObjects.filter(isCameraFocusableObject);
  const canPlay = motionPath.keyframes.length >= 2 || sceneObjects.some((item) => (item.motionPath?.keyframes?.length ?? 0) >= 2);
  const selectedKeyframe = motionPath.keyframes.find((item) => item.id === selectedCameraKeyframeId) ?? null;
  const trackingObjectId = selectedKeyframe?.targetMode === "object"
    ? selectedKeyframe.targetObjectId ?? ""
    : "";
  const matchingPreset = findMatchingCameraMotionPreset(motionPath);
  const activeIndex = getActiveCameraWaypointIndex(
    cameraMotionProgress,
    motionPath.keyframes.map((item) => item.time)
  );
  const timelinePreviewActive = cameraMotionPlaying || cameraMotionProgress > 0.0001;

  function addCurrentView() {
    recordCameraMotionSnapshot(activeCamera.id, getViewportCameraSnapshot());
  }

  function selectWaypoint(id: string, time: number) {
    if (batchSelectionEnabled) {
      const nextSelection = selectedCameraKeyframeIds.includes(id)
        ? selectedCameraKeyframeIds.filter((item) => item !== id)
        : [...selectedCameraKeyframeIds, id];
      setCameraMotionKeyframeSelection(nextSelection);
      if (nextSelection.includes(id)) setCameraMotionProgress(time);
      return;
    }
    selectCameraMotionKeyframe(id);
    setCameraMotionProgress(time);
    setCameraMotionPlaying(false);
  }

  function toggleBatchSelection() {
    if (batchSelectionEnabled) {
      selectCameraMotionKeyframe(selectedCameraKeyframeId);
      setBatchSelectionEnabled(false);
      return;
    }
    setBatchSelectionEnabled(true);
  }

  function setTrackingObject(objectId: string) {
    if (!selectedKeyframe) return;
    if (!objectId) {
      const currentTrackingTarget = getAnimatedCameraFocusTarget(
        activeCamera,
        sceneObjects,
        selectedKeyframe.time
      );
      updateCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id, {
        targetMode: "manual",
        targetObjectId: null,
        target: currentTrackingTarget ?? selectedKeyframe.target,
      });
      return;
    }

    const targetObject = trackableObjects.find((object) => object.id === objectId);
    if (!targetObject) return;
    const target = getDirectorObjectFocusTarget({
      ...targetObject,
      transform: getObjectMotionSnapshot(targetObject, selectedKeyframe.time),
    });
    updateCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id, {
      targetMode: "object",
      targetObjectId: targetObject.id,
      target,
    });
  }

  function applyMotionPreset(presetId: string) {
    const patch = getCameraMotionPresetPatch(presetId);
    if (patch) updateCameraMotionPath(activeCamera.id, patch);
  }

  function editSelectedWaypoint() {
    if (!selectedKeyframe) return;
    onLoadCameraSnapshot?.({
      position: [...selectedKeyframe.position],
      target: [...selectedKeyframe.target],
      fov: selectedKeyframe.fov,
    });
    if (onStartPilot) {
      onStartPilot(selectedKeyframe.id);
    } else {
      startCameraPilot("pilot", selectedKeyframe.id);
    }
  }

  function previewInView(mode: "director" | "camera") {
    if (!canPlay) return;
    if (cameraMotionPlaying && viewMode === mode) {
      setCameraMotionPlaying(false);
      return;
    }

    setViewMode(mode);
    if (cameraMotionProgress >= 0.999) setCameraMotionProgress(0);
    setCameraMotionPlaying(true);
  }

  function updateSelectedArrivalTime(seconds: number) {
    if (!selectedKeyframe) return;
    const index = motionPath.keyframes.indexOf(selectedKeyframe);
    if (index <= 0 || index >= motionPath.keyframes.length - 1) return;
    const previous = motionPath.keyframes[index - 1];
    const next = motionPath.keyframes[index + 1];
    const minimum = previous.time * motionPath.duration + 0.1;
    const maximum = next.time * motionPath.duration - 0.1;
    const clamped = Math.min(maximum, Math.max(minimum, seconds));
    updateCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id, {
      time: clamped / motionPath.duration,
    });
    setCameraMotionProgress(clamped / motionPath.duration);
    setArrivalTimeDraft(clamped.toFixed(1));
  }

  function commitArrivalTimeDraft() {
    const seconds = Number(arrivalTimeDraft);
    if (Number.isFinite(seconds)) updateSelectedArrivalTime(seconds);
    else if (selectedKeyframe) setArrivalTimeDraft((selectedKeyframe.time * motionPath.duration).toFixed(1));
  }

  async function exportReferenceVideo() {
    if (motionPath.keyframes.length < 2 || exporting) return;
    setExporting(true);
    setExportStatus(t("director3d.motion.recording") + "...");
    try {
      await requestReferenceVideoExport({
        fileName: `${t("director3d.motion.referenceVideoFileName", { name: activeCamera.name || t("director3d.motion.motion") })}.webm`,
        fps: exportFps,
        quality: exportQuality,
      });
      setExportStatus(t("director3d.motion.referenceVideoDownloaded"));
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? (error.message === "DIRECTOR3D_REF_VIDEO_NOT_READY"
              ? t("director3d.error.refVideoNotReady")
              : error.message)
          : t("director3d.motion.referenceVideoExportFailed")
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={`motion-studio${cameraPilotMode !== "idle" ? " is-piloting" : ""}`} aria-label={t("director3d.shell.motionWorkbench")}>
      <header className="motion-studio-header">
        <div className="motion-studio-heading">
          <span className="motion-studio-icon"><Route aria-hidden="true" size={17} /></span>
          <div>
            <h2>{t("director3d.shell.motionWorkbench")}</h2>
            <p>{t("director3d.motion.subtitle")}</p>
          </div>
        </div>
        <div className="motion-studio-header-actions">
          <button type="button" className="motion-studio-export" aria-label={t("director3d.motion.export")} aria-expanded={exportOpen} onClick={() => setExportOpen((current) => !current)}>
            <Download aria-hidden="true" size={14} />{t("director3d.motion.export")}
          </button>
          <button type="button" className="motion-studio-close" aria-label={t("director3d.motion.close")} onClick={() => setMotionStudioOpen(false)}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      </header>

      {exportOpen ? (
        <section className="motion-export-panel" aria-label={t("director3d.motion.exportSettings")}>
          <div><strong>{t("director3d.motion.exportReferenceVideo")}</strong><small>{t("director3d.motion.exportDescription")}</small></div>
          <label><span>{t("director3d.motion.quality")}</span><select aria-label={t("director3d.motion.quality")} value={exportQuality} onChange={(event) => setExportQuality(event.currentTarget.value as ReferenceVideoExportQuality)}><option value="720p">{t("director3d.motion.quality720p")}</option><option value="1080p">{t("director3d.motion.quality1080p")}</option></select></label>
          <label><span>{t("director3d.motion.frameRate")}</span><select aria-label={t("director3d.motion.frameRate")} value={exportFps} onChange={(event) => setExportFps(Number(event.currentTarget.value))}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
          <button type="button" className="motion-export-confirm" disabled={motionPath.keyframes.length < 2 || exporting} onClick={() => void exportReferenceVideo()}><Download aria-hidden="true" size={14} />{exporting ? t("director3d.motion.recording") : t("director3d.motion.exportWebM")}</button>
          {exportStatus ? <output className="motion-export-status" role="status">{exportStatus}</output> : null}
        </section>
      ) : null}

      <section className="motion-preview-panel" aria-label={t("director3d.motion.previewMode")}>
        <div className="motion-block-heading">
          <strong>{t("director3d.motion.previewQuestion")}</strong>
          <small>{t("director3d.motion.previewHint")}</small>
        </div>
        <div className="motion-preview-options">
          <button
            type="button"
            className={`motion-preview-option is-director${viewMode === "director" ? " is-active" : ""}`}
            disabled={!canPlay}
            aria-label={cameraMotionPlaying && viewMode === "director" ? t("director3d.motion.pause") : t("director3d.motion.previewDirector")}
            aria-pressed={viewMode === "director"}
            onClick={() => previewInView("director")}
          >
            <Route aria-hidden="true" size={17} />
            <span><strong>{cameraMotionPlaying && viewMode === "director" ? t("director3d.motion.pause") : t("director3d.motion.previewDirector")}</strong><small>{t("director3d.motion.previewDirectorHint")}</small></span>
            {cameraMotionPlaying && viewMode === "director" ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
          </button>
          <button
            type="button"
            className={`motion-preview-option is-camera${viewMode === "camera" ? " is-active" : ""}`}
            disabled={!canPlay}
            aria-label={cameraMotionPlaying && viewMode === "camera" ? t("director3d.motion.pause") : t("director3d.motion.previewCamera")}
            aria-pressed={viewMode === "camera"}
            onClick={() => previewInView("camera")}
          >
            <Video aria-hidden="true" size={17} />
            <span><strong>{cameraMotionPlaying && viewMode === "camera" ? t("director3d.motion.pause") : t("director3d.motion.previewCamera")}</strong><small>{t("director3d.motion.previewCameraHint")}</small></span>
            {cameraMotionPlaying && viewMode === "camera" ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
          </button>
        </div>
      </section>

      <div className="motion-studio-body">
        <div className="motion-studio-primary-actions">
          <div className="motion-block-heading">
            <strong>{t("director3d.motion.createShot")}</strong>
            <small>{t("director3d.motion.createShotHint")}</small>
          </div>
          <button
            type="button"
            className="motion-primary-button"
            aria-label={t("director3d.motion.startPilot")}
            onClick={() => onStartPilot ? onStartPilot(null) : startCameraPilot("pilot")}
          >
            <MousePointer2 aria-hidden="true" size={17} />
            <span><strong>{t("director3d.motion.startPilot")}</strong><small>{t("director3d.motion.startPilotHint")}</small></span>
          </button>
          <button type="button" className="motion-add-current" aria-label={t("director3d.motion.addCurrentView")} onClick={addCurrentView}>
            <Plus aria-hidden="true" size={16} />
            {t("director3d.motion.addCurrentView")}
          </button>
        </div>

        <div className="motion-key-help" aria-label={t("director3d.pilot.keyboardHelp")}>
          <span><kbd>WASD</kbd><small>{t("director3d.pilot.move")}</small></span>
          <span><kbd>E</kbd><small>{t("director3d.pilot.ascendDescend")}</small></span>
          <span><kbd>Q</kbd><small>{t("director3d.pilot.ascendDescend")}</small></span>
          <span><kbd>{t("director3d.common.spaceKey")}</kbd><small>{t("director3d.pilot.playPause")}</small></span>
          <span><kbd>{t("director3d.common.mouse")}</kbd><small>{t("director3d.pilot.look")}</small></span>
          <span><kbd>F</kbd><small>{t("director3d.pilot.lockSubject")}</small></span>
          <span><kbd>Enter</kbd><small>{t("director3d.pilot.record")}</small></span>
        </div>

        <div className="motion-route-column">
          <div className="motion-route-title">
            <div><Video aria-hidden="true" size={15} /><strong>{t("director3d.motion.route")}</strong><span>{t("director3d.motion.routePoints", { count: motionPath.keyframes.length })}</span></div>
            {motionPath.keyframes.length > 0 ? (
              <button
                type="button"
                className={batchSelectionEnabled ? "is-active" : undefined}
                aria-label={t("director3d.motion.batchSelectHint")}
                aria-pressed={batchSelectionEnabled}
                onClick={toggleBatchSelection}
              >
                <Move3D aria-hidden="true" size={13} />
                {t("director3d.motion.batchMove")}
              </button>
            ) : null}
          </div>

          {batchSelectionEnabled ? (
            <div className="motion-batch-selection" aria-label={t("director3d.motion.batchSelectHint")}>
              <span>{t("director3d.motion.selectedCount", { count: selectedCameraKeyframeIds.length })}</span>
              <small>{t("director3d.motion.batchTip")}</small>
              <button
                type="button"
                aria-label={t("director3d.motion.selectAll")}
                onClick={() => setCameraMotionKeyframeSelection(motionPath.keyframes.map((item) => item.id))}
              >{t("director3d.motion.selectAll")}</button>
              <button
                type="button"
                aria-label={t("director3d.motion.clearSelection")}
                onClick={() => setCameraMotionKeyframeSelection([])}
              >{t("director3d.motion.clearSelection")}</button>
            </div>
          ) : null}

          {motionPath.keyframes.length === 0 ? (
            <div className="motion-route-empty" role="status">
              <Route aria-hidden="true" size={20} />
              <span>{t("director3d.motion.noWaypoints")}</span>
              <small>{t("director3d.motion.noWaypointsHint")}</small>
            </div>
          ) : (
            <div className="motion-waypoint-strip" role="list" aria-label={t("director3d.motion.waypoint")}>
              {motionPath.keyframes.map((keyframe, index) => {
                const selected = selectedKeyframe?.id === keyframe.id;
                const reached = timelinePreviewActive && index <= activeIndex;
                const approaching = timelinePreviewActive && index === activeIndex + 1;
                const trackedObjectName = keyframe.targetMode === "object"
                  ? sceneObjects.find((object) => object.id === keyframe.targetObjectId)?.name ?? null
                  : null;
                return (
                  <div className="motion-waypoint-wrap" key={keyframe.id} role="listitem">
                    {index > 0 ? (
                      <span className="motion-waypoint-link-wrap">
                        <span className={`motion-waypoint-link${timelinePreviewActive && index <= activeIndex ? " is-lit" : ""}`} />
                        <button
                          type="button"
                          className="motion-waypoint-insert"
                          aria-label={t("director3d.motion.waypointInsert", { from: index, to: index + 1 })}
                          title={t("director3d.motion.waypointInsertTitle", { from: index, to: index + 1 })}
                          onClick={() => {
                            setBatchSelectionEnabled(false);
                            insertCameraMotionKeyframeAfter(activeCamera.id, motionPath.keyframes[index - 1].id);
                          }}
                        >
                          <Plus aria-hidden="true" size={11} />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`motion-waypoint${(batchSelectionEnabled ? selectedCameraKeyframeIds.includes(keyframe.id) : selected) ? " is-selected" : ""}${reached ? " is-reached" : ""}${approaching ? " is-approaching" : ""}${trackedObjectName ? " has-tracking" : ""}`}
                      aria-label={t(batchSelectionEnabled ? "director3d.motion.batchSelectWaypoint" : "director3d.motion.selectWaypoint", { index: index + 1 })}
                      aria-pressed={batchSelectionEnabled ? selectedCameraKeyframeIds.includes(keyframe.id) : selected}
                      title={trackedObjectName ? t("director3d.motion.waypointTracking", { index: index + 1, name: trackedObjectName }) : t("director3d.motion.waypointTitle", { index: index + 1 })}
                      onClick={() => selectWaypoint(keyframe.id, keyframe.time)}
                    >
                      <span>{index + 1}</span>
                      <small>{(keyframe.time * motionPath.duration).toFixed(1)}{t("director3d.motion.seconds")}{trackedObjectName ? t("director3d.motion.waypointFollow") : ""}</small>
                    </button>
                  </div>
                );
              })}
              <button type="button" className="motion-waypoint-add" aria-label={t("director3d.motion.addCurrentView")} onClick={addCurrentView}>
                <Plus aria-hidden="true" size={16} />
              </button>
            </div>
          )}

          {selectedKeyframe && !batchSelectionEnabled ? (
            <div className="motion-selected-actions" aria-label={t("director3d.motion.selectedWaypointActions")}>
              <span>{t("director3d.motion.waypoint")} {motionPath.keyframes.indexOf(selectedKeyframe) + 1}</span>
              {motionPath.keyframes.indexOf(selectedKeyframe) > 0 && motionPath.keyframes.indexOf(selectedKeyframe) < motionPath.keyframes.length - 1 ? (
                <label className="motion-waypoint-arrival">
                  {t("director3d.motion.arrival")}
                  <input
                    aria-label={t("director3d.motion.arrival")}
                    type="number"
                    min={(motionPath.keyframes[motionPath.keyframes.indexOf(selectedKeyframe) - 1].time * motionPath.duration + 0.1).toFixed(1)}
                    max={(motionPath.keyframes[motionPath.keyframes.indexOf(selectedKeyframe) + 1].time * motionPath.duration - 0.1).toFixed(1)}
                    step="0.1"
                    value={arrivalTimeDraft}
                    onChange={(event) => setArrivalTimeDraft(event.currentTarget.value)}
                    onBlur={commitArrivalTimeDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />{t("director3d.motion.seconds")}
                </label>
              ) : null}
              <button type="button" onClick={editSelectedWaypoint}><MousePointer2 aria-hidden="true" size={13} />{t("director3d.motion.editWaypoint")}</button>
              <button
                type="button"
                aria-label={t("director3d.motion.moveUp")}
                disabled={motionPath.keyframes.indexOf(selectedKeyframe) === 0}
                onClick={() => moveCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id, -1)}
              ><ChevronUp aria-hidden="true" size={14} /></button>
              <button
                type="button"
                aria-label={t("director3d.motion.moveDown")}
                disabled={motionPath.keyframes.indexOf(selectedKeyframe) === motionPath.keyframes.length - 1}
                onClick={() => moveCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id, 1)}
              ><ChevronDown aria-hidden="true" size={14} /></button>
              <button type="button" className="is-danger" aria-label={t("director3d.motion.deleteWaypoint")} onClick={() => deleteCameraMotionKeyframe(activeCamera.id, selectedKeyframe.id)}>
                <Trash2 aria-hidden="true" size={14} />
              </button>
            </div>
          ) : batchSelectionEnabled ? (
            <div className="motion-batch-move-hint" role="status">
              <Move3D aria-hidden="true" size={14} />
              {selectedCameraKeyframeIds.length > 0
                ? t("director3d.motion.batchMoveHint")
                : t("director3d.motion.batchMoveSelectHint")}
            </div>
          ) : null}
        </div>

        <div className="motion-settings-column">
          <div className="motion-block-heading">
            <strong>{t("director3d.motion.details")}</strong>
            <small>{t("director3d.motion.detailsHint")}</small>
          </div>
          <label className="motion-setting-row motion-preset-row">
            <span><SlidersHorizontal aria-hidden="true" size={14} />{t("director3d.motion.preset")}</span>
            <select
              className="motion-tracking-select"
              aria-label={t("director3d.motion.preset")}
              value={matchingPreset?.id ?? "custom"}
              onChange={(event) => applyMotionPreset(event.currentTarget.value)}
            >
              <option value="custom" disabled>{t("director3d.motion.presetCustom")}</option>
              {CAMERA_MOTION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <small className="motion-tracking-status">
              {matchingPreset?.description ?? t("director3d.motion.presetHint")}
            </small>
          </label>
          <label className="motion-setting-row">
            <span><Gauge aria-hidden="true" size={14} />{t("director3d.motion.duration")}</span>
            <input
              aria-label={t("director3d.motion.duration")}
              type="range"
              min="0.5"
              max="30"
              step="0.5"
              value={motionPath.duration}
              onPointerDown={beginUndoBatch}
              onPointerUp={endUndoBatch}
              onPointerCancel={endUndoBatch}
              onBlur={endUndoBatch}
              onChange={(event) => updateCameraMotionPath(activeCamera.id, { duration: Number(event.currentTarget.value) })}
            />
            <output>{motionPath.duration.toFixed(1)}{t("director3d.motion.seconds")}</output>
          </label>
          <div className="motion-setting-row">
            <span><SlidersHorizontal aria-hidden="true" size={14} />{t("director3d.motion.interpolation")}</span>
            <div className="motion-mini-segmented" role="group" aria-label={t("director3d.motion.interpolation")}>
              <button type="button" aria-pressed={motionPath.interpolation === "smooth"} onClick={() => updateCameraMotionPath(activeCamera.id, { interpolation: "smooth" })}>{t("director3d.motion.interpolationSmooth")}</button>
              <button type="button" aria-pressed={motionPath.interpolation === "linear"} onClick={() => updateCameraMotionPath(activeCamera.id, { interpolation: "linear" })}>{t("director3d.motion.interpolationLinear")}</button>
            </div>
          </div>
          <div className="motion-setting-row">
            <span><ArrowUp aria-hidden="true" size={14} /><ArrowDown aria-hidden="true" size={14} />{t("director3d.motion.easing")}</span>
            <div className="motion-mini-segmented" role="group" aria-label={t("director3d.motion.easing")}>
              <button type="button" aria-pressed={motionPath.easing === "ease-in-out"} onClick={() => updateCameraMotionPath(activeCamera.id, { easing: "ease-in-out" })}>{t("director3d.motion.easingEaseInOut")}</button>
              <button type="button" aria-pressed={motionPath.easing === "linear"} onClick={() => updateCameraMotionPath(activeCamera.id, { easing: "linear" })}>{t("director3d.motion.easingLinear")}</button>
            </div>
          </div>
          <div className="motion-setting-row">
            <span><MousePointer2 aria-hidden="true" size={14} />{t("director3d.motion.tracking")}</span>
            <select
              className="motion-tracking-select"
              aria-label={t("director3d.motion.tracking")}
              value={trackingObjectId}
              disabled={!selectedKeyframe}
              onChange={(event) => setTrackingObject(event.currentTarget.value)}
            >
              <option value="">{t("director3d.motion.noTracking")}</option>
              {trackableObjects.map((object) => (
                <option key={object.id} value={object.id}>{object.name}</option>
              ))}
            </select>
            <small className="motion-tracking-status">
              {!selectedKeyframe
                ? t("director3d.motion.selectWaypointFirst")
                : trackingObjectId
                  ? t("director3d.motion.trackingActive")
                  : t("director3d.motion.trackingFixed")}
            </small>
          </div>
          <div className="motion-setting-row">
            <span><MousePointer2 aria-hidden="true" size={14} />{t("director3d.motion.lockMode")}</span>
            <div className="motion-mini-segmented" role="group" aria-label={t("director3d.motion.lockMode")}>
              <button
                type="button"
                aria-label={t("director3d.motion.lookAt")}
                aria-pressed={!cameraPilotFollowTarget}
                onClick={() => setCameraPilotFollowTarget(false)}
              >{t("director3d.motion.lookAt")}</button>
              <button
                type="button"
                aria-label={t("director3d.motion.follow")}
                aria-pressed={cameraPilotFollowTarget}
                onClick={() => setCameraPilotFollowTarget(true)}
              >{t("director3d.motion.follow")}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
