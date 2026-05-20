import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { probe } from "../health";
import type { QrPayload } from "../qrPayload";
import { newId, normalizeUrl } from "../storage";
import { theme } from "../theme";
import type { Installation } from "../types";
import { QrScanScreen } from "./QrScanScreen";

interface Props {
  installation: Installation | null;
  onCancel: () => void;
  onSave: (i: Installation) => void;
  onDelete?: (id: string) => void;
}

export const InstallationEditScreen = ({ installation, onCancel, onSave, onDelete }: Props) => {
  const [name, setName] = useState(installation?.name ?? "");
  const [url, setUrl] = useState(installation?.url ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScanned = (payload: QrPayload) => {
    setScanning(false);
    setUrl(payload.url);
    if (payload.name && !name.trim()) setName(payload.name);
    setTestResult(null);
  };

  const normalized = normalizeUrl(url);
  const isUrlValid = /^https?:\/\/[^\s]+$/i.test(normalized);
  const isNameValid = name.trim().length > 0;
  const canSave = isUrlValid && isNameValid;

  const handleTest = async () => {
    if (!isUrlValid) {
      setTestResult({ ok: false, msg: "Enter a valid URL first" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const r = await probe(normalized);
    setTesting(false);
    setTestResult(
      r.ok
        ? { ok: true, msg: `Reached bridge ${r.payload.bridge ?? ""}`.trim() }
        : { ok: false, msg: `Failed: ${r.reason}` },
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: installation?.id ?? newId(),
      name: name.trim(),
      url: normalized,
    });
  };

  const handleDelete = () => {
    if (!installation || !onDelete) return;
    Alert.alert(
      "Delete installation?",
      `"${installation.name}" will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(installation.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {installation ? "Edit installation" : "Add installation"}
        </Text>
        <Pressable onPress={handleSave} disabled={!canSave} hitSlop={10}>
          <Text style={[styles.headerBtn, styles.headerBtnPrimary, !canSave && styles.headerBtnDisabled]}>
            Save
          </Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Home, Office, Lake house…"
            placeholderTextColor={theme.textDim}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>URL</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={[styles.input, styles.urlInput]}
              value={url}
              onChangeText={setUrl}
              placeholder="http://192.168.1.42:8080"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              spellCheck={false}
            />
            <Pressable
              style={({ pressed }) => [styles.scanBtn, pressed && styles.btnPressed]}
              onPress={() => setScanning(true)}
              accessibilityLabel="Scan QR code"
            >
              <QrIcon />
            </Pressable>
          </View>
          {url.length > 0 && url !== normalized && (
            <Text style={styles.hint}>Will be saved as: {normalized}</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.testBtn, pressed && styles.btnPressed]}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Text style={styles.testBtnText}>Test connection</Text>
            )}
          </Pressable>

          {testResult && (
            <View
              style={[
                styles.testResult,
                { borderColor: testResult.ok ? theme.success : theme.danger },
              ]}
            >
              <Text
                style={[
                  styles.testResultText,
                  { color: testResult.ok ? theme.success : theme.danger },
                ]}
              >
                {testResult.msg}
              </Text>
            </View>
          )}

          {installation && onDelete && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteBtnText}>Delete installation</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={scanning}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScanning(false)}
      >
        <QrScanScreen onCancel={() => setScanning(false)} onResult={handleScanned} />
      </Modal>
    </SafeAreaView>
  );
};

/** Minimal QR icon drawn with three corner brackets + a centre dot. */
const QrIcon = () => (
  <View style={qrIconStyles.box}>
    <View style={[qrIconStyles.corner, qrIconStyles.cornerTL]} />
    <View style={[qrIconStyles.corner, qrIconStyles.cornerTR]} />
    <View style={[qrIconStyles.corner, qrIconStyles.cornerBL]} />
    <View style={qrIconStyles.dot} />
  </View>
);

const qrIconStyles = StyleSheet.create({
  box: { width: 22, height: 22, position: "relative" },
  corner: { position: "absolute", width: 7, height: 7, borderColor: theme.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  dot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 7,
    height: 7,
    backgroundColor: theme.accent,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
  },
  headerBtn: {
    color: theme.textDim,
    fontSize: 15,
  },
  headerBtnPrimary: {
    color: theme.accent,
    fontWeight: "600",
  },
  headerBtnDisabled: {
    opacity: 0.4,
  },
  scroll: {
    padding: 20,
    gap: 4,
  },
  label: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  urlInput: {
    flex: 1,
  },
  scanBtn: {
    width: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 6,
  },
  testBtn: {
    marginTop: 22,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.surface,
    alignItems: "center",
  },
  testBtnText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  testResult: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: theme.surface,
  },
  testResultText: {
    fontSize: 13,
  },
  deleteBtn: {
    marginTop: 36,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteBtnText: {
    color: theme.danger,
    fontSize: 15,
    fontWeight: "500",
  },
  btnPressed: {
    opacity: 0.7,
  },
});
