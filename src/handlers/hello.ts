import type { Room } from '../room'
import type { RoomUser } from '../user'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'

/**
 * HandlerHello: says hello to incoming users.
 */
class HandlerHello extends Handler {
  protected readonly lastHellos: Map<string, Date> = new Map()
  private readonly roomJoined

  /**
   * @param room the room to handle
   * @param txt optionnal message to say. Use {{NICK}} as a placeholder for the user's nick
   * @param delay if not undefined, do not repeat hello message if the user was already welcomed this past delay seconds
   */
  constructor (
    room: Room,
    protected readonly txt: string = 'Hello {{NICK}}!',
    protected readonly delay: number | undefined = undefined
  ) {
    super(room)

    this.roomJoined = (user: RoomUser): void => {
      if (user.isMe) {
        return
      }
      if (this.delay !== undefined) {
        const lastHello = this.lastHellos.get(user.jid.toString())
        if (lastHello) {
          const now = new Date()
          if ((now.getTime() - lastHello.getTime()) < this.delay) {
            return
          }
        }
      }
      const mention = ReferenceMention.mention(this.txt, user.jid, '{{NICK}}')
      this.room.sendGroupchat(mention.txt, mention.references).catch((err) => { this.logger.error(err) })
    }
  }

  public start (): void {
    this.room.on('room_joined', this.roomJoined)
  }

  public stop (): void {
    this.room.off('room_joined', this.roomJoined)
  }
}

export {
  HandlerHello
}
