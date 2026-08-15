import { motion } from "framer-motion";

/**
 * The signature combination dial. A brass ring whose active arc encodes a value
 * (unlock progress, password strength, or vault health). Used at multiple sizes.
 */
export function Dial({
  value,
  size = 180,
  thickness = 10,
  color = "var(--brass-500)",
  trackColor = "var(--ink-600)",
  spinning = false,
  glow = false,
  children,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  spinning?: boolean;
  glow?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = c * (1 - clamped);
  const id = `dial-grad-${Math.round(color.length * 7 + size)}`;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={glow ? { filter: `drop-shadow(0 0 16px ${color}55)` } : undefined}
        animate={spinning ? { rotate: [-90, 210] } : { rotate: -90 }}
        transition={
          spinning
            ? { duration: 0.6, ease: [0.2, 0, 0, 1] }
            : { duration: 0 }
        }
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--ok)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        />
      </motion.svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
