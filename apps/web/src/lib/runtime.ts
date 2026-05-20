// Runtime detection: is this SPA inside the @rehau/mobile React Native shell?
//
// The shell injects (a) `window.ReactNativeWebView` — provided by
// react-native-webview itself — and (b) `window.__NATIVE_SHELL__` — set by our
// own `injectedJavaScriptBeforeContentLoaded` in apps/mobile/src/screens/
// WebAppScreen.tsx, carrying the current installation metadata.
//
// We deliberately keep the contract tiny so the SPA stays usable in any
// context (browser PWA, HA ingress, mobile shell) without branching.

interface NativeShellInfo {
  runtime: "react-native";
  installation: { id: string; name: string; url: string };
}

interface ReactNativeWebViewBridge {
  postMessage: (data: string) => void;
}

declare global {
  interface Window {
    __NATIVE_SHELL__?: NativeShellInfo;
    ReactNativeWebView?: ReactNativeWebViewBridge;
  }
}

/** True iff the SPA is running inside the @rehau/mobile WebView. */
export const isInNativeShell = (): boolean =>
  typeof window !== "undefined" && typeof window.ReactNativeWebView === "object";

/** The installation the native shell is showing, if any. */
export const currentNativeInstallation = (): NativeShellInfo["installation"] | null =>
  window.__NATIVE_SHELL__?.installation ?? null;

/** Ask the native shell to open its installations manager sheet. */
export const requestSwitchInstallation = (): void => {
  const bridge = window.ReactNativeWebView;
  if (!bridge) return;
  try {
    bridge.postMessage(JSON.stringify({ type: "open-installations" }));
  } catch {
    /* ignore */
  }
};
