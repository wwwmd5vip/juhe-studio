import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorSection,
} from "./InspectorControls";
import { useDirectorStore } from "../store/directorStore";

const SCENE_SCALE_MIN = 0.1;
const SCENE_SCALE_MAX = 3;
const GROUND_HEIGHT_MIN = -5;
const GROUND_HEIGHT_MAX = 5;
const SCENE_BRIGHTNESS_MIN = 0;
const SCENE_BRIGHTNESS_MAX = 3;

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ScenePanel() {
  const { t } = useTranslation();
  const scene = useDirectorStore((state) => state.project.scene);
  const updateScene = useDirectorStore((state) => state.updateScene);
  const [sceneScaleDraft, setSceneScaleDraft] = useState(String(scene.scale));
  const [groundHeightDraft, setGroundHeightDraft] = useState(String(scene.groundHeight));

  useEffect(() => {
    setSceneScaleDraft(String(scene.scale));
  }, [scene.scale]);

  useEffect(() => {
    setGroundHeightDraft(String(scene.groundHeight));
  }, [scene.groundHeight]);

  function commitSceneScale(value: string) {
    const parsed = Number(value);
    const nextScale = Number.isFinite(parsed) ? clampNumber(parsed, SCENE_SCALE_MIN, SCENE_SCALE_MAX) : scene.scale;
    updateScene({ scale: nextScale });
    setSceneScaleDraft(String(nextScale));
  }

  function commitGroundHeight(value: string) {
    const parsed = Number(value);
    const nextHeight = Number.isFinite(parsed) ? clampNumber(parsed, GROUND_HEIGHT_MIN, GROUND_HEIGHT_MAX) : scene.groundHeight;
    updateScene({ groundHeight: nextHeight });
    setGroundHeightDraft(String(nextHeight));
  }

  return (
    <InspectorPanel title={t("director3d.scene.title")} ariaLabel={t("director3d.scene.panelAriaLabel")} className="scene-inspector">
      <InspectorRangeNumberField
        label={t("director3d.scene.scale")}
        rangeAriaLabel={t("director3d.scene.scaleRangeAriaLabel")}
        numberAriaLabel={t("director3d.scene.scaleNumberAriaLabel")}
        max={SCENE_SCALE_MAX}
        min={SCENE_SCALE_MIN}
        step="0.01"
        value={sceneScaleDraft}
        onValueChange={commitSceneScale}
        onRangeChange={commitSceneScale}
        onNumberBlur={commitSceneScale}
        onNumberChange={(value) => {
          setSceneScaleDraft(value);
          if (value !== "") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
              updateScene({ scale: parsed });
            }
          }
        }}
      />
      <InspectorAxisGroup
        label={t("director3d.scene.position")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("director3d.scene.positionX"),
            step: "0.1",
            value: scene.position[0],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("director3d.scene.positionY"),
            step: "0.1",
            value: scene.position[1],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("director3d.scene.positionZ"),
            step: "0.1",
            value: scene.position[2],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("director3d.scene.rotation")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("director3d.scene.rotationX"),
            step: "1",
            value: scene.rotation[0],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("director3d.scene.rotationY"),
            step: "1",
            value: scene.rotation[1],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("director3d.scene.rotationZ"),
            step: "1",
            value: scene.rotation[2],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorSection title={t("director3d.scene.background")}>
        <InspectorColorField
          label={t("director3d.scene.skyColor")}
          colorAriaLabel={t("director3d.scene.skyColorAriaLabel")}
          hexAriaLabel={t("director3d.scene.skyColorHexAriaLabel")}
          value={scene.backgroundColor}
          onColorChange={(value) => updateScene({ backgroundColor: value })}
          onHexChange={(value) => updateScene({ backgroundColor: value })}
        />
        <InspectorRangeNumberField
          label={t("director3d.scene.skyBrightness")}
          rangeAriaLabel={t("director3d.scene.skyBrightnessRangeAriaLabel")}
          numberAriaLabel={t("director3d.scene.skyBrightnessNumberAriaLabel")}
          max={SCENE_BRIGHTNESS_MAX}
          min={SCENE_BRIGHTNESS_MIN}
          step="0.05"
          value={scene.backgroundBrightness}
          onValueChange={(value) => updateScene({ backgroundBrightness: Number(value) })}
        />
      </InspectorSection>
      <InspectorSection title={t("director3d.scene.switches")}>
        <div className="scene-switch-row" role="group" aria-label={t("director3d.scene.switchesAriaLabel")}>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("director3d.scene.showLabels")}
              checked={scene.showLabels}
              type="checkbox"
              onChange={(event) => updateScene({ showLabels: event.target.checked })}
            />
            <span>{t("director3d.scene.showLabels")}</span>
          </div>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("director3d.scene.snapToGrid")}
              checked={scene.snapToGrid}
              type="checkbox"
              onChange={(event) => updateScene({ snapToGrid: event.target.checked })}
            />
            <span>{t("director3d.scene.snapToGrid")}</span>
          </div>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("director3d.scene.ground")}
              checked={scene.showGround}
              type="checkbox"
              onChange={(event) => updateScene({ showGround: event.target.checked })}
            />
            <span>{t("director3d.scene.ground")}</span>
          </div>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("director3d.scene.pathCollision")}
              checked={scene.pathCollisionEnabled}
              type="checkbox"
              onChange={(event) => updateScene({ pathCollisionEnabled: event.target.checked })}
            />
            <span>{t("director3d.scene.pathCollision")}</span>
          </div>
        </div>
      </InspectorSection>
      {scene.showGround ? (
        <InspectorSection title={t("director3d.scene.ground")}>
          <InspectorColorField
            label={t("director3d.scene.groundColor")}
            colorAriaLabel={t("director3d.scene.groundColorAriaLabel")}
            hexAriaLabel={t("director3d.scene.groundColorHexAriaLabel")}
            value={scene.groundColor}
            onColorChange={(value) => updateScene({ groundColor: value })}
            onHexChange={(value) => updateScene({ groundColor: value })}
          />
          <InspectorRangeNumberField
            label={t("director3d.scene.groundBrightness")}
            rangeAriaLabel={t("director3d.scene.groundBrightnessRangeAriaLabel")}
            numberAriaLabel={t("director3d.scene.groundBrightnessNumberAriaLabel")}
            max={SCENE_BRIGHTNESS_MAX}
            min={SCENE_BRIGHTNESS_MIN}
            step="0.05"
            value={scene.groundBrightness}
            onValueChange={(value) => updateScene({ groundBrightness: Number(value) })}
          />
          <InspectorRangeNumberField
            label={t("director3d.scene.opacity")}
            rangeAriaLabel={t("director3d.scene.opacityRangeAriaLabel")}
            numberAriaLabel={t("director3d.scene.opacityNumberAriaLabel")}
            max="1"
            min="0"
            step="0.01"
            value={scene.groundOpacity}
            onValueChange={(value) => updateScene({ groundOpacity: Number(value) })}
          />
          <InspectorRangeNumberField
            label={t("director3d.scene.height")}
            rangeAriaLabel={t("director3d.scene.heightRangeAriaLabel")}
            numberAriaLabel={t("director3d.scene.heightNumberAriaLabel")}
            max={GROUND_HEIGHT_MAX}
            min={GROUND_HEIGHT_MIN}
            step="0.1"
            value={groundHeightDraft}
            onValueChange={commitGroundHeight}
            onRangeChange={commitGroundHeight}
            onNumberBlur={commitGroundHeight}
            onNumberChange={(value) => {
              setGroundHeightDraft(value);
              if (value !== "") {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) {
                  updateScene({ groundHeight: parsed });
                }
              }
            }}
          />
        </InspectorSection>
      ) : null}
    </InspectorPanel>
  );
}
