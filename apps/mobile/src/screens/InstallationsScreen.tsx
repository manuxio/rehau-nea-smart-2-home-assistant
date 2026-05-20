import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import type { Installation } from "../types";

interface Props {
  installations: Installation[];
  activeId: string | null;
  /** Null when no installations exist yet — Cancel becomes hidden. */
  onCancel: (() => void) | null;
  onSelect: (id: string) => void;
  onEdit: (i: Installation) => void;
  onAdd: () => void;
}

export const InstallationsScreen = ({
  installations,
  activeId,
  onCancel,
  onSelect,
  onEdit,
  onAdd,
}: Props) => {
  const empty = installations.length === 0;
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        {onCancel ? (
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.headerBtn}>Done</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.headerTitle}>Installations</Text>
        <Pressable onPress={onAdd} hitSlop={10}>
          <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Add</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {empty && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No installations yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first REHAU bridge to get started.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.bigAddBtn, pressed && styles.btnPressed]}
              onPress={onAdd}
            >
              <Text style={styles.bigAddBtnText}>Add installation</Text>
            </Pressable>
          </View>
        )}

        {installations.map((i) => {
          const isActive = i.id === activeId;
          return (
            <View key={i.id} style={[styles.row, isActive && styles.rowActive]}>
              <Pressable
                style={styles.rowMain}
                onPress={() => onSelect(i.id)}
                hitSlop={4}
              >
                <View style={[styles.dot, isActive && styles.dotActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{i.name}</Text>
                  <Text style={styles.rowUrl} numberOfLines={1}>
                    {i.url}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.editBtn, pressed && styles.btnPressed]}
                onPress={() => onEdit(i)}
                hitSlop={10}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

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
  headerSpacer: { width: 50 },
  scroll: { padding: 16, gap: 10 },
  emptyBox: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtitle: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  bigAddBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: theme.accent,
  },
  bigAddBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 12,
  },
  rowActive: {
    borderColor: theme.accent,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border,
  },
  dotActive: {
    backgroundColor: theme.success,
  },
  rowName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowUrl: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: {
    color: theme.accent,
    fontSize: 14,
  },
  btnPressed: { opacity: 0.7 },
});
