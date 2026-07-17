export interface ScreenshotMeta {
  mode: "director" | "camera";
  cameraId: string | null;
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
}

export interface ScreenshotResult {
  label: string;
  dataUrl: string;
  meta: ScreenshotMeta;
}

export const DEFAULT_SCREENSHOT_FILE_NAME_BASE = 'storyai-director-desk';

export function buildScreenshotMeta(input: ScreenshotMeta) {
  return input;
}

export function buildCaptureFileName(
  result: ScreenshotResult,
  index = 0,
  fileNameBase = DEFAULT_SCREENSHOT_FILE_NAME_BASE
) {
  const labelSlug = result.label.replace(/\s+/g, "-");
  const cameraSuffix = result.meta.cameraId ? `-${result.meta.cameraId}` : "";
  return `${fileNameBase}-${result.meta.mode}${cameraSuffix}-${labelSlug}-${index + 1}.png`;
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
}

export function downloadCaptureResults(
  results: ScreenshotResult[],
  fileNameBase = DEFAULT_SCREENSHOT_FILE_NAME_BASE
) {
  results.forEach((result, index) => {
    downloadDataUrl(result.dataUrl, buildCaptureFileName(result, index, fileNameBase));
  });

  return results.length;
}
