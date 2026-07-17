import { Camera, Download, Eye, Images, Pause, Play, Plus, Route, Send, Trash2, Waypoints, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  InspectorAxisGroup,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorSection,
  InspectorSelectField,
  InspectorTextField,
} from "./InspectorControls";
import { requestViewportCapture } from "../io/captureBridge";
import {
  buildCaptureFileName,
  DEFAULT_SCREENSHOT_FILE_NAME_BASE,
  downloadDataUrl,
} from "../io/screenshotExport";
import {
  DEFAULT_CAPTURE_FALLBACK_FILE_NAME_BASE,
  postDirectorDeskCapturesToHost,
  type HostCaptureItem,
} from "../io/hostBridge";
import { getDirector3dErrorMessage } from "../io/errorMessages";
import { getDirectorObjectFocusTarget, isCameraFocusableObject } from "../schema/cameraTarget";
import type { DirectorCameraCapture, DirectorCameraShot } from "../schema/directorProject";
import type { ScreenshotResult } from "../io/screenshotExport";
import { DEFAULT_CAMERA_MOTION_PATH, getCameraMotionPath } from "../schema/cameraMotion";
import { useDirectorStore } from "../store/directorStore";
import { CapturePreviewModal } from "./CapturePreviewModal";

function getCaptureFileName(
  capture: DirectorCameraCapture,
  camera: DirectorCameraShot,
  fileNameBase: string
) {
  const result: ScreenshotResult = {
    label: capture.name,
    dataUrl: capture.dataUrl,
    meta: {
      mode: "camera",
      cameraId: camera.id,
      fov: camera.fov,
      position: camera.transform.position,
      target: camera.target,
    },
  };
  return buildCaptureFileName(result, fileNameBase, capture.index - 1);
}

