import { useTranslation } from "react-i18next";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
} from "./InspectorControls";
import { useDirectorStore } from "../store/directorStore";

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function PropPanel() {
  const { t } = useTranslation();
  const prop = useDirectorStore((state) => {
    const selected = state.project.objects.find((item) => item.id === state.selectedObjectId);
    const selectedAsset = selected?.assetRefId
      ? state.project.assets.find((asset) => asset.id === selected.assetRefId)
      : undefined;

    if (!selected) return undefined;
    if (selected.kind === "prop") return selected;
    if (selectedAsset?.sourceType === "model") return selected;

    return undefined;
  });
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);

  if (!prop) return null;

  const propColor = prop.color ?? "#d7e7ff";

  return (
    <InspectorPanel title={t("director3d.prop.title")} ariaLabel={t("director3d.prop.panelAriaLabel")} className="prop-inspector">
      <InspectorTextField label={t("director3d.name")} ariaLabel={t("director3d.prop.nameAriaLabel")} value={prop.name} onChange={(value) => updateObjectName(prop.id, value)} />
      <InspectorAxisGroup
        label={t("director3d.position")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("director3d.prop.positionX"),
            value: prop.transform.position[0],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("director3d.prop.positionY"),
            value: prop.transform.position[1],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("director3d.prop.positionZ"),
            value: prop.transform.position[2],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("director3d.rotation")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("director3d.prop.rotationX"),
            value: prop.transform.rotation[0],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("director3d.prop.rotationY"),
            value: prop.transform.rotation[1],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("director3d.prop.rotationZ"),
            value: prop.transform.rotation[2],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("director3d.scale")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("director3d.prop.scaleX"),
            step: "0.01",
            value: prop.transform.scale[0],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("director3d.prop.scaleY"),
            step: "0.01",
            value: prop.transform.scale[1],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("director3d.prop.scaleZ"),
            step: "0.01",
            value: prop.transform.scale[2],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorRangeNumberField
        label={t("director3d.uniformScale")}
        rangeAriaLabel={t("director3d.prop.uniformScaleRangeAriaLabel")}
        numberAriaLabel={t("director3d.prop.uniformScaleNumberAriaLabel")}
        max="3"
        min="0.2"
        step="0.01"
        value={prop.transform.scale[0]}
        onValueChange={(value) => updateUniformScale(prop.id, Number(value))}
      />
      <InspectorColorField
        label={t("director3d.color")}
        colorAriaLabel={t("director3d.prop.colorAriaLabel")}
        hexAriaLabel={t("director3d.prop.colorHexAriaLabel")}
        value={propColor}
        onColorChange={(value) => updateObjectColor(prop.id, value)}
        onHexChange={(value) => updateObjectColor(prop.id, value)}
      />
    </InspectorPanel>
  );
}
