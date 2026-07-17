// 桌面端适配：postMessage 桥接替换为空操作
// 原始版本通过 window.parent.postMessage 与父窗口通信
// 桌面端无需此功能，提供空实现保持 CameraPanel 不变

export function postDirectorDeskCapturesToHost(
  captures: Array<{
    dataUrl: string;
    fileName?: string;
  }>
) {
  console.log('[Director3D] Captures ready:', captures.length)
}

export function initDirectorDeskHostBridge() {
  // 桌面端无需初始化桥接
}
