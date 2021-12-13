import type { Room, RoomMessage } from '../room'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'

/**
 * HandlerRespond: respond when mentionned.
 */
class HandlerRespond extends Handler {
  /**
   * @param room
   * @param txt the message to respond when mentionned. Use the {{NICK}} placeholder to insert the user nick name.
   */
  constructor (
    room: Room,
    protected readonly txt: string = 'Yes {{NICK}}?'
  ) {
    super(room)
  }

  public start (): void {
    this.on('room_message', (message: RoomMessage) => {
      if (message.from.isMe) {
        return
      }
      if (!message.mentionned) {
        return
      }
      // TODO: highlight the user (see XMPP specification)
      const mention = ReferenceMention.mention(this.txt, message.from.jid, '{{NICK}}')
      this.room.sendGroupchat(mention.txt, mention.references).catch((err) => { this.logger.error(err) })
    })
  }

  public stop (): void {
    this.removeAllListeners()
  }
}

export {
  HandlerRespond
}
