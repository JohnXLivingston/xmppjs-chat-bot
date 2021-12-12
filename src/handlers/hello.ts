import type { Room } from '../room'
import type { RoomUser } from '../user'
import { Handler } from './abstract'

class HandlerHello extends Handler {
  constructor (
    room: Room,
    protected readonly message: string = 'Hello {{NICK}}!'
  ) {
    super(room)
  }

  public start (): this {
    this.on('room_joined', (user: RoomUser) => {
      if (!user.isMe) {
        const message = this.message.replace(/{{NICK}}/g, user.nick)
        // TODO: highlight the user (see XMPP specification)
        this.room.sendGroupchat(message).catch((err) => { this.logger.error(err) })
      }
    })
    return this
  }

  public stop (): this {
    return this
  }
}

export {
  HandlerHello
}
