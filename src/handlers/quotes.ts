import type { Room } from '../room'
import { Handler } from './abstract'

const MESSAGES: string[] = [
  '🎵🎶',
  '🎵🎶 I\'m just a bot, I\'m just a bot in the world. 🎵🎶',
  'You can see who is connected by opening the right panel.',
  'This is a random message.',
  'Oh, yet another random message.',
  'You can mention a user using a @ in front of a user\'s nick. Try to mention me.'
]

export class HandlerQuotes extends Handler {
  protected readonly quoteDelay: number
  protected count: number = 0
  protected timeout: NodeJS.Timeout | undefined

  constructor (room: Room, quoteDelay?: number) {
    super(room)
    this.quoteDelay = quoteDelay ?? 10 * 1000
  }

  public start (): this {
    if (this.timeout) { this.stop() }
    this.timeout = setInterval(() => {
      this.sendQuote()
    }, this.quoteDelay)
    return this
  }

  public stop (): this {
    if (this.timeout) {
      clearInterval(this.timeout)
    }
    return this
  }

  protected sendQuote (): void {
    const room = this.room
    if (!room.isOnline()) { return }
    // checking if there is someone to listen...
    const onlineUserCount = this.room.onlineUserCount()
    this.logger.debug(`Online user count in room: ${onlineUserCount}`)
    if (onlineUserCount < 2) { return }
    const cpt = this.count++
    this.logger.info(`Emitting the random message number ${cpt}.`)
    this.room.sendGroupchat(MESSAGES[cpt % MESSAGES.length]).catch(() => {})
  }
}
