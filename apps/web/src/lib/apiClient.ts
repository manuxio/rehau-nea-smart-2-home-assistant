// Thin typed fetch wrapper. Will be replaced by the OpenAPI-generated
// @rehau/api-client once the bridge emits /openapi.json — keep the surface
// minimal so the swap is a single import change.

import type {
  AlarmMessage,
  CalibrationState,
  DailyProgram,
  EnergyLevel,
  HeatCurveState,
  InstallerSettingsGroup,
  InstallerSettingsPatch,
  InstallerSettingsSnapshot,
  IOSnapshot,
  LoginResponse,
  Room,
  RoomCalibration,
  RoomMode,
  SystemMode,
  SystemState,
  Topology,
  UptimeState,
  WeeklyProgram,
} from "@rehau/types";

export interface ApiError {
  status: number;
  error: string;
  message?: string;
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: TokenGetter,
    /** Fired when any request comes back 401 — wire to the auth provider's
     * logout() so an expired token doesn't strand the user on a broken UI. */
    private readonly onUnauthorized?: UnauthorizedHandler,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    // Resolve `path` against the document's <base href>. When the SPA is
    // served behind HA ingress the baseURI carries the ingress token prefix,
    // so a leading "/api/v1/…" wired here gets re-rooted onto that prefix.
    // In dev (Vite proxy) and direct port-8080 mode the baseURI is "/", so
    // the URL stays unchanged.
    const url =
      typeof document !== "undefined"
        ? new URL(`.${path}`, document.baseURI).toString()
        : `${this.baseUrl}${path}`;
    const res = await fetch(url, init);
    if (!res.ok) {
      let payload: ApiError = { status: res.status, error: res.statusText };
      try {
        const data = (await res.json()) as Partial<ApiError>;
        payload = { ...payload, ...data };
      } catch { /* ignore */ }
      // 401 on a non-auth call means the token's expired or invalid — drop
      // the session so the login screen comes back instead of cascading
      // failures. Login/ingress endpoints can legitimately 401 without
      // implying the existing session is dead.
      if (
        res.status === 401 &&
        !path.startsWith("/api/v1/auth/login") &&
        !path.startsWith("/api/v1/auth/ingress")
      ) {
        this.onUnauthorized?.();
      }
      throw payload;
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  auth = {
    login: (username: string, password: string): Promise<LoginResponse> =>
      this.request("POST", "/api/v1/auth/login", { username, password }),
    /** Server-side passwordless login that succeeds only if the request
     *  reached the bridge through HA's ingress reverse proxy (the proxy
     *  injects an `X-Ingress-Path` header). Returns the same shape as
     *  `login()`. Reject with 401 outside ingress. */
    ingress: (): Promise<LoginResponse> =>
      this.request("POST", "/api/v1/auth/ingress"),
    me: (): Promise<{ username: string; role: "user" | "installer" }> =>
      this.request("GET", "/api/v1/auth/me"),
  };

  rooms = {
    list: (): Promise<Room[]> => this.request("GET", "/api/v1/rooms"),
    get: (id: string): Promise<Room> => this.request("GET", `/api/v1/rooms/${encodeURIComponent(id)}`),
    setSetpoint: (id: string, value: number): Promise<Room> =>
      this.request("PUT", `/api/v1/rooms/${encodeURIComponent(id)}/setpoint`, { value }),
    setMode: (id: string, mode: RoomMode, setpoint?: number): Promise<Room> =>
      this.request("PUT", `/api/v1/rooms/${encodeURIComponent(id)}/mode`, { mode, setpoint }),
    setLight: (id: string, light: boolean): Promise<Room> =>
      this.request("PUT", `/api/v1/rooms/${encodeURIComponent(id)}/light`, { light }),
    setFlags: (
      id: string,
      patch: { lock?: boolean; autoStart?: boolean; windowDetection?: boolean },
    ): Promise<Room> =>
      this.request("PUT", `/api/v1/rooms/${encodeURIComponent(id)}/flags`, patch),
  };

  system = {
    get: (): Promise<SystemState> => this.request("GET", "/api/v1/system"),
    setOperatingMode: (mode: SystemMode): Promise<SystemState> =>
      this.request("PUT", "/api/v1/system/operating_mode", { mode }),
    setEnergyLevel: (level: EnergyLevel): Promise<SystemState> =>
      this.request("PUT", "/api/v1/system/energy_level", { level }),
  };

  messages = {
    list: (activeOnly = false): Promise<AlarmMessage[]> =>
      this.request("GET", `/api/v1/messages${activeOnly ? "?activeOnly=true" : ""}`),
  };

  programs = {
    listDaily: (): Promise<DailyProgram[]> => this.request("GET", "/api/v1/programs/daily"),
    getDaily: (n: number, fresh = false): Promise<DailyProgram> =>
      this.request("GET", `/api/v1/programs/daily/${n}${fresh ? "?fresh=true" : ""}`),
    setDaily: (n: number, bits: number[]): Promise<DailyProgram> =>
      this.request("PUT", `/api/v1/programs/daily/${n}`, { bits }),
    listWeekly: (): Promise<WeeklyProgram[]> => this.request("GET", "/api/v1/programs/weekly"),
    getWeekly: (n: number, fresh = false): Promise<WeeklyProgram> =>
      this.request("GET", `/api/v1/programs/weekly/${n}${fresh ? "?fresh=true" : ""}`),
    setWeekly: (
      n: number,
      days: {
        monday: number; tuesday: number; wednesday: number;
        thursday: number; friday: number; saturday: number; sunday: number;
      },
    ): Promise<WeeklyProgram> =>
      this.request("PUT", `/api/v1/programs/weekly/${n}`, days),
  };

  installer = {
    getCalibration: (): Promise<CalibrationState> =>
      this.request("GET", "/api/v1/installer/calibration"),
    setCalibration: (input: { outdoor?: number; rooms?: RoomCalibration[] }): Promise<CalibrationState> =>
      this.request("PUT", "/api/v1/installer/calibration", input),
    getIO: (): Promise<IOSnapshot> => this.request("GET", "/api/v1/installer/io"),
    getUptime: (): Promise<UptimeState> => this.request("GET", "/api/v1/installer/diagnostics/uptime"),
    getTopology: (): Promise<Topology> => this.request("GET", "/api/v1/installer/diagnostics/topology"),
    getHeatCurve: (): Promise<HeatCurveState> => this.request("GET", "/api/v1/installer/curve"),
    getSettings: (group: InstallerSettingsGroup): Promise<InstallerSettingsSnapshot> =>
      this.request("GET", `/api/v1/installer/settings/${encodeURIComponent(group)}`),
    setSettings: (
      group: InstallerSettingsGroup,
      patch: InstallerSettingsPatch,
    ): Promise<InstallerSettingsSnapshot> =>
      this.request("PUT", `/api/v1/installer/settings/${encodeURIComponent(group)}`, patch),
  };
}
