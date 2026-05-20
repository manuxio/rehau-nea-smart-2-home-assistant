import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import type { Installation } from "../types";

interface Props {
  installation: Installation;
  message: string;
  onRetry: () => void;
  onManage: () => void;
}

export const ErrorScreen = ({ installation, message, onRetry, onManage }: Props) => (
  <View style={styles.root}>
    <View style={styles.icon}>
      <Text style={styles.iconText}>!</Text>
    </View>
    <Text style={styles.title}>Cannot reach bridge</Text>
    <Text style={styles.installationName}>{installation.name}</Text>
    <Text style={styles.url}>{installation.url}</Text>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.actions}>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
        onPress={onRetry}
      >
        <Text style={styles.btnPrimaryText}>Retry</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
        onPress={onManage}
      >
        <Text style={styles.btnSecondaryText}>Manage installations</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#FFF",
    fontSize: 38,
    fontWeight: "700",
  },
  title: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 18,
  },
  installationName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 14,
  },
  url: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  message: {
    color: theme.textDim,
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
    maxWidth: 320,
  },
  actions: {
    marginTop: 28,
    width: "100%",
    maxWidth: 320,
    gap: 10,
  },
  btn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: theme.accent,
  },
  btnPrimaryText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  btnSecondary: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnSecondaryText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "500",
  },
  btnPressed: {
    opacity: 0.7,
  },
});
