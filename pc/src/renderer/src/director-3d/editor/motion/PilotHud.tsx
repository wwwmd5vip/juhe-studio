import { CornerDownLeft, Crosshair, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CameraPilotMode } from "../store/directorStore";

export function PilotHud({
  lockedTargetName,
  onExit,
  onRecord,
  pointedTargetName,
}: {
  lockedTargetName: string | null;
  mode: Exclude<CameraPilotMode, "idle">;
  onExit: () => void;
  onRecord: () => void;
  pointedTargetName: string | null;
}) {
  const { t } = useTranslation();
  const targetName = lockedTargetName ?? pointedTargetName;
  const crosshairLabel = lockedTargetName
    ? t("director3d.pilot.crosshairLocked", { name: lockedTargetName })
    : pointedTargetName
      ? t("director3d.pilot.crosshairPointing", { name: pointedTargetName })
      : t("director3d.pilot.crosshairIdle");

  return (
    <div className="pilot-hud" aria-label={t("director3d.pilot.mode")}>
      <div className="pilot-status" role="status">
        <span className="pilot-status-dot" />
        {t("director3d.pilot.mode")}
      </div>

      <div className={`pilot-crosshair${lockedTargetName ? " is-locked" : targetName ? " is-pointing" : ""}`} aria-label={crosshairLabel}>
        <span className="pilot-crosshair-line is-top" />
        <span className="pilot-crosshair-line is-right" />
        <span className="pilot-crosshair-line is-bottom" />
        <span className="pilot-crosshair-line is-left" />
        <span className="pilot-crosshair-center" />
        {targetName ? (
          <span className="pilot-target-name">
            <Crosshair aria-hidden="true" size={13} />
            {lockedTargetName
              ? t("director3d.pilot.locked", { name: targetName })
              : t("director3d.pilot.lockHint", { name: targetName })}
          </span>
        ) : null}
      </div>

      <div className="pilot-keyboard-help" aria-label={t("director3d.pilot.keyboardHelp")}>
        <span><kbd>W A S D</kbd> {t("director3d.pilot.move")}</span>
        <span><kbd>E</kbd> {t("director3d.pilot.ascendDescend")}</span>
        <span><kbd>{t("director3d.common.spaceKey")}</kbd> {t("director3d.pilot.playPause")}</span>
        <span><kbd>F</kbd> {t("director3d.pilot.lockSubject")}</span>
        <span><kbd>{t("director3d.common.scrollWheel")}</kbd> {t("director3d.pilot.zoom")}</span>
      </div>

      <div className="pilot-hud-actions">
        <button type="button" className="pilot-hud-secondary" onClick={onExit} aria-label={t("director3d.pilot.exitAria")}>
          <LogOut aria-hidden="true" size={15} />
          {t("director3d.pilot.exit")}
        </button>
        <button type="button" className="pilot-hud-primary" onClick={onRecord} aria-label={t("director3d.pilot.recordAria")}>
          <CornerDownLeft aria-hidden="true" size={15} />
          {t("director3d.pilot.record")}
        </button>
      </div>
    </div>
  );
}
