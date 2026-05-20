import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConnectingScreen } from "./src/screens/ConnectingScreen";
import { ErrorScreen } from "./src/screens/ErrorScreen";
import { InstallationEditScreen } from "./src/screens/InstallationEditScreen";
import { InstallationsScreen } from "./src/screens/InstallationsScreen";
import { WebAppScreen } from "./src/screens/WebAppScreen";
import { probe } from "./src/health";
import {
  activeInstallation,
  deleteInstallation,
  loadState,
  saveState,
  setActive,
  upsertInstallation,
} from "./src/storage";
import { theme } from "./src/theme";
import type { Installation, Persisted } from "./src/types";

type Phase =
  | { kind: "loading" }
  | { kind: "no-installations" }
  | { kind: "connecting"; installation: Installation }
  | { kind: "connected"; installation: Installation }
  | { kind: "error"; installation: Installation; message: string };

type Overlay =
  | { kind: "none" }
  | { kind: "list" }
  | { kind: "edit"; installation: Installation | null };

export default function App() {
  const [persisted, setPersisted] = useState<Persisted | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [modal, setModal] = useState<Overlay>({ kind: "none" });
  const [reloadNonce, setReloadNonce] = useState(0);

  // Avoid duplicate probes when AppState fires "active" multiple times
  const probingRef = useRef<string | null>(null);

  const writeState = useCallback(async (next: Persisted) => {
    setPersisted(next);
    await saveState(next);
  }, []);

  // Cold start
  useEffect(() => {
    void (async () => {
      const s = await loadState();
      setPersisted(s);
      const a = activeInstallation(s);
      if (!a) {
        setPhase({ kind: "no-installations" });
        return;
      }
      runProbe(a);
    })();
  }, []);

  const runProbe = useCallback((installation: Installation) => {
    if (probingRef.current === installation.id) return;
    probingRef.current = installation.id;
    setPhase({ kind: "connecting", installation });
    void (async () => {
      const r = await probe(installation.url);
      probingRef.current = null;
      if (r.ok) setPhase({ kind: "connected", installation });
      else setPhase({ kind: "error", installation, message: r.reason });
    })();
  }, []);

  // Re-probe on app foreground if currently in error state (so a network
  // recovery is detected without needing manual Retry).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (phase.kind === "error") runProbe(phase.installation);
    });
    return () => sub.remove();
  }, [phase, runProbe]);

  const openManager = () => setModal({ kind: "list" });
  const closeModal = () => setModal({ kind: "none" });

  const handleSelect = (id: string) => {
    if (!persisted) return;
    const next = setActive(persisted, id);
    void writeState(next);
    const a = activeInstallation(next);
    if (a) {
      setModal({ kind: "none" });
      runProbe(a);
    }
  };

  const handleAdd = () => setModal({ kind: "edit", installation: null });
  const handleEdit = (i: Installation) => setModal({ kind: "edit", installation: i });

  const handleSave = (i: Installation) => {
    if (!persisted) return;
    const wasFirst = persisted.installations.length === 0;
    const next = upsertInstallation(persisted, i);
    void writeState(next);
    if (wasFirst) {
      // First install added: close modals and probe immediately.
      setModal({ kind: "none" });
      runProbe(i);
    } else {
      setModal({ kind: "list" });
      // If we edited the currently-active one, re-probe.
      if (next.activeId === i.id && phase.kind !== "connected") {
        runProbe(i);
      } else if (
        next.activeId === i.id &&
        phase.kind === "connected" &&
        phase.installation.url !== i.url
      ) {
        // URL changed for the active installation — force reload
        setReloadNonce((n) => n + 1);
        runProbe(i);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (!persisted) return;
    const next = deleteInstallation(persisted, id);
    void writeState(next);
    const a = activeInstallation(next);
    if (!a) {
      setModal({ kind: "none" });
      setPhase({ kind: "no-installations" });
    } else {
      setModal({ kind: "list" });
      if (phase.kind !== "connected" || phase.installation.id === id) {
        runProbe(a);
      }
    }
  };

  const onRetry = () => {
    if (phase.kind === "error") runProbe(phase.installation);
  };

  const onWebLoadError = (msg: string) => {
    if (phase.kind === "connected") {
      setPhase({ kind: "error", installation: phase.installation, message: msg });
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.root}>
        {phase.kind === "loading" && <View style={styles.placeholder} />}

        {phase.kind === "no-installations" && (
          <InstallationsScreen
            installations={[]}
            activeId={null}
            onCancel={null}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onAdd={handleAdd}
          />
        )}

        {phase.kind === "connecting" && (
          <ConnectingScreen installation={phase.installation} />
        )}

        {phase.kind === "error" && (
          <ErrorScreen
            installation={phase.installation}
            message={phase.message}
            onRetry={onRetry}
            onManage={openManager}
          />
        )}

        {phase.kind === "connected" && (
          <WebAppScreen
            installation={phase.installation}
            reloadNonce={reloadNonce}
            onOpenManager={openManager}
            onLoadError={onWebLoadError}
          />
        )}

        <Modal
          visible={modal.kind === "list" && persisted !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          {persisted && modal.kind === "list" && (
            <InstallationsScreen
              installations={persisted.installations}
              activeId={persisted.activeId}
              onCancel={closeModal}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onAdd={handleAdd}
            />
          )}
        </Modal>

        <Modal
          visible={modal.kind === "edit"}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() =>
            setModal(persisted && persisted.installations.length > 0 ? { kind: "list" } : { kind: "none" })
          }
        >
          {modal.kind === "edit" && (
            <InstallationEditScreen
              installation={modal.installation}
              onCancel={() =>
                setModal(
                  persisted && persisted.installations.length > 0
                    ? { kind: "list" }
                    : { kind: "none" },
                )
              }
              onSave={handleSave}
              onDelete={modal.installation ? handleDelete : undefined}
            />
          )}
        </Modal>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  placeholder: { flex: 1, backgroundColor: theme.bg },
});
