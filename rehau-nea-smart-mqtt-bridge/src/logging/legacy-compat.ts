// Legacy compatibility functions for existing code

export function registerObfuscation(_type: 'installation' | 'group' | 'zone' | 'email', _name: string): void {
  // No-op for now, enhanced logger handles this internally
}

export function obfuscate(text: string): string {
  // No-op for now, enhanced logger handles this internally
  return text;
}

export function clearObfuscation(): void {
  // No-op for now
}

export function debugDump(_label: string, _data: unknown, _condensed: boolean = false): void {
  // No-op for now, can be implemented later if needed
}

export function redactSensitiveData(obj: unknown): unknown {
  // No-op for now, enhanced logger handles this internally
  return obj;
}
