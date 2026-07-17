import {
  MapPinPlus,
  Package,
  Pause,
  PersonStanding,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { DEFAULT_CAMERA_MOTION_PATH, getCameraMotionPath } from "../schema/cameraMotion";
import { normalizeObjectMotionPath } from "../schema/objectMotion";
import { useTranslation } from "react-i18next";
import { useDirectorStore } from "../store/directorStore";
import "./objectMotionTransport.css";

const CURRENT_KEYFRAME_TOLERANCE = 0.005;

function formatSeconds(seconds: number, t: (key: string) => string) {
  return `${seconds.toFixed(1)}${t("director3d.motion.transport.seconds")}`;
}

/**
 * A shared transport for all character and prop animation.
 *
 * Object motion and camera motion intentionally use the same normalized
 * progress value so a director can pause the cast, adjust the shot, and
 * continue without losing sync.
 */
export function ObjectMotionTransport() {
  const { t } = useTranslation();
  const progress = useDirectorStore((state) => state.cameraMotionProgress);
  const playing = useDirectorStore((state) => state.cameraMotionPlaying);
  const pilotMode = useDirectorStore((state) => state.cameraPilotMode);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const activeCamera = useDirectorStore((state) =>
    state.project.cameras.find((camera) => camera.id === state.project.activeCameraId)
      ?? state.project.cameras[0]
  );
  const addObjectMotionKeyframe = useDirectorStore((state) => state.addObjectMotionKeyframe);
  const deleteObjectMotionKeyframe = useDirectorStore((state) => state.deleteObjectMotionKeyframe);
  const selectObjectMotionKeyframe = useDirectorStore((state) => state.selectObjectMotionKeyframe);
  const setProgress = useDirectorStore((state) => state.setCameraMotionProgress);
  const setPlaying = useDirectorStore((state) => state.setCameraMotionPlaying);
  const updateCameraMotionPath = useDirectorStore((state) => state.updateCameraMotionPath);

  const duration = activeCamera
    ? getCameraMotionPath(activeCamera).duration
    : DEFAULT_CAMERA_MOTION_PATH.duration;
  const currentSeconds = progress * duration;
  const isPiloting = pilotMode !== "idle";
  const selectedObject = objects.find(
    (object) => object.id === selectedObjectId && (object.kind === "character" || object.kind === "prop")
  );
  const keyframes = selectedObject
    ? normalizeObjectMotionPath(selectedObject.motionPath, selectedObject.transform).keyframes
    : [];
  const hasPlayableObjectMotion =
    (activeCamera?.motionPath?.keyframes.length ?? 0) >= 2
    || objects.some(
      (object) => (object.motionPath?.keyframes?.length ?? 0) >= 2 || Boolean(object.characterRig?.actionPresetId)
    );
  const currentKeyframe = keyframes.find(
    (keyframe) => Math.abs(keyframe.time - progress) <= CURRENT_KEYFRAME_TOLERANCE
  );
  const isAtStart = progress <= CURRENT_KEYFRAME_TOLERANCE;
  const isCharacterRoute = selectedObject?.kind === "character";
  const pointLabel = isCharacterRoute ? t("director3d.motion.transport.routePoint") : t("director3d.motion.transport.actionPoint");
  const recordLabel = isAtStart ? t("director3d.motion.transport.recordStart") : t("director3d.motion.transport.recordCurrent");

  function togglePlayback() {
    if (!hasPlayableObjectMotion) return;
    if (playing) {
      setPlaying(false);
      return;
    }

    if (progress >= 1 - CURRENT_KEYFRAME_TOLERANCE) {
      setProgress(0);
    }
    setPlaying(true);
  }

  function seek(nextProgress: number) {
    setPlaying(false);
    setProgress(nextProgress);
  }

  if (isPiloting) {
    return (
      <section
        className="object-motion-transport object-motion-transport--pilot"
        aria-label={t("director3d.motion.transport.titlePilot")}
      >
        <button
          className="object-motion-transport__play object-motion-transport__play--compact"
          type="button"
          disabled={!hasPlayableObjectMotion}
          aria-label={hasPlayableObjectMotion
            ? playing ? t("director3d.motion.transport.pause") : t("director3d.motion.transport.play")
            : t("director3d.motion.transport.noMotion")}
          aria-pressed={playing}
          onClick={togglePlayback}
        >
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
        </button>
        <output className="object-motion-transport__compact-time" aria-label={t("director3d.motion.transport.currentTime")}>
          {formatSeconds(currentSeconds, t)}
        </output>
        <span className="object-motion-transport__shortcut" aria-label={t("director3d.motion.transport.spaceShortcut")}>
          <kbd>{t("director3d.motion.transport.spaceKey")}</kbd>
          {t("director3d.motion.transport.playPause")}
        </span>
      </section>
    );
  }

  const objectKindLabel = selectedObject?.kind === "character" ? t("director3d.motion.transport.characterAction") : t("director3d.motion.transport.propAction");

  return (
    <section
      className="object-motion-transport object-motion-transport--full"
      aria-label={t("director3d.motion.transport.title")}
    >
      <div className="object-motion-transport__subject" aria-label={t("director3d.motion.transport.subject")}>
        <span className="object-motion-transport__subject-icon" aria-hidden="true">
          {selectedObject?.kind === "character"
            ? <PersonStanding size={17} />
            : <Package size={17} />}
        </span>
        <span className="object-motion-transport__subject-copy">
          <small>{selectedObject ? isCharacterRoute ? t("director3d.motion.transport.characterRoute") : `${objectKindLabel}` : t("director3d.motion.transport.characterOrPropAction")}</small>
          <strong title={selectedObject?.name}>
            {selectedObject?.name ?? t("director3d.motion.transport.selectObjectFirst")}
          </strong>
        </span>
      </div>

      <div className="object-motion-transport__player" aria-label={t("director3d.motion.transport.playerControls")}>
        <button
          className="object-motion-transport__icon-button"
          type="button"
          aria-label={t("director3d.motion.transport.backToStart")}
          onClick={() => seek(0)}
        >
          <RotateCcw aria-hidden="true" size={15} />
        </button>
        <button
          className="object-motion-transport__play"
          type="button"
          disabled={!hasPlayableObjectMotion}
          aria-label={hasPlayableObjectMotion
            ? playing ? t("director3d.motion.transport.pause") : t("director3d.motion.transport.play")
            : t("director3d.motion.transport.noMotion")}
          aria-pressed={playing}
          onClick={togglePlayback}
        >
          {playing ? <Pause aria-hidden="true" size={17} /> : <Play aria-hidden="true" size={17} />}
        </button>
        <output className="object-motion-transport__time" aria-label={t("director3d.motion.transport.currentTime")}>
          {formatSeconds(currentSeconds, t)}
        </output>
        <input
          className="object-motion-transport__scrubber"
          aria-label={t("director3d.motion.transport.sceneTimeline")}
          aria-valuetext={t("director3d.motion.transport.timeValue", { current: formatSeconds(currentSeconds, t), duration: formatSeconds(duration, t) })}
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(event) => seek(Number(event.currentTarget.value))}
        />
        <label className="object-motion-transport__duration-control">
          <span>{t("director3d.motion.transport.totalDuration")}</span>
          <input
            aria-label={t("director3d.motion.transport.durationSecondsAria")}
            type="number"
            min="0.5"
            max="30"
            step="0.5"
            value={duration}
            onChange={(event) => {
              if (!activeCamera) return;
              updateCameraMotionPath(activeCamera.id, { duration: Number(event.currentTarget.value) });
            }}
          />
          <span>{t("director3d.motion.transport.seconds")}</span>
        </label>
      </div>

      <div className="object-motion-transport__editor">
        {!isCharacterRoute ? <>
          <button
            className="object-motion-transport__record"
            type="button"
            disabled={!selectedObject}
            aria-label={selectedObject ? t("director3d.motion.transport.recordLabel", { label: recordLabel, name: selectedObject.name }) : t("director3d.motion.transport.recordAction")}
            onClick={() => {
              if (!selectedObject) return;
              setPlaying(false);
              const recorded = addObjectMotionKeyframe(selectedObject.id, progress);
              if (recorded) selectObjectMotionKeyframe(recorded);
            }}
          >
            <MapPinPlus aria-hidden="true" size={15} />
            {recordLabel}
          </button>
          <div
            className="object-motion-transport__keyframes"
            role="group"
            aria-label={selectedObject ? t("director3d.motion.transport.keyframes", { name: selectedObject.name }) : t("director3d.motion.transport.keyframe")}
          >
            {keyframes.length > 0 ? keyframes.map((keyframe, index) => {
            const isCurrent = keyframe.id === currentKeyframe?.id;
            return (
              <button
                key={keyframe.id}
                className={isCurrent ? "is-current" : undefined}
                type="button"
                aria-label={t("director3d.motion.transport.jumpToKeyframe", { name: selectedObject?.name ?? "", pointLabel, index: index + 1 })}
                aria-pressed={isCurrent}
                title={`${formatSeconds(keyframe.time * duration, t)} · ${pointLabel} ${index + 1}`}
                onClick={() => {
                  selectObjectMotionKeyframe(keyframe.id);
                  seek(keyframe.time);
                }}
              >
                {index + 1}
              </button>
            );
            }) : (
              <small>{selectedObject ? t("director3d.motion.transport.noKeyframes") : t("director3d.motion.transport.selectObjectToRecord")}</small>
            )}
          </div>
        </> : <span className="object-motion-transport__route-hint">{t("director3d.motion.transport.routeHint")}</span>}

        <button
          className="object-motion-transport__delete"
          type="button"
          disabled={isCharacterRoute || !selectedObject || !currentKeyframe}
          aria-label={selectedObject ? t("director3d.motion.transport.deleteKeyframeLabel", { name: selectedObject.name, pointLabel }) : t("director3d.motion.transport.deleteCurrentKeyframe")}
          onClick={() => {
            if (!selectedObject || !currentKeyframe) return;
            setPlaying(false);
            deleteObjectMotionKeyframe(selectedObject.id, currentKeyframe.id);
            selectObjectMotionKeyframe(null);
          }}
        >
          <Trash2 aria-hidden="true" size={14} />
          <span>{t("director3d.motion.transport.delete")}</span>
        </button>
      </div>
    </section>
  );
}
