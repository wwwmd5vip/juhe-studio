import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LocateFixed, MapPinPlus, Plus, Trash2 } from "lucide-react";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
  InspectorSection,
} from "./InspectorControls";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { CHARACTER_ACTION_PRESETS } from "../presets/characterActionPresets";
import { getCameraMotionPath } from "../schema/cameraMotion";
import { normalizeObjectMotionPath } from "../schema/objectMotion";
import { getCrowdAnchorTransform, useDirectorStore } from "../store/directorStore";

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function CharacterPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"properties" | "pose" | "action" | "route">("properties");
  const selectedCrowdId = useDirectorStore((state) => state.selectedCrowdId);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const cameras = useDirectorStore((state) => state.project.cameras);
  const activeCameraId = useDirectorStore((state) => state.project.activeCameraId);
  const cameraMotionProgress = useDirectorStore((state) => state.cameraMotionProgress);
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateCrowdLabel = useDirectorStore((state) => state.updateCrowdLabel);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateCrowdTransform = useDirectorStore((state) => state.updateCrowdTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateCrowdUniformScale = useDirectorStore((state) => state.updateCrowdUniformScale);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);
  const updateCrowdColor = useDirectorStore((state) => state.updateCrowdColor);
  const applyPosePreset = useDirectorStore((state) => state.applyPosePreset);
  const applyCrowdPosePreset = useDirectorStore((state) => state.applyCrowdPosePreset);
  const updatePoseControl = useDirectorStore((state) => state.updatePoseControl);
  const updateCrowdPoseControl = useDirectorStore((state) => state.updateCrowdPoseControl);
  const applyCharacterActionPreset = useDirectorStore((state) => state.applyCharacterActionPreset);
  const applyCrowdActionPreset = useDirectorStore((state) => state.applyCrowdActionPreset);
  const setCameraMotionProgress = useDirectorStore((state) => state.setCameraMotionProgress);
  const setCameraMotionPlaying = useDirectorStore((state) => state.setCameraMotionPlaying);
  const addCharacterRoutePoint = useDirectorStore((state) => state.addCharacterRoutePoint);
  const insertObjectMotionKeyframeAfter = useDirectorStore((state) => state.insertObjectMotionKeyframeAfter);
  const deleteObjectMotionKeyframe = useDirectorStore((state) => state.deleteObjectMotionKeyframe);
  const selectedObjectMotionKeyframeId = useDirectorStore((state) => state.selectedObjectMotionKeyframeId);
  const selectObjectMotionKeyframe = useDirectorStore((state) => state.selectObjectMotionKeyframe);
  const updateObjectMotionKeyframe = useDirectorStore((state) => state.updateObjectMotionKeyframe);
  const updateObjectMotionPath = useDirectorStore((state) => state.updateObjectMotionPath);

  const selection = useMemo(() => {
    const role = objects.find((item) => item.id === selectedObjectId && item.kind === "character");

    if (selectedCrowdId) {
      const crowdMembers = objects.filter((item) => item.kind === "character" && item.crowdId === selectedCrowdId);
      const crowdAnchor = getCrowdAnchorTransform(objects, selectedCrowdId);

      if (crowdMembers.length && crowdAnchor) {
        return {
          mode: "crowd" as const,
          crowdId: selectedCrowdId,
          crowdMembers,
          crowdAnchor,
          role: crowdMembers[crowdMembers.length - 1] ?? crowdMembers[0],
          name: crowdMembers[0]?.crowdLabel ?? t("director3d.character.crowdDefaultName"),
          color: crowdMembers[0]?.color ?? "#4F8EF7",
        };
      }
    }

    if (!role) return null;

    return {
      mode: "single" as const,
      crowdId: null,
      crowdMembers: [role],
      crowdAnchor: role.transform,
      role,
      name: role.name,
      color: role.color ?? "#4F8EF7",
    };
  }, [objects, selectedCrowdId, selectedObjectId, t]);

  if (!selection) return null;

  const role = selection.role;
  const roleColor = selection.color;
  const transform = selection.crowdAnchor;
  const isCrowd = selection.mode === "crowd";
  const routePath = normalizeObjectMotionPath(role.motionPath, role.transform);
  const selectedRoutePoint = routePath.keyframes.find((item) => item.id === selectedObjectMotionKeyframeId) ?? null;
  const activeCamera = cameras.find((item) => item.id === activeCameraId) ?? cameras[0];
  const timelineDuration = activeCamera ? getCameraMotionPath(activeCamera).duration : 6;
  const poseGroups = [
    {
      title: t("director3d.character.body"),
      controls: [
        { key: "body.pitch", label: t("director3d.character.bodyPitch") },
        { key: "body.yaw", label: t("director3d.character.bodyYaw") },
        { key: "body.roll", label: t("director3d.character.bodyRoll") },
      ],
    },
    {
      title: t("director3d.character.torso"),
      controls: [
        { key: "torso.pitch", label: t("director3d.character.torsoPitch") },
        { key: "torso.yaw", label: t("director3d.character.torsoYaw") },
        { key: "torso.roll", label: t("director3d.character.torsoRoll") },
      ],
    },
    {
      title: t("director3d.character.head"),
      controls: [
        { key: "head.pitch", label: t("director3d.character.headPitch") },
        { key: "head.yaw", label: t("director3d.character.headYaw") },
        { key: "head.roll", label: t("director3d.character.headRoll") },
      ],
    },
    {
      title: t("director3d.character.leftShoulder"),
      controls: [
        { key: "leftShoulder.pitch", label: t("director3d.character.shoulderPitch") },
        { key: "leftShoulder.spread", label: t("director3d.character.shoulderSpread") },
        { key: "leftShoulder.twist", label: t("director3d.character.shoulderTwist") },
      ],
    },
    {
      title: t("director3d.character.rightShoulder"),
      controls: [
        { key: "rightShoulder.pitch", label: t("director3d.character.shoulderPitch") },
        { key: "rightShoulder.spread", label: t("director3d.character.shoulderSpread") },
        { key: "rightShoulder.twist", label: t("director3d.character.shoulderTwist") },
      ],
    },
    {
      title: t("director3d.character.leftElbow"),
      controls: [{ key: "leftElbow.bend", label: t("director3d.character.elbowBend") }],
    },
    {
      title: t("director3d.character.rightElbow"),
      controls: [{ key: "rightElbow.bend", label: t("director3d.character.elbowBend") }],
    },
    {
      title: t("director3d.character.leftHip"),
      controls: [
        { key: "leftHip.pitch", label: t("director3d.character.hipPitch") },
        { key: "leftHip.spread", label: t("director3d.character.hipSpread") },
        { key: "leftHip.twist", label: t("director3d.character.hipTwist") },
      ],
    },
    {
      title: t("director3d.character.rightHip"),
      controls: [
        { key: "rightHip.pitch", label: t("director3d.character.hipPitch") },
        { key: "rightHip.spread", label: t("director3d.character.hipSpread") },
        { key: "rightHip.twist", label: t("director3d.character.hipTwist") },
      ],
    },
    {
      title: t("director3d.character.leftKnee"),
      controls: [{ key: "leftKnee.bend", label: t("director3d.character.kneeBend") }],
    },
    {
      title: t("director3d.character.rightKnee"),
      controls: [{ key: "rightKnee.bend", label: t("director3d.character.kneeBend") }],
    },
  ] as const;

  return (
    <InspectorPanel
      title={t("director3d.character.title")}
      ariaLabel={t("director3d.character.panelAriaLabel")}
      className="character-inspector"
      tabs={[
        { label: t("director3d.properties"), active: activeTab === "properties", onClick: () => setActiveTab("properties") },
        { label: t("director3d.character.poseTab"), active: activeTab === "pose", onClick: () => setActiveTab("pose") },
        { label: t("director3d.character.actionTab"), active: activeTab === "action", onClick: () => setActiveTab("action") },
        { label: t("director3d.character.routeTab"), active: activeTab === "route", onClick: () => setActiveTab("route") },
      ]}
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label={t("director3d.name")}
            ariaLabel={t("director3d.character.nameAriaLabel")}
            value={selection.name}
            onChange={(value) => {
              if (isCrowd && selection.crowdId) {
                updateCrowdLabel(selection.crowdId, value);
                return;
              }

              updateObjectName(role.id, value);
            }}
          />
          <InspectorAxisGroup
            label={t("director3d.position")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("director3d.character.positionX"),
                value: transform.position[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("director3d.character.positionY"),
                value: transform.position[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("director3d.character.positionZ"),
                value: transform.position[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label={t("director3d.rotation")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("director3d.character.rotationX"),
                value: transform.rotation[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("director3d.character.rotationY"),
                value: transform.rotation[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("director3d.character.rotationZ"),
                value: transform.rotation[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label={t("director3d.scale")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("director3d.character.scaleX"),
                step: "0.01",
                value: transform.scale[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("director3d.character.scaleY"),
                step: "0.01",
                value: transform.scale[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("director3d.character.scaleZ"),
                step: "0.01",
                value: transform.scale[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorRangeNumberField
            label={t("director3d.uniformScale")}
            rangeAriaLabel={t("director3d.character.uniformScaleRangeAriaLabel")}
            numberAriaLabel={t("director3d.character.uniformScaleNumberAriaLabel")}
            max="3"
            min="0.2"
            step="0.01"
            value={transform.scale[0]}
            onValueChange={(value) =>
              isCrowd && selection.crowdId
                ? updateCrowdUniformScale(selection.crowdId, Number(value))
                : updateUniformScale(role.id, Number(value))
            }
          />
          <InspectorColorField
            label={t("director3d.color")}
            colorAriaLabel={t("director3d.character.colorAriaLabel")}
            hexAriaLabel={t("director3d.character.colorHexAriaLabel")}
            value={roleColor}
            onColorChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
            onHexChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
          />
        </>
      ) : activeTab === "pose" ? (
        <InspectorSection title={t("director3d.character.posePresets")} className="pose-preset-section">
          {role.characterRig ? (
            <>
              <div className="preset-grid">
                {MANNEQUIN_POSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={role.characterRig?.posePresetId === preset.id ? "is-active" : undefined}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? applyCrowdPosePreset(selection.crowdId, preset.id)
                        : applyPosePreset(role.id, preset.id)
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <InspectorSection title={t("director3d.character.poseAdjust")} className="pose-adjust-section">
                <div className="pose-groups">
                  {poseGroups.map((group) => (
                    <section key={group.title} className="pose-group">
                      <h4>{group.title}</h4>
                      {group.controls.map((control) => (
                        <InspectorRangeNumberField
                          key={control.key}
                          label={control.label}
                          rangeAriaLabel={t("director3d.character.poseControlRangeAriaLabel", { group: group.title, label: control.label })}
                          numberAriaLabel={t("director3d.character.poseControlNumberAriaLabel", { group: group.title, label: control.label })}
                          max="90"
                          min="-90"
                          step="1"
                          value={role.characterRig?.controls[control.key] ?? 0}
                          onValueChange={(value) =>
                            isCrowd && selection.crowdId
                              ? updateCrowdPoseControl(selection.crowdId, control.key, Number(value))
                              : updatePoseControl(role.id, control.key, Number(value))
                          }
                        />
                      ))}
                    </section>
                  ))}
                </div>
              </InspectorSection>
            </>
          ) : (
            <p>{t("director3d.character.noHumanoidRig")}</p>
          )}
        </InspectorSection>
      ) : activeTab === "action" ? (
        <InspectorSection title={t("director3d.character.actionPresets")} className="pose-preset-section">
          <div className="preset-grid">
            <button
              className={!role.characterRig?.actionPresetId ? "is-active" : undefined}
              type="button"
              onClick={() => {
                if (isCrowd && selection.crowdId) applyCrowdActionPreset(selection.crowdId, null);
                else applyCharacterActionPreset(role.id, null);
                setCameraMotionPlaying(false);
              }}
            >
              {t("director3d.character.noAction")}
            </button>
            {CHARACTER_ACTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={role.characterRig?.actionPresetId === preset.id ? "is-active" : undefined}
                type="button"
                aria-label={t("director3d.character.playAction", { label: preset.label })}
                onClick={() => {
                  if (isCrowd && selection.crowdId) applyCrowdActionPreset(selection.crowdId, preset.id);
                  else applyCharacterActionPreset(role.id, preset.id);
                  setCameraMotionProgress(0);
                  setCameraMotionPlaying(true);
                }}
              >
                <span>{preset.label}</span>
                <small>{preset.duration.toFixed(2)} {t("director3d.common.seconds")}</small>
              </button>
            ))}
          </div>
        </InspectorSection>
      ) : (
        <InspectorSection title={t("director3d.character.route")} className="pose-preset-section">
          {isCrowd ? (
            <p>{t("director3d.character.crowdRouteUnsupported")}</p>
          ) : (
            <>
              <div className="character-route-toolbar" aria-label={t("director3d.character.routeToolbarAriaLabel")}>
                <button
                  className="character-route-add"
                  type="button"
                  onClick={() => {
                    setCameraMotionPlaying(false);
                    const id = addCharacterRoutePoint(role.id);
                    if (id) selectObjectMotionKeyframe(id);
                  }}
                >
                  <MapPinPlus aria-hidden="true" size={14} />
                  {t("director3d.character.addRoutePoint")}
                </button>
                <button
                  aria-label={t("director3d.character.previewRoutePoint")}
                  title={t("director3d.character.locatePreview")}
                  className="character-route-icon-button"
                  type="button"
                  disabled={!selectedRoutePoint}
                  onClick={() => {
                    if (selectedRoutePoint) setCameraMotionProgress(selectedRoutePoint.time);
                  }}
                >
                  <LocateFixed aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label={t("director3d.character.insertAfterRoutePoint")}
                  title={t("director3d.character.insertAfterTooltip")}
                  className="character-route-icon-button"
                  type="button"
                  disabled={!selectedRoutePoint || routePath.keyframes[routePath.keyframes.length - 1]?.id === selectedRoutePoint.id}
                  onClick={() => {
                    if (!selectedRoutePoint) return;
                    const id = insertObjectMotionKeyframeAfter(role.id, selectedRoutePoint.id);
                    if (id) selectObjectMotionKeyframe(id);
                  }}
                >
                  <Plus aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label={t("director3d.character.deleteRoutePoint")}
                  title={t("director3d.character.deleteRoutePointTooltip")}
                  className="character-route-icon-button is-danger"
                  type="button"
                  disabled={!selectedRoutePoint}
                  onClick={() => {
                    if (!selectedRoutePoint) return;
                    deleteObjectMotionKeyframe(role.id, selectedRoutePoint.id);
                    selectObjectMotionKeyframe(null);
                  }}
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </div>
              <div className="character-route-shape" role="group" aria-label={t("director3d.character.routeShapeAriaLabel")}>
                <span>{t("director3d.character.route")}</span>
                <button
                  type="button"
                  aria-pressed={routePath.interpolation === "smooth"}
                  onClick={() => updateObjectMotionPath(role.id, { interpolation: "smooth" })}
                >
                  {t("director3d.character.routeSmooth")}
                </button>
                <button
                  type="button"
                  aria-pressed={routePath.interpolation === "linear"}
                  onClick={() => updateObjectMotionPath(role.id, { interpolation: "linear" })}
                >
                  {t("director3d.character.routeLinear")}
                </button>
              </div>
              <div className="character-route-points" role="group" aria-label={t("director3d.character.routePointsAriaLabel")}>
                {routePath.keyframes.map((point, index) => (
                  <button
                    key={point.id}
                    className={point.id === selectedRoutePoint?.id ? "is-active" : undefined}
                    type="button"
                    aria-label={t("director3d.character.selectRoutePoint", { index: index + 1 })}
                    aria-pressed={point.id === selectedRoutePoint?.id}
                    onClick={() => {
                      selectObjectMotionKeyframe(point.id);
                    }}
                  >
                    <strong>{index + 1}</strong>
                    <span>{(point.time * timelineDuration).toFixed(1)} {t("director3d.common.seconds")}</span>
                  </button>
                ))}
              </div>
              {selectedRoutePoint ? (
                <InspectorSection title={t("director3d.character.routePointTitle", { index: routePath.keyframes.findIndex((point) => point.id === selectedRoutePoint.id) + 1 })} className="character-route-editor">
                  <InspectorRangeNumberField
                    label={t("director3d.character.arrivalTime")}
                    rangeAriaLabel={t("director3d.character.arrivalTimeRangeAriaLabel")}
                    numberAriaLabel={t("director3d.character.arrivalTimeNumberAriaLabel")}
                    min="0"
                    max={String(timelineDuration)}
                    step="0.1"
                    value={selectedRoutePoint.time * timelineDuration}
                    onValueChange={(value) => updateObjectMotionKeyframe(role.id, selectedRoutePoint.id, {
                      time: Math.min(1, Math.max(0, Number(value) / timelineDuration)),
                    })}
                  />
                  <InspectorAxisGroup
                    label={t("director3d.character.routePointPosition")}
                    axes={([0, 1, 2] as const).map((axis) => ({
                      axis: (["X", "Y", "Z"] as const)[axis],
                      ariaLabel: t("director3d.character.routePointPositionAxis", { axis: (["X", "Y", "Z"] as const)[axis] }),
                      value: selectedRoutePoint.transform.position[axis],
                      onChange: (value: string) => updateObjectMotionKeyframe(role.id, selectedRoutePoint.id, {
                        transform: { position: replaceAxis(selectedRoutePoint.transform.position, axis, Number(value)) },
                      }),
                    }))}
                  />
                  <label className="inspector-field">
                    <span className="inspector-field-label">{t("director3d.character.segmentAction")}</span>
                    <select
                      aria-label={t("director3d.character.segmentActionAriaLabel")}
                      value={selectedRoutePoint.actionPresetId ?? ""}
                      onChange={(event) => updateObjectMotionKeyframe(role.id, selectedRoutePoint.id, {
                        actionPresetId: event.currentTarget.value || null,
                      })}
                    >
                      <option value="">{t("director3d.character.autoWalk")}</option>
                      {CHARACTER_ACTION_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                    </select>
                  </label>
                  <label className="inspector-field">
                    <span className="inspector-field-label">{t("director3d.character.facingAtPoint")}</span>
                    <select
                      aria-label={t("director3d.character.facingModeAriaLabel")}
                      value={selectedRoutePoint.facingMode ?? "manual"}
                      onChange={(event) => updateObjectMotionKeyframe(role.id, selectedRoutePoint.id, {
                        facingMode: event.currentTarget.value === "path" ? "path" : "manual",
                      })}
                    >
                      <option value="path">{t("director3d.character.faceNextPoint")}</option>
                      <option value="manual">{t("director3d.character.manualFacing")}</option>
                    </select>
                  </label>
                  {selectedRoutePoint.facingMode !== "path" ? (
                    <InspectorRangeNumberField
                      label={t("director3d.character.manualFacing")}
                      rangeAriaLabel={t("director3d.character.manualFacingRangeAriaLabel")}
                      numberAriaLabel={t("director3d.character.manualFacingNumberAriaLabel")}
                      min="-180"
                      max="180"
                      step="1"
                      value={selectedRoutePoint.transform.rotation[1] * 180 / Math.PI}
                      onValueChange={(value) => updateObjectMotionKeyframe(role.id, selectedRoutePoint.id, {
                        transform: {
                          rotation: replaceAxis(
                            selectedRoutePoint.transform.rotation,
                            1,
                            Number(value) * Math.PI / 180
                          ),
                        },
                      })}
                    />
                  ) : null}
                </InspectorSection>
              ) : <p>{t("director3d.character.addFirstRoutePointHint")}</p>}
            </>
          )}
        </InspectorSection>
      )}
    </InspectorPanel>
  );
}
