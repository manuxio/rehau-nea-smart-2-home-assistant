export type Installation = {
  id: string;
  name: string;
  url: string;
};

export type Persisted = {
  version: 1;
  installations: Installation[];
  activeId: string | null;
};

export type HealthOk = {
  ok: true;
  bridge?: string;
  source?: string;
  device?: unknown;
  installerAccess?: boolean;
};
