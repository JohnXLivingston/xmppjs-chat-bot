type Level = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug: (s: string) => void
  info: (s: string) => void
  warn: (s: string) => void
  error: (s: string) => void
  setLevel: (level: Level) => void
}

class DefaultLogger implements Logger {
  public debug (): void {}
  public info (): void {}
  public warn (): void {}
  public error (): void {}
  public setLevel (): void {}
}

class ConsoleLogger implements Logger {
  protected readonly prefix: string
  public debug: (s: string) => void
  public info: (s: string) => void
  public warn: (s: string) => void
  public error: (s: string) => void

  constructor (prefix?: string) {
    this.prefix = prefix ?? ''
    // default level: info
    this.debug = this._void
    this.info = this._info
    this.warn = this._warn
    this.error = this._error
  }

  protected _debug (s: string): void {
    console.log('' + s)
  }

  protected _info (s: string): void {
    console.info('' + s)
  }

  protected _warn (s: string): void {
    console.warn('' + s)
  }

  protected _error (s: string): void {
    console.error('' + s)
  }

  public _void (_s: string): void {}

  public setLevel (level: Level): void {
    this.debug = this._void
    this.info = this._void
    this.warn = this._void
    this.error = this._void
    if (level === 'error') {
      this.error = this._error
    } else if (level === 'warn') {
      this.error = this._error
      this.warn = this._warn
    } else if (level === 'info') {
      this.error = this._error
      this.warn = this._warn
      this.info = this._info
    } else if (level === 'debug') {
      this.error = this._error
      this.warn = this._warn
      this.info = this._info
      this.debug = this._debug
    }
  }
}

class ColorConsoleLogger extends ConsoleLogger {
  protected _debug (s: string): void {
    super._debug('\x1b[90m' + s + '\x1b[0m')
  }

  protected _info (s: string): void {
    super._info('\x1b[32m' + s + '\x1b[0m')
  }

  protected _warn (s: string): void {
    super._warn('\x1b[33m' + s + '\x1b[0m')
  }

  protected _error (s: string): void {
    super._error('\x1b[31m' + s + '\x1b[0m')
  }
}

function _addPrefix (s: any, name: string): string {
  if (typeof s !== 'string') {
    if ('toString' in s) {
      s = s.toString()
    } else {
      s = '???'
    }
  }
  if (!s.startsWith('[')) {
    return `[${name}] ${s as string}`
  }
  return `[${name}]${s as string}`
}

function wrapLogger (name: string, logger: Logger): Logger {
  return {
    debug: (s) => logger.debug(_addPrefix(s, name)),
    info: (s) => logger.info(_addPrefix(s, name)),
    warn: (s) => logger.warn(_addPrefix(s, name)),
    error: (s) => logger.error(_addPrefix(s, name)),
    setLevel: (level: Level) => logger.setLevel(level)
  }
}

export {
  Logger,
  DefaultLogger,
  ConsoleLogger,
  ColorConsoleLogger,
  wrapLogger
}
