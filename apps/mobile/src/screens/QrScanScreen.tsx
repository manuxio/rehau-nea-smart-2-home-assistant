import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseQrPayload, type QrPayload } from "../qrPayload";
import { theme } from "../theme";

interface Props {
  onCancel: () => void;
  onResult: (payload: QrPayload) => void;
}

export const QrScanScreen = ({ onCancel, onResult }: Props) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // Debounce so a steady camera doesn't fire onBarcodeScanned 60 times/sec.
  const lockedRef = useRef(false);

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lockedRef.current) return;
      const payload = parseQrPayload(data);
      if (!payload) {
        setError(
          `Scanned QR doesn't contain a URL. Got: ${data.length > 50 ? data.slice(0, 47) + "…" : data}`,
        );
        return;
      }
      lockedRef.current = true;
      onResult(payload);
    },
    [onResult],
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Header onCancel={onCancel} />
        <View style={styles.center}>
          <Text style={styles.permTitle}>Camera permission required</Text>
          <Text style={styles.permBody}>
            Allow camera access to scan a REHAU bridge QR code. The camera is used only on this
            screen and never stores images.
          </Text>
          {permission.canAskAgain ? (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => void Linking.openSettings()}
            >
              <Text style={styles.primaryBtnText}>
                {Platform.OS === "ios" ? "Open iOS Settings" : "Open app settings"}
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Header onCancel={onCancel} />
      <View style={styles.cameraHolder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScanned}
        />
        <View pointerEvents="none" style={styles.reticleHolder}>
          <View style={styles.reticle} />
          <Text style={styles.reticleHint}>Point at a REHAU bridge QR code</Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
};

const Header = ({ onCancel }: { onCancel: () => void }) => (
  <View style={styles.header}>
    <Pressable onPress={onCancel} hitSlop={10}>
      <Text style={styles.headerBtn}>Cancel</Text>
    </Pressable>
    <Text style={styles.headerTitle}>Scan QR code</Text>
    <View style={styles.headerSpacer} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 16, fontWeight: "600" },
  headerBtn: { color: theme.accent, fontSize: 15 },
  headerSpacer: { width: 50 },
  cameraHolder: { flex: 1, position: "relative" },
  reticleHolder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: theme.accent,
  },
  reticleHint: {
    marginTop: 24,
    color: "#FFF",
    fontSize: 14,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  error: {
    marginTop: 12,
    color: theme.danger,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 10,
    overflow: "hidden",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: theme.bg,
  },
  permTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  permBody: {
    color: theme.textDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
    maxWidth: 320,
  },
  primaryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: theme.accent,
  },
  primaryBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  btnPressed: { opacity: 0.7 },
});
