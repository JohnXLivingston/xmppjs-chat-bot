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

function wrapLogger (name: string, logger: Logger): Logger {
  return {
    debug: (s) => logger.debug(`[${name}] ` + s),
    info: (s) => logger.info(`[${name}] ` + s),
    warn: (s) => logger.warn(`[${name}] ` + s),
    error: (s) => logger.error(`[${name}] ` + s)
  }
}

export {
  Logger,
  DefaultLogger,
  ConsoleLogger,
  wrapLogger
}
