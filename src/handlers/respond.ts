import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'
import { HandlersDirectory } from '../handlers_directory'

/**
 * HandlerRespond: respond when mentionned.
 */
class HandlerRespond extends Handler {
  private readonly roomMentionned
  protected txt: string

  /**
   * @param room
   * @param txt the message to respond when mentionned. Use the {{NICK}} placeholder to insert the user nick name.
   */
  constructor (
    id: string,
    room: Room,
    options?: any
  ) {
    super(id, room, options)
    this.txt ??= 'Yes {{NICK}}?'

    this.roomMentionned = (stanza: MessageStanza, fromUser: RoomUser): void => {
      if (!stanza.from) {
        return
      }
      const mention = ReferenceMention.mention(this.txt, fromUser.jid, '{{NICK}}')
      this.room.sendGroupchat(mention.txt, mention.references).catch((err) => { this.logger.error(err) })
    }
  }

  public loadOptions (options: any): void {
    if (typeof options !== 'object') { return }
    if (('txt' in options) && (typeof options.txt === 'string')) {
      this.txt = options.txt
    }
  }

  public start (): void {
    this.room.on('room_mentionned', this.roomMentionned)
  }

  public stop (): void {
    this.room.off('room_mentionned', this.roomMentionned)
  }
}

HandlersDirectory.singleton().register('respond', HandlerRespond)

export {
  HandlerRespond
}
