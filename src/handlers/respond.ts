import type { Room, RoomUser } from '../room'
import type { MessageStanza } from '../stanza'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'

/**
 * HandlerRespond: respond when mentionned.
 */
class HandlerRespond extends Handler {
  private readonly roomMentionned

  /**
   * @param room
   * @param txt the message to respond when mentionned. Use the {{NICK}} placeholder to insert the user nick name.
   */
  constructor (
    room: Room,
    protected readonly txt: string = 'Yes {{NICK}}?'
  ) {
    super(room)

    this.roomMentionned = (stanza: MessageStanza, fromUser: RoomUser): void => {
      if (!stanza.from) {
        return
      }
      const mention = ReferenceMention.mention(this.txt, fromUser.jid, '{{NICK}}')
      this.room.sendGroupchat(mention.txt, mention.references).catch((err) => { this.logger.error(err) })
    }
  }

  public start (): void {
    this.room.on('room_mentionned', this.roomMentionned)
  }

  public stop (): void {
    this.room.off('room_mentionned', this.roomMentionned)
  }
}

export {
  HandlerRespond
}