const VIEWER_ZOOM_MIN = 0.25;
const VIEWER_ZOOM_MAX = 5;
const VIEWER_ZOOM_STEP = 0.25;
const CAMERA_MOTION_DURATION_MIN = 0.5;
const CAMERA_MOTION_DURATION_MAX = 30;
const CAMERA_MOTION_FOV_MIN = 10;
const CAMERA_MOTION_FOV_MAX = 120;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function CameraPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"properties" | "motion" | "captures">("properties");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [previewCaptures, setPreviewCaptures] = useState<Array<{ dataUrl: string; fileName: string; error?: string }>>([]);
  const [hoveredCaptureId, setHoveredCaptureId] = useState<string | null>(null);
  const [viewerCapture, setViewerCapture] = useState<DirectorCameraCapture | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const [motionDurationDraft, setMotionDurationDraft] = useState("6");
  const [motionFovDraft, setMotionFovDraft] = useState("50");
  const viewerDragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const camera = useDirectorStore((state) =>
    state.project.cameras.find((item) => item.id === state.project.activeCameraId)
  );
  const allCameras = useDirectorStore((state) => state.project.cameras);
  const cameras = useMemo(() => allCameras.filter((item) => !item.isVirtual), [allCameras]);
  const objects = useDirectorStore((state) => state.project.objects);
  const setActiveCamera = useDirectorStore((state) => state.setActiveCamera);
  const addCameraCaptures = useDirectorStore((state) => state.addCameraCaptures);
  const updateCamera = useDirectorStore((state) => state.updateCamera);
  const selectedCameraKeyframeId = useDirectorStore((state) => state.selectedCameraKeyframeId);
  const cameraMotionProgress = useDirectorStore((state) => state.cameraMotionProgress);
  const cameraMotionPlaying = useDirectorStore((state) => state.cameraMotionPlaying);
  const selectCameraMotionKeyframe = useDirectorStore((state) => state.selectCameraMotionKeyframe);
  const addCameraMotionKeyframe = useDirectorStore((state) => state.addCameraMotionKeyframe);
  const updateCameraMotionKeyframe = useDirectorStore((state) => state.updateCameraMotionKeyframe);
  const deleteCameraMotionKeyframe = useDirectorStore((state) => state.deleteCameraMotionKeyframe);
  const updateCameraMotionPath = useDirectorStore((state) => state.updateCameraMotionPath);
  const setCameraMotionProgress = useDirectorStore((state) => state.setCameraMotionProgress);
  const setCameraMotionPlaying = useDirectorStore((state) => state.setCameraMotionPlaying);
  const setViewMode = useDirectorStore((state) => state.setViewMode);

  const captures = useMemo(() => camera?.captures ?? [], [camera?.captures]);
  const cameraCaptureGroups = useMemo(
    () =>
      cameras.map((item) => ({
        camera: item,
        captures: item.captures ?? [],
      })),
    [cameras]
  );
  const hasAnyCameraCapture = cameraCaptureGroups.some((group) => group.captures.length > 0);
  const focusableObjects = useMemo(() => objects.filter(isCameraFocusableObject), [objects]);
  const targetSelectValue = useMemo(
    () =>
      camera?.targetMode === "object" && camera.targetObjectId
        ? `object:${camera.targetObjectId}`
        : "manual",
    [camera]
  );
  const motionPath = useMemo(
    () => (camera ? getCameraMotionPath(camera) : DEFAULT_CAMERA_MOTION_PATH),
    [camera]
  );
  const selectedMotionKeyframe =
    motionPath.keyframes.find((item) => item.id === selectedCameraKeyframeId) ?? motionPath.keyframes[0] ?? null;

  useEffect(() => {
    if (camera) {
      setMotionDurationDraft(String(motionPath.duration));
    }
  }, [camera?.id, motionPath.duration, camera]);

  useEffect(() => {
    setMotionFovDraft(selectedMotionKeyframe ? String(selectedMotionKeyframe.fov) : "");
  }, [selectedMotionKeyframe?.fov, selectedMotionKeyframe?.id]);

  useEffect(() => {
    if (!viewerCapture) {
      setViewerScale(1);
      setViewerOffset({ x: 0, y: 0 });
      setViewerDragging(false);
      viewerDragStateRef.current = null;
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerCapture(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerCapture]);

  useEffect(() => {
    if (viewerScale <= 1) {
      setViewerOffset({ x: 0, y: 0 });
      setViewerDragging(false);
      viewerDragStateRef.current = null;
    }
  }, [viewerScale]);

  useEffect(() => {
    if (!viewerDragging) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const dragState = viewerDragStateRef.current;
      if (!dragState) {
        return;
      }

      setViewerOffset({
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      });
    }

    function handleMouseUp() {
      setViewerDragging(false);
      viewerDragStateRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [viewerDragging]);

  const clampViewerScale = useCallback((value: number) => {
    return Math.min(VIEWER_ZOOM_MAX, Math.max(VIEWER_ZOOM_MIN, value));
  }, []);

  const updateViewerScale = useCallback((updater: (currentScale: number) => number) => {
    setViewerScale((currentScale) => clampViewerScale(Number(updater(currentScale).toFixed(2))));
  }, [clampViewerScale]);

  const saveCapturesToHost = useCallback(async (captures: HostCaptureItem[]) => {
    setCaptureStatus(null);
    setCaptureError(null);
    try {
      const saved = await postDirectorDeskCapturesToHost(
        captures,
        DEFAULT_CAPTURE_FALLBACK_FILE_NAME_BASE
      );
      const isEmpty = saved.length === 1 && saved[0].error === 'DIRECTOR3D_EMPTY_CAPTURES';
      if (isEmpty) {
        setCaptureStatus(t("director3d.capture.emptyCaptures"));
      } else {
        const failures = saved.filter((r) => r.error || !r.asset);
        if (failures.length > 0) {
          setPreviewCaptures(
            failures.map((f) => ({
              dataUrl: f.dataUrl,
              fileName: f.fileName,
              error:
                f.error === 'DIRECTOR3D_NO_PROJECT_ID'
                  ? t('director3d.capture.noProjectId')
                  : f.error,
            }))
          );
          setCaptureStatus(t("director3d.capture.saveFailed", { count: failures.length }));
        } else {
          setCaptureStatus(t("director3d.capture.saveSuccess", { count: saved.length }));
        }
      }
    } catch (error) {
      setCaptureStatus(error instanceof Error ? error.message : t("director3d.capture.captureFailed"));
    }
  }, [t]);

  const sendCaptureToCanvas = useCallback(
    async (capture: DirectorCameraCapture, camera: DirectorCameraShot) => {
      const fileName = getCaptureFileName(capture, camera, DEFAULT_SCREENSHOT_FILE_NAME_BASE);
      await saveCapturesToHost([{ dataUrl: capture.dataUrl, fileName }]);
    },
    [saveCapturesToHost, t]
  );

  const sendAllCapturesToCanvas = useCallback(async () => {
    const captureEntries = cameraCaptureGroups.flatMap((group) =>
      group.captures.map((capture) => ({ capture, camera: group.camera }))
    );
    const captures = captureEntries.map(({ capture, camera }) => ({
      dataUrl: capture.dataUrl,
      fileName: getCaptureFileName(capture, camera, DEFAULT_SCREENSHOT_FILE_NAME_BASE),
    }));
    await saveCapturesToHost(captures);
  }, [cameraCaptureGroups, saveCapturesToHost, t]);

  if (!camera) return null;
  const currentCamera = camera;

  async function handleCameraCapture() {
    setCaptureStatus(null);
    setCaptureError(null);
    try {
      const results = await requestViewportCapture({
        preset: "current",
        source: "camera-panel",
        cameraId: currentCamera.id,
      });
      const preview = results[0];
      if (preview) {
        addCameraCaptures(currentCamera.id, [preview.dataUrl]);
      }
    } catch (error) {
      setCaptureError(getDirector3dErrorMessage(error, t));
    }
  }

  function handleDeleteCapture(captureId: string) {
    const captureCamera = cameras.find((item) => (item.captures ?? []).some((capture) => capture.id === captureId));
    if (!captureCamera) return;

    const nextCaptures = (captureCamera.captures ?? []).filter((item) => item.id !== captureId);
    updateCamera(captureCamera.id, {
      captures: nextCaptures,
      lastCaptureUrl: nextCaptures[nextCaptures.length - 1]?.dataUrl ?? null,
    });
    setHoveredCaptureId((current) => (current === captureId ? null : current));
    setViewerCapture((current) => (current?.id === captureId ? null : current));
  }

  function handleClearAllCaptures() {
    cameras.forEach((item) => {
      if ((item.captures ?? []).length === 0 && !item.lastCaptureUrl) return;

      updateCamera(item.id, {
        captures: [],
        lastCaptureUrl: null,
      });
    });
    setHoveredCaptureId(null);
    setViewerCapture(null);
  }

  function handleViewerZoom(direction: "in" | "out") {
    updateViewerScale((current) => current + (direction === "in" ? VIEWER_ZOOM_STEP : -VIEWER_ZOOM_STEP));
  }

  function handleViewerWheel(event: React.WheelEvent<HTMLImageElement>) {
    event.preventDefault();
    event.stopPropagation();
    updateViewerScale((current) => current + (event.deltaY < 0 ? VIEWER_ZOOM_STEP : -VIEWER_ZOOM_STEP));
  }

  function handleViewerMouseDown(event: React.MouseEvent<HTMLImageElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (viewerScale <= 1) {
      return;
    }

    viewerDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewerOffset.x,
      originY: viewerOffset.y,
    };
    setViewerDragging(true);
  }

  function closeViewer() {
    setViewerCapture(null);
  }

  function handleTargetSelection(value: string) {
    if (value === "manual") {
      updateCamera(currentCamera.id, {
        targetMode: "manual",
        targetObjectId: null,
      });
      return;
    }

    const objectId = value.replace(/^object:/, "");
    const targetObject = focusableObjects.find((item) => item.id === objectId);

    if (!targetObject) {
      updateCamera(currentCamera.id, {
        targetMode: "manual",
        targetObjectId: null,
      });
      return;
    }

    updateCamera(currentCamera.id, {
      targetMode: "object",
      targetObjectId: targetObject.id,
      target: getDirectorObjectFocusTarget(targetObject),
    });
  }

  function updateManualTarget(axis: 0 | 1 | 2, value: string) {
    updateCamera(currentCamera.id, {
      targetMode: "manual",
      targetObjectId: null,
      target: replaceAxis(currentCamera.target, axis, Number(value)),
    });
  }

  function handleAddMotionKeyframe() {
    const keyframeId = addCameraMotionKeyframe(currentCamera.id);
    if (!keyframeId) return;
    setActiveTab("motion");
    setViewMode("director");
  }

  function handleOpenMotionTab() {
    setActiveTab("motion");
    setViewMode("director");

    if (selectedCameraKeyframeId && motionPath.keyframes.some((item) => item.id === selectedCameraKeyframeId)) {
      return;
    }

    const firstKeyframe = motionPath.keyframes[0];
    if (!firstKeyframe) return;
    selectCameraMotionKeyframe(firstKeyframe.id);
    setCameraMotionProgress(firstKeyframe.time);
  }

  function handleSelectMotionKeyframe(keyframeId: string, time: number) {
    selectCameraMotionKeyframe(keyframeId);
    setCameraMotionProgress(time);
    setCameraMotionPlaying(false);
    setViewMode("director");
  }

  function handleToggleMotionPlayback() {
    if (motionPath.keyframes.length < 2) return;
    if (cameraMotionProgress >= 0.999) setCameraMotionProgress(0);
    setViewMode("camera");
    setCameraMotionPlaying(!cameraMotionPlaying);
  }

  function updateSelectedMotionPosition(axis: 0 | 1 | 2, value: string) {
    if (!selectedMotionKeyframe) return;
    updateCameraMotionKeyframe(currentCamera.id, selectedMotionKeyframe.id, {
      position: replaceAxis(selectedMotionKeyframe.position, axis, Number(value)),
    });
  }

  function commitMotionDuration(value: string) {
    const parsed = Number(value);
    const nextDuration = Number.isFinite(parsed)
      ? clampNumber(parsed, CAMERA_MOTION_DURATION_MIN, CAMERA_MOTION_DURATION_MAX)
      : motionPath.duration;
    updateCameraMotionPath(currentCamera.id, { duration: nextDuration });
    setMotionDurationDraft(String(nextDuration));
  }

  function commitSelectedMotionFov(value: string) {
    if (!selectedMotionKeyframe) return;
    const parsed = Number(value);
    const nextFov = Number.isFinite(parsed)
      ? clampNumber(parsed, CAMERA_MOTION_FOV_MIN, CAMERA_MOTION_FOV_MAX)
      : selectedMotionKeyframe.fov;
    updateCameraMotionKeyframe(currentCamera.id, selectedMotionKeyframe.id, { fov: nextFov });
    setMotionFovDraft(String(nextFov));
  }

  function formatMotionTime(time: number) {
    return `${(time * motionPath.duration).toFixed(1)}s`;
  }

  function renderCaptureCards(group: { camera: DirectorCameraShot; captures: DirectorCameraCapture[] }) {
    return (
      <div className="camera-capture-grid" aria-label={t("director3d.capture.captureListAriaLabel")}>
        {group.captures.map((capture) => {
          const captureActive = hoveredCaptureId === capture.id;

          return (
            <div key={capture.id} className="camera-capture-card">
              <div
                className="camera-capture-thumb-wrap"
                onClick={() => setViewerCapture(capture)}
                onMouseEnter={() => setHoveredCaptureId(capture.id)}
                onMouseLeave={() => setHoveredCaptureId((current) => (current === capture.id ? null : current))}
              >
                <img
                  className="camera-capture-thumb"
                  alt={t("director3d.capture.thumbnailAlt", { name: capture.name })}
                  src={capture.dataUrl}
                />
                <div
                  aria-label={t("director3d.capture.thumbnailActionsAriaLabel", { name: capture.name })}
                  className={`camera-capture-actions${captureActive ? " is-visible" : ""}`}
                  role="group"
                >
                  <button
                    aria-label={t("director3d.capture.deleteAriaLabel", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCapture(capture.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    aria-label={t("director3d.capture.sendToCanvasAriaLabel", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void sendCaptureToCanvas(capture, group.camera);
                    }}
                  >
                    <Send aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    aria-label={t("director3d.capture.viewAriaLabel", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewerCapture(capture);
                    }}
                  >
                    <Eye aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
              <span className="camera-capture-name">{capture.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCurrentCameraCaptureGrid() {
    if (captures.length === 0) {
      return <div className="capture-list-placeholder">{t("director3d.capture.emptyCurrentHint")}</div>;
    }

    return renderCaptureCards({ camera: currentCamera, captures });
  }

  function renderCaptureEmptyState() {
    return (
      <div
        className="camera-capture-empty object-search-empty-state"
        role="status"
        aria-label={t("director3d.capture.noCapturesAriaLabel")}
      >
        <span className="object-search-empty-icon" data-testid="camera-capture-empty-icon">
          <Images aria-hidden="true" size={16} strokeWidth={1.8} />
        </span>
        <span>{t("director3d.capture.noCaptures")}</span>
      </div>
    );
  }

  function renderAllCameraCaptures() {
    return (
      <div className="camera-capture-overview">
        <div className="camera-capture-overview-scroll">
          {hasAnyCameraCapture ? (
            cameraCaptureGroups
              .filter((group) => group.captures.length > 0)
              .map((group) => (
                <section
                  key={group.camera.id}
                  aria-label={t("director3d.capture.cameraGroupTitle", { name: group.camera.name })}
                  className="camera-capture-group"
                >
                  <h3>{t("director3d.capture.cameraGroupTitle", { name: group.camera.name })}</h3>
                  {renderCaptureCards(group)}
                </section>
              ))
          ) : (
            renderCaptureEmptyState()
          )}
        </div>
      </div>
    );
  }

  function renderCaptureOverviewFooter() {
    if (activeTab !== "captures") {
      return null;
    }

    return (
      <div className="camera-capture-overview-footer">
        <button className="camera-capture-clear-all" type="button" onClick={handleClearAllCaptures}>
          <Trash2 aria-hidden="true" data-testid="camera-capture-clear-icon" size={14} strokeWidth={1.9} />
          <span>{t("director3d.capture.clearAll")}</span>
        </button>
        <button
          className="camera-capture-send-all viewport-toolbar-crowd-confirm"
          type="button"
          onClick={() => void sendAllCapturesToCanvas()}
        >
          <Send aria-hidden="true" data-testid="camera-capture-send-icon" size={14} strokeWidth={1.9} />
          <span>{t("director3d.capture.sendToCanvas")}</span>
        </button>
      </div>
    );
  }

  function renderViewer() {
    if (!viewerCapture) {
      return null;
    }

    const viewerCamera =
      cameraCaptureGroups.find((group) => group.captures.some((capture) => capture.id === viewerCapture.id))?.camera ??
      currentCamera;

    const viewerImageClassName = [
      "camera-capture-viewer-image",
      viewerScale > 1 ? "is-zoomed" : "",
      viewerDragging ? "is-dragging" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        aria-label={t("director3d.capture.viewerTitleAriaLabel")}
        className="camera-capture-viewer"
        role="dialog"
        onClick={closeViewer}
      >
        <div
          aria-label={t("director3d.capture.viewerToolbarAriaLabel")}
          className="camera-capture-viewer-toolbar"
          role="toolbar"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            aria-label={t("director3d.capture.zoomInImage")}
            className="camera-capture-viewer-tool"
            type="button"
            onClick={() => handleViewerZoom("in")}
          >
            <ZoomIn aria-hidden="true" size={18} strokeWidth={2} />
          </button>
          <button
            aria-label={t("director3d.capture.zoomOutImage")}
            className="camera-capture-viewer-tool"
            type="button"
            onClick={() => handleViewerZoom("out")}
          >
            <ZoomOut aria-hidden="true" size={18} strokeWidth={2} />
          </button>
          <button
            aria-label={t("director3d.capture.downloadImage")}
            className="camera-capture-viewer-tool"
            type="button"
            onClick={() =>
              downloadDataUrl(
                viewerCapture.dataUrl,
                getCaptureFileName(viewerCapture, viewerCamera, DEFAULT_SCREENSHOT_FILE_NAME_BASE)
              )
            }
          >
            <Download aria-hidden="true" size={18} strokeWidth={2} />
          </button>
          <button
            aria-label={t("director3d.capture.closeViewer")}
            className="camera-capture-viewer-tool camera-capture-viewer-close"
            type="button"
            onClick={closeViewer}
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="camera-capture-viewer-stage">
          <img
            className={viewerImageClassName}
            alt={t("director3d.capture.fullImageAlt", { name: viewerCapture.name })}
            src={viewerCapture.dataUrl}
            style={{ transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})` }}
            onClick={(event) => event.stopPropagation()}
            onWheel={handleViewerWheel}
            onMouseDown={handleViewerMouseDown}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  function renderMotionEditor() {
    return (
      <div className="camera-motion-tab">
        <div className="camera-motion-intro">
          <span className="camera-motion-intro-icon"><Route aria-hidden="true" size={18} /></span>
          <div>
            <h3>{t("director3d.camera.motionTitle")}</h3>
            <p>{t("director3d.camera.motionHint")}</p>
          </div>
        </div>

        <button className="camera-motion-add-button" type="button" onClick={handleAddMotionKeyframe}>
          <Plus aria-hidden="true" size={15} />
          {t("director3d.camera.addKeyframe")}
        </button>

        {motionPath.keyframes.length === 0 ? (
          <div className="camera-motion-empty" role="status">
            <Waypoints aria-hidden="true" size={22} />
            <strong>{t("director3d.camera.noKeyframes")}</strong>
            <span>{t("director3d.camera.noKeyframesHint")}</span>
          </div>
        ) : (
          <>
            <InspectorRangeNumberField
              label={t("director3d.camera.duration")}
              rangeAriaLabel={t("director3d.camera.durationRangeAriaLabel")}
              numberAriaLabel={t("director3d.camera.durationNumberAriaLabel")}
              min="0.5"
              max="30"
              step="0.1"
              value={motionDurationDraft}
              onValueChange={commitMotionDuration}
              onRangeChange={commitMotionDuration}
              onNumberBlur={commitMotionDuration}
              onNumberChange={setMotionDurationDraft}
            />
            <InspectorSelectField
              label={t("director3d.camera.interpolation")}
              ariaLabel={t("director3d.camera.interpolationAriaLabel")}
              value={motionPath.interpolation}
              onChange={(value) => updateCameraMotionPath(currentCamera.id, { interpolation: value === "linear" ? "linear" : "smooth" })}
            >
              <option value="smooth">{t("director3d.camera.interpolationSmooth")}</option>
              <option value="linear">{t("director3d.camera.interpolationLinear")}</option>
            </InspectorSelectField>

            <div className="camera-motion-playback">
              <button
                className="camera-motion-play-button"
                type="button"
                disabled={motionPath.keyframes.length < 2}
                aria-label={cameraMotionPlaying ? t("director3d.camera.pauseMotion") : t("director3d.camera.playMotion")}
                onClick={handleToggleMotionPlayback}
              >
                {cameraMotionPlaying ? <Pause aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
              </button>
              <input
                aria-label={t("director3d.camera.playbackPositionAriaLabel")}
                max="1"
                min="0"
                step="0.001"
                type="range"
                value={cameraMotionProgress}
                onChange={(event) => {
                  setCameraMotionPlaying(false);
                  setCameraMotionProgress(Number(event.currentTarget.value));
                  setViewMode("camera");
                }}
              />
              <span>{formatMotionTime(cameraMotionProgress)} / {motionPath.duration.toFixed(1)}s</span>
            </div>

            <button
              className={`camera-motion-loop-button${motionPath.loop ? " is-active" : ""}`}
              type="button"
              aria-pressed={motionPath.loop}
              onClick={() => updateCameraMotionPath(currentCamera.id, { loop: !motionPath.loop })}
            >
              {t("director3d.camera.loopPlayback")}
            </button>

            <div className="camera-motion-keyframes" role="list" aria-label={t("director3d.camera.keyframesAriaLabel")}>
              {motionPath.keyframes.map((keyframe, index) => (
                <div key={keyframe.id} role="listitem">
                  <button
                    className={selectedMotionKeyframe?.id === keyframe.id ? "is-active" : ""}
                    type="button"
                    aria-label={t("director3d.camera.selectKeyframe", { index: index + 1 })}
                    aria-pressed={selectedMotionKeyframe?.id === keyframe.id}
                    onClick={() => handleSelectMotionKeyframe(keyframe.id, keyframe.time)}
                  >
                    <span>K{index + 1}</span>
                    <small>{formatMotionTime(keyframe.time)}</small>
                  </button>
                </div>
              ))}
            </div>

            {selectedMotionKeyframe ? (
              <InspectorSection title={t("director3d.camera.keyframeTitle", { index: motionPath.keyframes.indexOf(selectedMotionKeyframe) + 1 })} className="camera-motion-keyframe-editor">
                <InspectorAxisGroup
                  label={t("director3d.position")}
                  axes={[
                    { axis: "X", ariaLabel: t("director3d.camera.keyframePositionX"), value: selectedMotionKeyframe.position[0], onChange: (value) => updateSelectedMotionPosition(0, value) },
                    { axis: "Y", ariaLabel: t("director3d.camera.keyframePositionY"), value: selectedMotionKeyframe.position[1], onChange: (value) => updateSelectedMotionPosition(1, value) },
                    { axis: "Z", ariaLabel: t("director3d.camera.keyframePositionZ"), value: selectedMotionKeyframe.position[2], onChange: (value) => updateSelectedMotionPosition(2, value) },
                  ]}
                />
                <InspectorRangeNumberField
                  label={t("director3d.camera.keyframeFov")}
                  rangeAriaLabel={t("director3d.camera.keyframeFovRangeAriaLabel")}
                  numberAriaLabel={t("director3d.camera.keyframeFovNumberAriaLabel")}
                  min="10"
                  max="120"
                  step="0.1"
                  value={motionFovDraft}
                  onValueChange={commitSelectedMotionFov}
                  onRangeChange={commitSelectedMotionFov}
                  onNumberBlur={commitSelectedMotionFov}
                  onNumberChange={setMotionFovDraft}
                />
                <button
                  className="camera-motion-delete-button"
                  type="button"
                  onClick={() => deleteCameraMotionKeyframe(currentCamera.id, selectedMotionKeyframe.id)}
                >
                  <Trash2 aria-hidden="true" size={14} /> {t("director3d.camera.deleteKeyframe")}
                </button>
              </InspectorSection>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <InspectorPanel
      title={t("director3d.camera.title")}
      ariaLabel={t("director3d.camera.panelAriaLabel")}
      className={activeTab === "captures" ? "camera-inspector-captures" : undefined}
      footer={renderCaptureOverviewFooter()}
      tabs={[
        { label: t("director3d.properties"), active: activeTab === "properties", onClick: () => setActiveTab("properties") },
        { label: t("director3d.camera.motionTab"), active: activeTab === "motion", onClick: handleOpenMotionTab },
        { label: t("director3d.capture.tabLabel"), active: activeTab === "captures", onClick: () => setActiveTab("captures") },
      ]}
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label={t("director3d.name")}
            ariaLabel={t("director3d.camera.nameAriaLabel")}
            value={currentCamera.name}
            onChange={(value) => updateCamera(currentCamera.id, { name: value })}
          />
          <InspectorSelectField
            label={t("director3d.camera.switchCamera")}
            ariaLabel={t("director3d.camera.switchCameraAriaLabel")}
            value={currentCamera.id}
            onChange={(value) => setActiveCamera(value)}
          >
            {cameras.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </InspectorSelectField>
          <InspectorAxisGroup
            label={t("director3d.position")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("director3d.camera.positionX"),
                value: currentCamera.transform.position[0],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 0, Number(value)),
                    },
                  }),
              },
              {
                axis: "Y",
                ariaLabel: t("director3d.camera.positionY"),
                value: currentCamera.transform.position[1],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 1, Number(value)),
                    },
                  }),
              },
              {
                axis: "Z",
                ariaLabel: t("director3d.camera.positionZ"),
                value: currentCamera.transform.position[2],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 2, Number(value)),
                    },
                  }),
              },
            ]}
          />
          <InspectorSelectField
            label={t("director3d.camera.target")}
            ariaLabel={t("director3d.camera.targetModeAriaLabel")}
            value={targetSelectValue}
            onChange={handleTargetSelection}
          >
            <option value="manual">{t("director3d.camera.targetManual")}</option>
            {focusableObjects.map((item) => (
              <option key={item.id} value={`object:${item.id}`}>
                {item.name}
              </option>
            ))}
          </InspectorSelectField>
          <InspectorAxisGroup
            label={t("director3d.camera.targetCoordinates")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("director3d.camera.targetX"),
                value: currentCamera.target[0],
                onChange: (value) => updateManualTarget(0, value),
              },
              {
                axis: "Y",
                ariaLabel: t("director3d.camera.targetY"),
                value: currentCamera.target[1],
                onChange: (value) => updateManualTarget(1, value),
              },
              {
                axis: "Z",
                ariaLabel: t("director3d.camera.targetZ"),
                value: currentCamera.target[2],
                onChange: (value) => updateManualTarget(2, value),
              },
            ]}
          />
          <InspectorRangeNumberField
            label={t("director3d.camera.fov")}
            rangeAriaLabel={t("director3d.camera.fovRangeAriaLabel")}
            numberAriaLabel={t("director3d.camera.fovNumberAriaLabel")}
            max="120"
            min="10"
            step="0.1"
            value={currentCamera.fov}
            onValueChange={(value) => updateCamera(currentCamera.id, { fov: Number(value) })}
          />
          <InspectorSection title={t("director3d.capture.sectionTitle")} className="camera-capture-section">
            <button
              className="camera-capture-current-button"
              type="button"
              onClick={() => void handleCameraCapture()}
            >
              <Camera aria-hidden="true" data-testid="camera-current-capture-icon" size={14} strokeWidth={1.9} />
              <span>{t("director3d.capture.currentCameraButton")}</span>
            </button>
            {captureError ? <p>{captureError}</p> : null}
            {captureStatus ? <p>{captureStatus}</p> : null}
            {renderCurrentCameraCaptureGrid()}
          </InspectorSection>
        </>
      ) : activeTab === "motion" ? (
        renderMotionEditor()
      ) : (
        <div className="camera-capture-tab">
          {captureError ? <p>{captureError}</p> : null}
          {captureStatus ? <p>{captureStatus}</p> : null}
          {renderAllCameraCaptures()}
        </div>
      )}
      {renderViewer()}
      <CapturePreviewModal
        isOpen={previewCaptures.length > 0}
        captures={previewCaptures}
        onClose={() => setPreviewCaptures([])}
      />
    </InspectorPanel>
  );
}
