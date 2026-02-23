/**
 * Log Obfuscator - Obfuscate personal information in logs
 */

export class LogObfuscator {
  private zoneMap: Map<string, string> = new Map();
  private installMap: Map<string, string> = new Map();
  private zoneCounter = 0;
  private installCounter = 0;

  /**
   * Obfuscate a log line
   */
  obfuscate(line: string): string {
    let obfuscated = line;

    // Strip ANSI color codes first
    obfuscated = obfuscated.replace(/\x1b\[[0-9;]*m/g, '');

    // Obfuscate email addresses
    obfuscated = obfuscated.replace(
      /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
      (_match, user, domain) => {
        const domainParts = domain.split('.');
        return `${user[0]}***@${domainParts[0][0]}***.${domainParts[domainParts.length - 1]}`;
      }
    );

    // Obfuscate zone names in various formats
    // Pattern 1: Quoted strings like "Salone", "Manu", "Arianna", "Cucina"
    const quotedPattern = /"([^"]+)"/g;
    let matches = obfuscated.matchAll(quotedPattern);
    
    for (const match of matches) {
      const name = match[1];
      // If it looks like a room/person name (not a technical term)
      if (name.length > 2 && name.length < 30 && !name.includes('/') && !name.includes('http') && !name.includes('@')) {
        const obfuscatedName = this.getObfuscatedZone(name);
        obfuscated = obfuscated.replace(`"${name}"`, `"${obfuscatedName}"`);
      }
    }

    // Pattern 2: Zone names after "Zone " (e.g., "Zone Salone data is stale")
    obfuscated = obfuscated.replace(/Zone "([^"]+)"/g, (_match, name) => {
      return `Zone "${this.getObfuscatedZone(name)}"`;
    });

    // Pattern 3: Installation names in parentheses like (cappelleri)
    obfuscated = obfuscated.replace(/\(([a-z]+)\):/g, (_match, name) => {
      if (name.length > 3 && name.length < 20) {
        return `(${this.getObfuscatedInstall(name)}):`;
      }
      return _match;
    });

    // Obfuscate installation IDs (hex strings like 78602d11)
    obfuscated = obfuscated.replace(/\b[0-9a-f]{8}\b/g, (match) => {
      return this.getObfuscatedInstall(match);
    });

    // Obfuscate IP addresses (keep format but change numbers)
    obfuscated = obfuscated.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, '192.168.x.x');

    return obfuscated;
  }

  /**
   * Get obfuscated zone name
   */
  private getObfuscatedZone(name: string): string {
    if (!this.zoneMap.has(name)) {
      const letter = String.fromCharCode(65 + (this.zoneCounter % 26)); // A-Z
      this.zoneMap.set(name, `Zone_${letter}`);
      this.zoneCounter++;
    }
    return this.zoneMap.get(name)!;
  }

  /**
   * Get obfuscated installation name
   */
  private getObfuscatedInstall(id: string): string {
    if (!this.installMap.has(id)) {
      this.installCounter++;
      this.installMap.set(id, `install_${this.installCounter}`);
    }
    return this.installMap.get(id)!;
  }
}

export const logObfuscator = new LogObfuscator();
export default logObfuscator;
