interface Logger {
  debug: (s: string) => void
  info: (s: string) => void
  warn: (s: string) => void
  error: (s: string) => void
}

class DefaultLogger implements Logger {
  public debug (): void {}
  public info (): void {}
  public warn (): void {}
  public error (): void {}
}

class ConsoleLogger implements Logger {
  protected readonly prefix: string
  constructor (prefix?: string) {
    this.prefix = prefix ?? ''
  }

  public debug (s: string): void {
    console.log('' + s)
  }

  public info (s: string): void {
    console.info('' + s)
  }

  public warn (s: string): void {
    console.warn('' + s)
  }

  public error (s: string): void {
    console.error('' + s)
  }
}

export {
  Logger,
  DefaultLogger,
  ConsoleLogger
}
