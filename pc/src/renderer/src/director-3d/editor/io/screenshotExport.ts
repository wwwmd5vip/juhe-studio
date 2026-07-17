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

export function buildScreenshotMeta(input: ScreenshotMeta) {
  return input;
}

/**
 * Build a PNG file name for a captured screenshot.
 *
 * @param result - The screenshot result containing label and meta.
 * @param fileNameBase - Required base string for the file name.
 * @param index - Zero-based index appended to the file name (defaults to 0).
 */
export function buildCaptureFileName(
  result: ScreenshotResult,
  fileNameBase: string,
  index = 0
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

/**
 * Download all captured screenshots.
 *
 * @param results - The screenshot results to download.
 * @param fileNameBase - Required base string for each file name.
 */
export function downloadCaptureResults(
  results: ScreenshotResult[],
  fileNameBase: string
) {
  results.forEach((result, index) => {
    downloadDataUrl(result.dataUrl, buildCaptureFileName(result, fileNameBase, index));
  });

  return results.length;
}
