import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'
import { HandlersDirectory } from '../handlers_directory'

const DEFAULT_DELAY_SECONDS = 60
const PRUNE_DELAY_SECONDS = 5 * 60

/**
 * Moderates duplicates messages.
 */
class HandlerNoDuplicate extends Handler {
  protected reason: string | undefined
  protected delay: number
  protected applyToModerators: boolean

  protected readonly roomMessageListener
  protected pruneTimeout: NodeJS.Timeout | undefined
  protected userMessages = new Map<string, Map<string, number>>()

  /**
   * @param id Handler id
   * @param room Room to join
   * @param options Handler options
   */
  constructor (
    id: string,
    room: Room,
    options?: unknown
  ) {
    super(id, room, options)

    // initializations must be done after super(), to correctly load from options
    this.delay ??= DEFAULT_DELAY_SECONDS * 1000
    this.applyToModerators ??= false

    // We must use this close so we can call room.off()
    this.roomMessageListener = (stanza: MessageStanza, fromUser: RoomUser): void => {
      try {
        this.roomMessage(stanza, fromUser)
      } catch (err) {
        if (err instanceof Error) {
          this.logger.error(err.name + ': ' + err.message)
        } else {
          this.logger.error((err as string))
        }
      }
    }
  }

  public override loadOptions (options: unknown): void {
    if (!options || typeof options !== 'object') { return }

    if (('applyToModerators' in options) && (typeof options.applyToModerators === 'boolean')) {
      this.applyToModerators = options.applyToModerators
    }
    if (('delay' in options) && (options.delay === undefined || (typeof options.delay === 'number'))) {
      const newDelay = (options.delay ?? DEFAULT_DELAY_SECONDS) * 1000 // Converting to seconds
      this.delay = newDelay
    }
    if (('reason' in options) && (options.reason === undefined || (typeof options.reason === 'string'))) {
      this.reason = options.reason
    }
  }

  protected roomMessage (stanza: MessageStanza, fromUser: RoomUser): void {
    let content = stanza.body()
    if (!content) { return }
    content = this.normalizeMessage(content)

    // We will use as key the occupant id if available, and fallback to the user JID.
    const userKey = stanza.occupantId() ?? fromUser.jid.toString()

    let messages = this.userMessages.get(userKey)
    if (!messages) {
      messages = new Map()
      this.userMessages.set(userKey, messages)
    }

    const lastSent = messages.get(content)
    const now = Date.now()
    messages.set(content, now)

    if (!lastSent) {
      return
    }
    const limit = now - this.delay
    if (lastSent < limit) {
      return
    }
    this.logger.debug(
      `user ${userKey} has already sent a similar messages at ${lastSent}, which is after ${limit}`
    )
    if (!this.applyToModerators && fromUser.isModerator()) {
      this.logger.debug(`Ignoring the no-duplicate rule, as the user ${userKey} is moderator.`)
      return
    }
    this.room.moderateMessage(stanza, this.reason).catch((err) => { this.logger.error(err) })
  }

  /**
   * Normalize the message, to avoid tricking the bot too easily.
   * @param s The message content
   */
  protected normalizeMessage (s: string): string {
    return s.replace('\n', ' ').trim().replace(/\s\s+/g, ' ').toLocaleLowerCase()
  }

  /**
   * Prunes messages map.
   */
  protected pruneUserMessages (): void {
    const timestamp = Date.now() - this.delay
    const dateStr = (new Date(timestamp)).toISOString()

    this.logger.debug(
      `Pruning user messages with timestamp older than ${timestamp.toString()} (<= ${dateStr})...`
    )

    this.userMessages.forEach((messages, userKey) => {
      this.logger.debug('Pruning user ' + userKey + ' messages...')

      messages.forEach((msgTimestamp, content) => {
        if (msgTimestamp >= timestamp) { return }
        this.logger.debug('Pruning a message sent at ' + msgTimestamp.toString())
        messages.delete(content)
      })
      if (messages.size === 0) {
        this.logger.debug(`User ${userKey} has no more message in their map, deleting it.`)
        this.userMessages.delete(userKey)
      }
    })

    this.logger.debug('Prune is finished.')
  }

  public override start (): void {
    this.room.on('room_message', this.roomMessageListener)
    if (this.pruneTimeout) {
      clearInterval(this.pruneTimeout)
    }
    this.pruneTimeout = setInterval(() => {
      this.pruneUserMessages()
    }, PRUNE_DELAY_SECONDS * 1000)
  }

  public override stop (): void {
    this.room.off('room_message', this.roomMessageListener)
    if (this.pruneTimeout) {
      clearInterval(this.pruneTimeout)
      this.pruneTimeout = undefined
    }

    this.userMessages.clear()
  }
}

HandlersDirectory.singleton().register('no-duplicate', HandlerNoDuplicate)

export {
  HandlerNoDuplicate
}
