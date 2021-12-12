import type { Room } from '../room'
import { Handler } from './abstract'

abstract class HandlerQuotesBase extends Handler {
  protected timeout: NodeJS.Timeout | undefined

  constructor (
    room: Room,
    protected readonly quotes: string[],
    protected readonly quoteDelay: number = 10 * 1000
  ) {
    super(room)
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
    }
  }

  protected sendQuote (): void {
    const room = this.room
    if (!room.isOnline()) { return }
    // checking if there is someone to listen...
    const onlineUserCount = this.room.onlineUserCount()
    this.logger.debug(`Online user count in room: ${onlineUserCount}`)
    if (onlineUserCount < 2) { return }
    const message = this.getMessage()
    if (!message) { return }
    this.room.sendGroupchat(message).catch((err) => { this.logger.error(err) })
  }

  protected abstract getMessage (): string | null
}

/**
 * HandlerQuotes: emit quotes by cycling
 */
class HandlerQuotes extends HandlerQuotesBase {
  protected count: number = 0

  protected getMessage (): string {
    this.logger.info(`Emitting the message number ${this.count}.`)
    return this.quotes[(this.count++) % this.quotes.length]
  }
}

/**
 * HandlerRandomQuotes: emit quotes by randomly selecting them
 */
class HandlerRandomQuotes extends HandlerQuotesBase {
  protected getMessage (): string | null {
    const count = Math.floor(Math.random() * (this.quotes.length - 1))
    if (count >= this.quotes.length) { return null }
    this.logger.info(`Emitting the random message number ${count}.`)
    return this.quotes[count]
  }
}

export {
  HandlerQuotesBase,
  HandlerQuotes,
  HandlerRandomQuotes
}
