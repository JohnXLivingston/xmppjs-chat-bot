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

class ColorConsoleLogger extends ConsoleLogger {
  public debug (s: string): void {
    super.debug('\x1b[90m' + s + '\x1b[0m')
  }

  public info (s: string): void {
    super.info('\x1b[32m' + s + '\x1b[0m')
  }

  public warn (s: string): void {
    super.warn('\x1b[33m' + s + '\x1b[0m')
  }

  public error (s: string): void {
    super.error('\x1b[31m' + s + '\x1b[0m')
  }
}

function _addPrefix (s: string, name: string): string {
  if (!s.startsWith('[')) {
    return `[${name}] ` + s
  }
  return `[${name}]` + s
}

function wrapLogger (name: string, logger: Logger): Logger {
  return {
    debug: (s) => logger.debug(_addPrefix(s, name)),
    info: (s) => logger.info(_addPrefix(s, name)),
    warn: (s) => logger.warn(_addPrefix(s, name)),
    error: (s) => logger.error(_addPrefix(s, name))
  }
}

export {
  Logger,
  DefaultLogger,
  ConsoleLogger,
  ColorConsoleLogger,
  wrapLogger
}
