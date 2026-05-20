// UI primitives — ported from the Claude Design hand-off (Betterehau-handoff/
// betterehau/project/ui.tsx). All colour values flow through the CSS vars
// in index.css so a future light theme is a single override.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// ─── Severity / mode → CSS-var colour ─────────────────────────────────
export const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--muted)",
  warning: "var(--heat)",
  error: "var(--alert)",
  critical: "var(--alert)",
};

export const MODE_COLOR: Record<string, string> = {
  standby: "var(--dim)",
  normal: "var(--on)",
  reduced: "var(--cool)",
  program: "var(--accent)",
  program_override: "var(--heat)",
};

// ─── Glyphs ───────────────────────────────────────────────────────────
export const Glyph = ({
  name,
  size = 18,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}) => {
  const s = size;
  const c = color;
  switch (name) {
    case "flame":         return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-1.5-3-1.5-5 1.5 0.5 3 2.5 3 5a5.5 5.5 0 1 1-11 0c0-5 5.5-5 5.5-9z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
    case "snow":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>;
    case "drop":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
    case "moon":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
    case "sun":           return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>;
    case "clock":         return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></svg>;
    case "calendar":      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round"/></svg>;
    case "home":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z" strokeLinejoin="round"/></svg>;
    case "sliders":       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h10M4 12h6M4 17h14"/><circle cx="17" cy="7" r="2"/><circle cx="13" cy="12" r="2"/><circle cx="19" cy="17" r="2"/></svg>;
    case "bell":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2H4.5L6 17z" strokeLinejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round"/></svg>;
    case "wrench":        return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M14 4a4 4 0 0 1 5 5l-1 2 3 3-3 3-3-3-2 1a4 4 0 0 1-5-5l1-2-3-3 3-3 3 3 2-1z" strokeLinejoin="round"/></svg>;
    case "alert":         return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M12 4l9 16H3L12 4z" strokeLinejoin="round"/><path d="M12 10v5M12 17.5v.5" strokeLinecap="round"/></svg>;
    case "chevron-right": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>;
    case "chevron-left":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>;
    case "plus":          return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
    case "minus":         return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/></svg>;
    case "fan":           return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4-2-7-5-7 0 3 1 5 5 7zM12 14c0 4 2 7 5 7 0-3-1-5-5-7zM10 12c-4 0-7 2-7 5 3 0 5-1 7-5zM14 12c4 0 7-2 7-5-3 0-5 1-7 5z" strokeLinejoin="round"/></svg>;
    case "wifi-off":      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l18 18M9 17a3 3 0 0 1 4 0M6 14a7 7 0 0 1 6-2M3 11a12 12 0 0 1 6-3"/></svg>;
    case "check":         return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"/></svg>;
    case "x":             return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>;
    case "refresh":       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/></svg>;
    case "logout":        return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H10"/></svg>;
    case "eye":           return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "eye-off":       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a16.4 16.4 0 0 1-3.4 4.3M6.6 6.7A16.4 16.4 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
    default: return null;
  }
};

// ─── Card with optional staleness chip ────────────────────────────────
interface CardProps {
  children: ReactNode;
  staleSeconds?: number;
  padding?: number | string;
  style?: CSSProperties;
  onClick?: () => void;
  tone?: "default" | "raised";
}
export const Card = ({
  children,
  staleSeconds,
  padding = 16,
  style,
  onClick,
  tone = "default",
}: CardProps) => (
  <div
    onClick={onClick}
    style={{
      position: "relative",
      background: tone === "raised" ? "var(--surface2)" : "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 18,
      padding,
      cursor: onClick ? "pointer" : "default",
      transition: "transform .12s ease, border-color .12s ease",
      ...style,
    }}
  >
    {children}
    {staleSeconds !== undefined && (
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--dim)",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        · {staleSeconds}s
      </div>
    )}
  </div>
);

// ─── Mode pill ────────────────────────────────────────────────────────
export const ModePill = ({ mode }: { mode: string }) => {
  const color = MODE_COLOR[mode] ?? "var(--text)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        fontFamily: "var(--mono)",
        fontSize: "0.625rem",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        color,
        border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: color }} />
      {mode.replace("_", "·")}
    </span>
  );
};

