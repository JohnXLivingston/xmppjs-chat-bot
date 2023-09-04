import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'
import { HandlersDirectory } from '../handlers_directory'

interface Rule {
  name: string
  regexp: RegExp | RegExp[]
  reason?: string
}

/**
 * Delete message with given patterns.
 */
class HandlerModerate extends Handler {
  private readonly roomMessage
  protected rules: Rule[]

  /**
   * @param room
   * @param rules Rules to match on message content.
   */
  constructor (
    room: Room,
    options?: any
  ) {
    super(room, options)
    this.rules ??= []

    this.roomMessage = (stanza: MessageStanza, fromUser: RoomUser): void => {
      const body = stanza.body()?.toString() ?? ''
      if (!body.length) { return }

      for (const rule of this.rules) {
        const regexps = Array.isArray(rule.regexp) ? rule.regexp : [rule.regexp]
        for (const regexp of regexps) {
          if (regexp.test(body)) {
            this.logger.debug('Message match following rule: ' + rule.name)
            if (fromUser.isModerator()) {
              this.logger.debug('Ignoring the moderation rule ' + rule.name + ', because the user is moderator.')
              continue
            }
            this.room.moderateMessage(stanza, rule.reason).catch((err) => { this.logger.error(err) })
            return
          }
        }
      }
    }
  }

  public loadOptions (options: any): void {
    if (typeof options !== 'object') { return }

    if (!('rules' in options)) { return }
    const rules = options.rules

    this.rules = []
    if (!Array.isArray(rules)) {
      // Just one RegExp
      if (!(rules instanceof RegExp)) {
        throw new Error('Invalid rules options')
      }
      this.rules.push({
        name: rules.toString(),
        regexp: rules
      })
    } else {
      // Array<RegExp|Pattern>
      for (const rule of rules) {
        if (rule instanceof RegExp) {
          this.rules.push({
            name: rule.toString(),
            regexp: rule
          })
        } else if ((typeof rule === 'object') && rule.name && rule.regexp) {
          this.rules.push({
            name: rule.name,
            regexp: rule.regexp,
            reason: rule.reason
          })
        } else {
          throw new Error('Invalid rule value')
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

HandlersDirectory.singleton().register('moderate', HandlerModerate)

export {
  HandlerModerate
}