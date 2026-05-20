import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import type { Installation } from "../types";

export const ConnectingScreen = ({ installation }: { installation: Installation }) => (
  <View style={styles.root}>
    <ActivityIndicator size="large" color={theme.accent} />
    <Text style={styles.title}>Connecting…</Text>
    <Text style={styles.subtitle}>{installation.name}</Text>
    <Text style={styles.url}>{installation.url}</Text>
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
  title: {
    color: theme.text,
    fontSize: 18,
    marginTop: 18,
  },
  subtitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  url: {
    color: theme.textDim,
    fontSize: 13,
    marginTop: 4,
  },
});
