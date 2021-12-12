import type { Room, RoomMessage } from '../room'
import { Handler } from './abstract'

/**
 * HandlerRespond: respond when mentionned.
 */
class HandlerRespond extends Handler {
  /**
   * @param room
   * @param message the message to respond when mentionned. Use the {{NICK}} placeholder to insert the user nick name.
   */
  constructor (
    room: Room,
    protected readonly message: string = 'Yes {{NICK}}?'
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
      const txt = this.message.replace(/{{NICK}}/g, message.from.nick)
      // TODO: highlight the user (see XMPP specification)
      this.room.sendGroupchat(txt).catch((err) => { this.logger.error(err) })
    })
  }

  public stop (): void {
    this.removeAllListeners()
  }
}

export {
  HandlerRespond
}
