declare module 'poplib' {
  interface POP3Options {
    tlserrs?: boolean;
    enabletls?: boolean;
    debug?: boolean;
  }

  class POP3Client {
    constructor(port: number, host: string, options?: POP3Options);
    on(event: string, callback: (...args: any[]) => void): void;
    login(username: string, password: string): void;
    stat(): void;
    retr(messageNumber: number): void;
    quit(): void;
  }

  export = POP3Client;
}
