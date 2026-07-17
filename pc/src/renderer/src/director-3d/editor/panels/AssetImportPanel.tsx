import { useState } from "react";
import { useTranslation } from "react-i18next";
import { readLocalModelFile } from "../loaders/localModelImport";
import { getDirector3dErrorMessage } from "../io/errorMessages";
import { useDirectorStore } from "../store/directorStore";

export function AssetImportPanel() {
  const { t } = useTranslation();
  const addImportedAsset = useDirectorStore((state) => state.addImportedAsset);
  const assets = useDirectorStore((state) => state.project.assets);
  const [importError, setImportError] = useState<string | null>(null);

  const latestLocalModel = [...assets].reverse().find((item) => item.sourceType === "model");

  async function handleLocalModel(file: File) {
    setImportError(null);
    const result = await readLocalModelFile(file);
    addImportedAsset({ kind: "prop", ...result });
  }

  return (
    <section className="panel-card">
      <h2>{t("director3d.import.title")}</h2>
      <label className="asset-import-item">
        {t("director3d.import.localModel")}
        <input
          aria-label={t("director3d.import.localModel")}
          accept=".fbx,.obj"
          type="file"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await handleLocalModel(file);
            } catch (error) {
              setImportError(
                error instanceof Error
                  ? getDirector3dErrorMessage(error, t)
                  : t("director3d.error.importFailed")
              );
            } finally {
              input.value = "";
            }
          }}
        />
        <p className="asset-import-status">
          {latestLocalModel
            ? t("director3d.import.imported", { fileName: latestLocalModel.fileName })
            : t("director3d.import.supportedFormats")}
        </p>
      </label>
      {importError ? <p className="capture-status">{importError}</p> : null}
    </section>
  );
}
