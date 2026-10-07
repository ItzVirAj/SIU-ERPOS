export const motionTokens = {
  ease: {
    enter: [0.16, 1, 0.3, 1] as const,
    standard: [0.2, 0, 0, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  duration: {
    instant: 0.1,
    fast: 0.18,
    standard: 0.28,
    slow: 0.45,
  },
  spring: {
    smooth: { type: "spring" as const, damping: 32, stiffness: 380 },
    snappy: { type: "spring" as const, damping: 26, stiffness: 440 },
  },
  blur: {
    subtle: 4,
    medium: 8,
  },
} as const;
