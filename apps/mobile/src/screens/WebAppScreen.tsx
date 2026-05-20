import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { theme } from "../theme";
import type { Installation } from "../types";

interface Props {
  installation: Installation;
  onOpenManager: () => void;
  /**
   * Bumped each time the user requests a forced reload (e.g. clicked Retry after
   * an error). The WebView is keyed on installation.id so origin switches remount
   * (per-origin localStorage in WKWebView/Android WebView persists across remount).
   */
  reloadNonce: number;
  onLoadError: (message: string) => void;
}

/**
 * Runs once *before* the SPA's own scripts execute. Exposes the active
 * installation to the SPA so it can show the name in its own UI (the SPA owns
 * an "Installation" row in System + a link on the login screen — see
 * apps/web/src/lib/runtime.ts) and gives it a stable handle for requesting
 * a switch via postMessage. We pass the URL too for completeness, though the
 * SPA shouldn't display it — by design URL editing lives only in the native
 * installations sheet.
 */
const buildBeforeContentScript = (i: Installation) => `
  window.__NATIVE_SHELL__ = ${JSON.stringify({
    runtime: "react-native",
    installation: { id: i.id, name: i.name, url: i.url },
  })};
  true;
`;

/**
 * Runs once after the page loads. Forwards window.onerror through the
 * existing message channel so the native shell can surface SPA crashes
 * instead of leaving the user stranded on a broken WebView.
 */
const INJECTED_AFTER_LOAD = `
(function(){
  try {
    window.addEventListener('error', function(e){
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'jserror', message: String(e.message||e)}));
      } catch(_){}
    });
  } catch(_){}
  true;
})();
`;

export const WebAppScreen = ({
  installation,
  onOpenManager,
  reloadNonce,
  onLoadError,
}: Props) => {
  const ref = useRef<WebView | null>(null);
  const [loading, setLoading] = useState(true);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type?: string; message?: string };
      if (data?.type === "open-installations") {
        onOpenManager();
      } else if (data?.type === "jserror") {
        // intentionally non-fatal — only log for now
        console.warn("[webview-jserror]", data.message);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.webHolder}>
        <WebView
          ref={ref}
          key={`${installation.id}-${reloadNonce}`}
          source={{ uri: installation.url }}
          originWhitelist={["http://*", "https://*"]}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          incognito={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          startInLoadingState
          applicationNameForUserAgent="REHAUNeaApp/0.1.0"
          injectedJavaScriptBeforeContentLoaded={buildBeforeContentScript(installation)}
          injectedJavaScript={INJECTED_AFTER_LOAD}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            onLoadError(e.nativeEvent.description || "WebView load error");
          }}
          onHttpError={(e) => {
            setLoading(false);
            const code = e.nativeEvent.statusCode;
            if (code >= 500) onLoadError(`Bridge HTTP ${code}`);
          }}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={theme.accent} />
            </View>
          )}
          style={{ flex: 1, backgroundColor: theme.bg }}
        />
        {loading && (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  webHolder: { flex: 1, position: "relative" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
