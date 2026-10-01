export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

/** Freezes `value` and everything reachable from it, in place. */
export function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const child of Object.values(value) as unknown[]) {
    if (typeof child === 'object' && child !== null) deepFreeze(child)
  }
  return Object.freeze(value)
}