// ─── Segmented control ────────────────────────────────────────────────
export const Segmented = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
}) => (
  <div
    style={{
      display: "flex",
      padding: 3,
      background: "var(--surface2)",
      borderRadius: 12,
      border: "1px solid var(--border)",
      gap: 2,
    }}
  >
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            flex: 1,
            border: "none",
            cursor: "pointer",
            padding: "8px 6px",
            borderRadius: 9,
            background: active ? "var(--accent)" : "transparent",
            color: active ? "#1a1024" : "var(--muted)",
            fontFamily: "var(--body)",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: 0.2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "background .15s, color .15s",
          }}
        >
          {o.icon && <Glyph name={o.icon} size={14} />}
          {o.label}
        </button>
      );
    })}
  </div>
);

// ─── Toggle ───────────────────────────────────────────────────────────
export const Toggle = ({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!value)}
    style={{
      width: 46,
      height: 28,
      borderRadius: 999,
      padding: 3,
      border: "none",
      background: value ? "var(--on)" : "var(--surface2)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "background .15s",
      display: "inline-flex",
      alignItems: "center",
      flexShrink: 0,
      // Make the whole rounded pill the hit target.
      touchAction: "manipulation",
    }}
  >
    <span
      // Pointer-events:none ensures every click lands on the <button>,
      // not on the moving handle inside it.
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        background: value ? "#16101C" : "var(--muted)",
        transform: value ? "translateX(18px)" : "translateX(0)",
        transition: "transform .18s cubic-bezier(.4,1.4,.6,1)",
        pointerEvents: "none",
        display: "block",
      }}
    />
  </button>
);

// ─── Radial setpoint dial ─────────────────────────────────────────────
export const SetpointDial = ({
  value,
  onChange,
  min = 5,
  max = 31,
  step = 0.5,
  current,
  mode = "heating",
  size = 280,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  current?: number;
  mode?: "heating" | "cooling";
  size?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const sweep = 260;
  const startAngle = -(sweep / 2);
  const norm = (value - min) / (max - min);
  const angle = startAngle + norm * sweep;
  const accent = mode === "heating" ? "var(--heat)" : "var(--cool)";

  const ticks = 60;
  const activeTick = Math.round(norm * (ticks - 1));

  const setFromEvent = (e: PointerEvent | React.PointerEvent): void => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let a = (Math.atan2(dx, dy) * 180) / Math.PI;
    const half = sweep / 2;
    if (a > half) a = half;
    if (a < -half) a = -half;
    const t = (a - startAngle) / sweep;
    const raw = min + t * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, snapped)));
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent): void => setFromEvent(e);
    const up = (): void => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        position: "relative",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        setDragging(true);
        setFromEvent(e);
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        {Array.from({ length: ticks }).map((_, i) => {
          const t = i / (ticks - 1);
          const a = ((startAngle + t * sweep) * Math.PI) / 180;
          const cx = size / 2;
          const cy = size / 2;
          const rOuter = size / 2 - 12;
          const rInner = rOuter - (i === activeTick ? 24 : 18);
          const sin = Math.sin(a);
          const cos = Math.cos(a);
          const x1 = cx + sin * rOuter;
          const y1 = cy + cos * rOuter;
          const x2 = cx + sin * rInner;
          const y2 = cy + cos * rInner;
          const isActive = i <= activeTick;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActive ? accent : "var(--border)"}
              strokeWidth={i === activeTick ? 3 : 1.5}
              strokeLinecap="round"
              opacity={isActive ? 1 : 0.6}
            />
          );
        })}
        {(() => {
          const a = (angle * Math.PI) / 180;
          const cx = size / 2;
          const cy = size / 2;
          const r = size / 2 - 22;
          return (
            <circle cx={cx + Math.sin(a) * r} cy={cy + Math.cos(a) * r} r={6} fill={accent} />
          );
        })()}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "4.5rem",
            fontWeight: 500,
            color: "var(--text)",
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          {value.toFixed(1)}
          <span style={{ fontSize: "1.75rem", marginLeft: 4, color: "var(--muted)" }}>°C</span>
        </div>
        {current !== undefined && (
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--mono)",
              fontSize: "0.75rem",
              color: "var(--muted)",
              letterSpacing: 0.5,
            }}
          >
            ATTUALE {current.toFixed(1)}°
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Stepper ──────────────────────────────────────────────────────────
export const Stepper = ({
  value,
  onChange,
  min = 5,
  max = 31,
  step = 0.5,
  suffix = "°",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(Math.max(min, Math.round((value - step) * 10) / 10));
      }}
      style={btnStyle("ghost", "sm")}
    >
      <Glyph name="minus" size={14} />
    </button>
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: "0.875rem",
        color: "var(--text)",
        width: 48,
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {step >= 1 ? value.toFixed(0) : value.toFixed(1)}
      {suffix}
    </span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(Math.min(max, Math.round((value + step) * 10) / 10));
      }}
      style={btnStyle("ghost", "sm")}
    >
      <Glyph name="plus" size={14} />
    </button>
  </div>
);

