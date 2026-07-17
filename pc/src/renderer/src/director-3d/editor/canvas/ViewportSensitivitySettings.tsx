import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Settings2, X } from "lucide-react";
import {
  DEFAULT_VIEWPORT_ROTATE_SENSITIVITY,
  DEFAULT_VIEWPORT_ZOOM_SENSITIVITY,
  VIEWPORT_SENSITIVITY_MAX,
  VIEWPORT_SENSITIVITY_MIN,
  VIEWPORT_SENSITIVITY_STEP,
} from "../schema/viewportSensitivity";
import { useDirectorStore } from "../store/directorStore";

const SENSITIVITY_PERCENT_MIN = VIEWPORT_SENSITIVITY_MIN * 100;
const SENSITIVITY_PERCENT_MAX = VIEWPORT_SENSITIVITY_MAX * 100;
const SENSITIVITY_PERCENT_STEP = VIEWPORT_SENSITIVITY_STEP * 100;

function toPercent(value: number) {
  return Math.round(value * 100);
}

function getSensitivityDescription(value: number, t: (key: string) => string) {
  if (value <= 0.25) return t("director3d.sensitivity.verySlow");
  if (value <= 0.5) return t("director3d.sensitivity.relaxed");
  if (value <= 0.8) return t("director3d.sensitivity.moderate");
  if (value <= 1.1) return t("director3d.sensitivity.sensitive");
  return t("director3d.sensitivity.veryFast");
}

export function ViewportSensitivitySettings() {
  const { t } = useTranslation();
  const rotateSensitivity = useDirectorStore((state) => state.viewportRotateSensitivity);
  const zoomSensitivity = useDirectorStore((state) => state.viewportZoomSensitivity);
  const setRotateSensitivity = useDirectorStore((state) => state.setViewportRotateSensitivity);
  const setZoomSensitivity = useDirectorStore((state) => state.setViewportZoomSensitivity);
  const resetSensitivity = useDirectorStore((state) => state.resetViewportSensitivity);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node) || wrapperRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isDefault =
    rotateSensitivity === DEFAULT_VIEWPORT_ROTATE_SENSITIVITY &&
    zoomSensitivity === DEFAULT_VIEWPORT_ZOOM_SENSITIVITY;

  return (
    <div className="viewport-sensitivity-settings" ref={wrapperRef}>
      <button
        ref={triggerRef}
        className={`viewport-sensitivity-trigger${open ? " is-active" : ""}`}
        type="button"
        aria-controls="viewport-sensitivity-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings2 aria-hidden="true" size={15} strokeWidth={1.9} />
        <span>{t("director3d.sensitivity.trigger")}</span>
      </button>

      {open ? (
        <section
          id="viewport-sensitivity-popover"
          className="viewport-sensitivity-popover"
          role="dialog"
          aria-label={t("director3d.sensitivity.title")}
        >
          <header className="viewport-sensitivity-header">
            <div>
              <strong>{t("director3d.sensitivity.title")}</strong>
              <small>{t("director3d.sensitivity.subtitle")}</small>
            </div>
            <button type="button" aria-label={t("director3d.sensitivity.close")} onClick={() => setOpen(false)}>
              <X aria-hidden="true" size={15} />
            </button>
          </header>

          <div className="viewport-sensitivity-control">
            <div className="viewport-sensitivity-label">
              <label htmlFor="viewport-rotate-sensitivity">{t("director3d.sensitivity.rotate")}</label>
              <output htmlFor="viewport-rotate-sensitivity">
                {getSensitivityDescription(rotateSensitivity, t)} · {toPercent(rotateSensitivity)}%
              </output>
            </div>
            <input
              id="viewport-rotate-sensitivity"
              type="range"
              aria-label={t("director3d.sensitivity.rotate")}
              min={SENSITIVITY_PERCENT_MIN}
              max={SENSITIVITY_PERCENT_MAX}
              step={SENSITIVITY_PERCENT_STEP}
              value={toPercent(rotateSensitivity)}
              onChange={(event) => setRotateSensitivity(Number(event.currentTarget.value) / 100)}
            />
            <div className="viewport-sensitivity-scale" aria-hidden="true"><span>{t("director3d.sensitivity.slow")}</span><span>{t("director3d.sensitivity.fast")}</span></div>
          </div>

          <div className="viewport-sensitivity-control">
            <div className="viewport-sensitivity-label">
              <label htmlFor="viewport-zoom-sensitivity">{t("director3d.sensitivity.zoom")}</label>
              <output htmlFor="viewport-zoom-sensitivity">
                {getSensitivityDescription(zoomSensitivity, t)} · {toPercent(zoomSensitivity)}%
              </output>
            </div>
            <input
              id="viewport-zoom-sensitivity"
              type="range"
              aria-label={t("director3d.sensitivity.zoom")}
              min={SENSITIVITY_PERCENT_MIN}
              max={SENSITIVITY_PERCENT_MAX}
              step={SENSITIVITY_PERCENT_STEP}
              value={toPercent(zoomSensitivity)}
              onChange={(event) => setZoomSensitivity(Number(event.currentTarget.value) / 100)}
            />
            <div className="viewport-sensitivity-scale" aria-hidden="true"><span>{t("director3d.sensitivity.slow")}</span><span>{t("director3d.sensitivity.fast")}</span></div>
          </div>

          <p className="viewport-sensitivity-note">{t("director3d.sensitivity.note")}</p>

          <button
            className="viewport-sensitivity-reset"
            type="button"
            disabled={isDefault}
            onClick={resetSensitivity}
          >
            <RotateCcw aria-hidden="true" size={14} />
            {t("director3d.sensitivity.reset")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
