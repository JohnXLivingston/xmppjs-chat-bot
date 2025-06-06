/* eslint-disable new-cap *//* (because of RE2.default) */

import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'
import { HandlersDirectory } from '../handlers_directory'
import * as RE2 from 're2'

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
  protected applyToModerators: boolean

  /**
   * @param room
   * @param rules Rules to match on message content.
   */
  constructor (
    id: string,
    room: Room,
    options?: any
  ) {
    super(id, room, options)
    this.rules ??= []
    this.applyToModerators ??= false

    this.roomMessage = (stanza: MessageStanza, fromUser: RoomUser): void => {
      const body = stanza.body()?.toString() ?? ''
      if (!body.length) { return }

      for (const rule of this.rules) {
        const regexps = Array.isArray(rule.regexp) ? rule.regexp : [rule.regexp]
        for (const regexp of regexps) {
          if (regexp.test(body)) {
            this.logger.debug('Message match following rule: ' + rule.name)
            if (!this.applyToModerators && fromUser.isModerator()) {
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

    if (('applyToModerators' in options) && (typeof options.applyToModerators === 'boolean')) {
      this.applyToModerators = options.applyToModerators
    }

    if (!('rules' in options)) { return }
    let rules = options.rules

    this.rules = []
    if (!Array.isArray(rules)) {
      // Just one RegExp
      if (typeof rules === 'string') {
        rules = new RE2.default(rules, 'i') // can throw an exception if rules not valid
      }
      if (!(rules instanceof RE2.default)) {
        throw new Error('Invalid rules options')
      }
      this.rules.push({
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        name: rules.toString(),
        regexp: rules
      })
    } else {
      // Array<RegExp|RE2|Pattern>
      for (let rule of rules) {
        if (typeof rule === 'string') {
          rule = new RE2.default(rule, 'i') // can throw an exception if rules not valid
        }
        if ((rule instanceof RE2.default) || rule instanceof RegExp) {
          this.rules.push({
            name: rule.toString(),
            regexp: rule
          })
        } else if ((typeof rule === 'object') && rule.name && rule.regexp) {
          const modifiers = (typeof rule.modifiers === 'string') ? rule.modifiers : undefined

          let r: RE2 | RegExp
          if ((typeof rule.regexp === 'string') || modifiers !== undefined) {
            // Note: if there are modifiers, we must recreate the regexp to be sure it applies.
            r = (rule.regexp_engine === 'regexp')
              ? new RegExp(rule.regexp, modifiers ?? 'i')
              : new RE2.default(rule.regexp, modifiers ?? 'i')
          } else {
            if (!(rule.regexp instanceof RE2.default) && !(rule.regexp instanceof RegExp)) {
              throw new Error('Invalid rule.regexp value')
            }
            r = rule.regexp

            // Checking that the type is correct...
            if (rule.regexp_engine === 'regexp') {
              if (r instanceof RE2.default) {
                r = new RegExp(r)
              }
            } else {
              if (!(r instanceof RE2.default)) {
                r = new RE2.default(r)
              }
            }
          }

          this.rules.push({
            name: rule.name,
            regexp: r,
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
    this.room.off('room_message', this.roomMessage)
  }
}

HandlersDirectory.singleton().register('moderate', HandlerModerate)

export {
  HandlerModerate
}