// ─── Button factory ───────────────────────────────────────────────────
export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";
export const btnStyle = (v: BtnVariant, s: BtnSize = "md"): CSSProperties => {
  const sizes: Record<BtnSize, CSSProperties> = {
    sm: { padding: "5px 9px", fontSize: "0.75rem", borderRadius: 9, minHeight: 28, minWidth: 28 },
    md: { padding: "10px 16px", fontSize: "0.875rem", borderRadius: 12, minHeight: 40 },
    lg: { padding: "14px 20px", fontSize: "0.9375rem", borderRadius: 14, minHeight: 48 },
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: "var(--accent)", color: "#1a1024", border: "1px solid transparent" },
    secondary: { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" },
    danger: {
      background: "color-mix(in oklab, var(--alert) 18%, transparent)",
      color: "var(--alert)",
      border: "1px solid color-mix(in oklab, var(--alert) 35%, transparent)",
    },
  };
  return {
    ...sizes[s],
    ...variants[v],
    fontFamily: "var(--body)",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "transform .08s, background .15s",
  };
};

// ─── Tab bar ──────────────────────────────────────────────────────────
export const TabBar = ({
  active,
  onChange,
  items,
}: {
  active: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon: string }[];
}) => (
  <div
    style={{
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      // Without viewport-fit=cover, the layout viewport already ends ABOVE
      // the home indicator on iOS PWA, so bottom: 0 sits at the right
      // place and no env() math is needed.
      padding: "6px 6px 6px",
      background: "color-mix(in oklab, var(--bg) 80%, transparent)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid var(--border)",
      gap: 2,
      maxWidth: 420,
      margin: "0 auto",
      zIndex: 30,
    }}
  >
    {items.map((i) => {
      const isActive = i.value === active;
      return (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "8px 4px",
            borderRadius: 10,
            color: isActive ? "var(--text)" : "var(--dim)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            fontFamily: "var(--body)",
            fontSize: "0.625rem",
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          <div
            style={{
              padding: "4px 14px",
              borderRadius: 999,
              background: isActive ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--dim)",
            }}
          >
            <Glyph name={i.icon} size={20} />
          </div>
          {i.label}
        </button>
      );
    })}
  </div>
);

// ─── Section header ───────────────────────────────────────────────────
export const SectionHead = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      margin: "20px 16px 10px",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontFamily: "var(--display)",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: 1.6,
      }}
    >
      {title}
    </h2>
    {action}
  </div>
);

// ─── Banner ───────────────────────────────────────────────────────────
export const Banner = ({
  tone,
  children,
}: {
  tone: "alert" | "info";
  children: ReactNode;
}) => (
  <div
    style={{
      margin: "10px 16px 0",
      padding: "10px 12px",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      gap: 10,
      background:
        tone === "alert"
          ? "color-mix(in oklab, var(--alert) 14%, transparent)"
          : "color-mix(in oklab, var(--accent) 14%, transparent)",
      color: tone === "alert" ? "var(--alert)" : "var(--accent)",
      border:
        "1px solid " +
        (tone === "alert"
          ? "color-mix(in oklab, var(--alert) 32%, transparent)"
          : "color-mix(in oklab, var(--accent) 32%, transparent)"),
      fontSize: "0.8125rem",
      fontFamily: "var(--body)",
    }}
  >
    <Glyph name={tone === "alert" ? "wifi-off" : "bell"} size={16} />
    <span>{children}</span>
  </div>
);

