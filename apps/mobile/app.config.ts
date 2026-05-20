import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "REHAU Nea",
  slug: "rehau-nea-mobile",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "rehau-nea",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0F0B1A",
  },
  ios: {
    bundleIdentifier: "io.iqera.rehau.nea",
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      NSCameraUsageDescription:
        "Used to scan a QR code containing the URL of a REHAU bridge to add it as an installation.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "io.iqera.rehau.nea",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0F0B1A",
    },
    permissions: ["android.permission.CAMERA"],
  },
  plugins: [
    [
      "expo-build-properties",
      {
        // REHAU bridge speaks HTTP on the LAN. Without this, Android 9+ blocks
        // cleartext loads inside the WebView. iOS counterpart lives in
        // ios.infoPlist.NSAppTransportSecurity above.
        android: { usesCleartextTraffic: true },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Used to scan a QR code containing the URL of a REHAU bridge to add it as an installation.",
        recordAudioAndroid: false,
      },
    ],
  ],
};

export default config;
