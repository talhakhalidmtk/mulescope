import { useEffect, useState } from "react";

/**
 * Returns `value`, but updated only after it's stopped changing for `delayMs`.
 * Use for search inputs that drive expensive filtering - the input itself
 * should never feel laggy, only the (possibly heavy) work derived from it.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