// ─── Today-program mini timeline ──────────────────────────────────────
export const ProgramStrip = ({ bits, hour }: { bits: number[]; hour?: number }) => {
  const nowQ = hour !== undefined ? Math.floor(hour * 4) : -1;
  return (
    <div
      style={{
        display: "flex",
        gap: 1,
        height: 8,
        alignItems: "stretch",
        background: "var(--bg)",
        padding: 2,
        borderRadius: 4,
      }}
    >
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            background: b
              ? i === nowQ
                ? "var(--accent)"
                : "var(--on)"
              : i === nowQ
                ? "color-mix(in oklab, var(--accent) 40%, transparent)"
                : "var(--border)",
            opacity: b ? 0.9 : 0.5,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
};

// ─── App header ───────────────────────────────────────────────────────
/**
 * Page header that pins itself to the top of the scroll container. Pages
 * also feed in their primary "info row" (segmented control, filter toggle…)
 * via `children` so those controls stay visible while the user scrolls
 * the body of the section. The `--bg` background paints over the page
 * content behind the sticky region.
 */
export const AppHeader = ({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    style={{
      position: "sticky",
      // No viewport-fit=cover on the page → the layout viewport already
      // starts BELOW the status bar / notch on iOS PWA, so sticking at
      // top: 0 lands the header right under the system chrome with no
      // extra padding math. See index.html for the viewport rationale.
      top: 0,
      zIndex: 30,
      background: "var(--bg)",
      // A 1-px border + a soft shadow gives the sticky region a clear edge
      // when content scrolls underneath, without looking like a card.
      borderBottom: "1px solid color-mix(in oklab, var(--border) 60%, transparent)",
      boxShadow: "0 6px 12px -10px rgba(0,0,0,.6)",
    }}
  >
    <div
      style={{
        padding: "20px 16px 8px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--display)",
            fontWeight: 600,
            fontSize: "1.875rem",
            letterSpacing: -0.6,
            lineHeight: 1.05,
            color: "var(--text)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.6875rem",
              color: "var(--muted)",
              marginTop: 4,
              letterSpacing: 0.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
    {children && <div style={{ padding: "0 16px 12px" }}>{children}</div>}
  </div>
);

// ─── Key/value rows for spec sheets ───────────────────────────────────
export const KV = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: "0.625rem",
        color: "var(--muted)",
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: "0.8125rem",
        color: "var(--text)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  </div>
);

export const Sep = () => (
  <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
);

// ─── Plain input field ────────────────────────────────────────────────
export const Field = ({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) => {
  // Mobile keyboards auto-capitalize and auto-correct text inputs by default,
  // which is wrong for usernames, codes, passwords. Disable across the board:
  // none of our fields are prose. `inputmode` keeps the right keyboard layout
  // (numeric / email / etc.) when callers pass an explicit autoComplete hint.
  const isPasswordy = type === "password" || autoComplete?.includes("password");
  const [reveal, setReveal] = useState(false);
  const effectiveType = type === "password" && reveal ? "text" : type;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--muted)",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          value={value}
          type={effectiveType}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore={isPasswordy ? undefined : "true"}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            // iOS WKWebView and Android WebView don't always scroll the focused
            // input above the soft keyboard. Forcing it on focus closes that
            // gap. The delay lets the keyboard finish animating in before we
            // measure the resulting visual viewport.
            const el = e.currentTarget;
            window.setTimeout(() => {
              try {
                el.scrollIntoView({ block: "center", behavior: "smooth" });
              } catch {
                /* ignore */
              }
            }, 300);
          }}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            // Extra right padding when the eye button overlays the input,
            // so the typed text doesn't sit under the icon.
            padding: type === "password" ? "12px 44px 12px 14px" : "12px 14px",
            color: "var(--text)",
            fontFamily: "var(--body)",
            fontSize: "0.9375rem",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        {type === "password" && (
          <button
            type="button"
            aria-label={reveal ? "Nascondi password" : "Mostra password"}
            aria-pressed={reveal ? "true" : "false"}
            onClick={() => setReveal((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: reveal ? "var(--accent)" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              borderRadius: 8,
            }}
          >
            <Glyph name={reveal ? "eye-off" : "eye"} size={18} />
          </button>
        )}
      </div>
    </label>
  );
};

// ─── A simple row with an icon + label + trailing value ───────────────
export const ControlRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <Card padding={12}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--surface2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
        }}
      >
        <Glyph name={icon} size={16} />
      </div>
      <span style={{ flex: 1, color: "var(--text)", fontFamily: "var(--body)", fontSize: "0.875rem" }}>
        {label}
      </span>
      <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "0.75rem" }}>{value}</span>
    </div>
  </Card>
);
