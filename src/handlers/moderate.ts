import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'

interface Rule {
  name: string
  pattern: RegExp | RegExp[]
  reason?: string
}

/**
 * Delete message with given patterns.
 */
class HandlerModerate extends Handler {
  private readonly roomMessage
  protected readonly rules: Rule[]

  /**
   * @param room
   * @param rules Rules to match on message content.
   */
  constructor (
    room: Room,
    rules: Array<Rule|RegExp> | RegExp
  ) {
    super(room)

    this.rules = []
    if (!Array.isArray(rules)) {
      // Just one RegExp
      this.rules.push({
        name: rules.toString(),
        pattern: rules
      })
    } else {
      // Array<RegExp|Pattern>
      for (const rule of rules) {
        if (rule instanceof RegExp) {
          this.rules.push({
            name: rule.toString(),
            pattern: rule
          })
        } else if ((typeof rule === 'object') && rule.name && rule.pattern) {
          this.rules.push({
            name: rule.name,
            pattern: rule.pattern,
            reason: rule.reason
          })
        } else {
          throw new Error('Invalid rule value')
        }
      }
    }

    this.roomMessage = (stanza: MessageStanza, _fromUser: RoomUser): void => {
      const body = stanza.body()?.toString() ?? ''
      if (!body.length) { return }
      for (const rule of this.rules) {
        const patterns = Array.isArray(rule.pattern) ? rule.pattern : [rule.pattern]
        for (const pattern of patterns) {
          if (pattern.test(body)) {
            this.logger.debug('Message match following rule: ' + rule.name)
            this.room.moderateMessage(stanza, rule.reason).catch((err) => { this.logger.error(err) })
            return
          }
        }
      }
    }
  }

  public start (): void {
    this.room.on('room_message', this.roomMessage)
  }

  public stop (): void {
    this.room.off('room_mentionned', this.roomMessage)
  }
}

export {
  HandlerModerate
}
