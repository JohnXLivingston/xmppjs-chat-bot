import type { Room } from '../room'
import { Handler } from './abstract'
import { HandlersDirectory } from '../handlers_directory'

abstract class HandlerQuotesBase extends Handler {
  protected timeout: NodeJS.Timeout | undefined
  protected quotes: string[]
  protected quoteDelay: number

  constructor (id: string, room: Room, options: any) {
    super(id, room, options)
    this.quotes ??= []
    this.quoteDelay ??= 10 * 1000
  }

  public loadOptions (options: any): void {
    if (typeof options !== 'object') { return }
    if (('quotes' in options) && (Array.isArray(options.quotes))) {
      this.quotes = []
      for (const q of options.quotes) {
        if (typeof q === 'string') {
          this.quotes.push(q)
        }
      }
    }
    if (('delay' in options) && (options.delay === undefined || (typeof options.delay === 'number'))) {
      if (this.quoteDelay !== options.delay) {
        this.quoteDelay = options.delay
        if (this.timeout) {
          this.logger.info('The quote dealy has changed, we must stop and start the handler again')
          // already started, must restart
          this.stop()
          this.start()
        }
      }
    }
  }

  public start (): void {
    if (this.timeout) { this.stop() }
    this.timeout = setInterval(() => {
      this.sendQuote()
    }, this.quoteDelay)
  }

  public stop (): void {
    if (this.timeout) {
      clearInterval(this.timeout)
      this.timeout = undefined
    }
  }

  protected sendQuote (): void {
    const room = this.room
    if (!room.isOnline()) {
      this.logger.debug('[HandlerQuote] The room ' + this.room.jid.toString() + ' is not online, skipping.')
      return
    }
    // checking if there is someone to listen...
    const onlineUserCount = this.room.onlineUserCount()
    this.logger.debug(`[HandlerQuote] Online user count in room: ${onlineUserCount}`)
    if (onlineUserCount < 2) { return }
    const txt = this.getQuoteTxt()
    if (!txt) { return }
    this.room.sendGroupchat(txt).catch((err) => { this.logger.error(err) })
  }

  protected abstract getQuoteTxt (): string | null
}

/**
 * HandlerQuotes: emit quotes by cycling
 */
class HandlerQuotes extends HandlerQuotesBase {
  protected count: number = 0

  protected getQuoteTxt (): string {
    this.logger.info(`Emitting the message number ${this.count}.`)
    return this.quotes[(this.count++) % this.quotes.length]
  }
}

/**
 * HandlerRandomQuotes: emit quotes by randomly selecting them
 */
class HandlerRandomQuotes extends HandlerQuotesBase {
  protected getQuoteTxt (): string | null {
    const count = Math.round(Math.random() * (this.quotes.length - 1))
    if (count >= this.quotes.length) { return null }
    this.logger.info(`Emitting the random message number ${count}.`)
    return this.quotes[count]
  }
}

HandlersDirectory.singleton().register('quotes', HandlerQuotes)
HandlersDirectory.singleton().register('quotes_random', HandlerRandomQuotes)

export {
  HandlerQuotesBase,
  HandlerQuotes,
  HandlerRandomQuotes
}
