import type { Room } from '../room'
import type { RoomUser } from '../user'
import { Handler } from './abstract'

/**
 * HandlerHello: says hello to incoming users.
 */
class HandlerHello extends Handler {
  protected readonly lastHellos: Map<string, Date> = new Map()

  /**
   * @param room the room to handle
   * @param message optionnal message to say. Use {{NICK}} as a placeholder for the user's nick
   * @param delay if not undefined, do not repeat hello message if the user was already welcomed this past delay seconds
   */
  constructor (
    room: Room,
    protected readonly message: string = 'Hello {{NICK}}!',
    protected readonly delay: number | undefined = undefined
  ) {
    super(room)
  }

  public start (): this {
    this.on('room_joined', (user: RoomUser) => {
      if (user.isMe) {
        return
      }
      if (!this.room.isOnline()) {
        // must skip if !isOnline, to ignore initials presence messages
        return
      }
      if (this.delay !== undefined) {
        const lastHello = this.lastHellos.get(user.JID.toString())
        if (lastHello) {
          const now = new Date()
          if ((now.getTime() - lastHello.getTime()) < this.delay) {
            return
          }
        }
      }
      const message = this.message.replace(/{{NICK}}/g, user.nick)
      // TODO: highlight the user (see XMPP specification)
      this.room.sendGroupchat(message).catch((err) => { this.logger.error(err) })
    })
    return this
  }

  public stop (): this {
    this.removeAllListeners()
    return this
  }
}

export {
  HandlerHello
}
