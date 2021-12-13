import type { Room } from '../room'
import type { RoomUser } from '../user'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'

/**
 * HandlerHello: says hello to incoming users.
 */
class HandlerHello extends Handler {
  protected readonly lastHellos: Map<string, Date> = new Map()

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
  }

  public start (): void {
    this.on('room_joined', (user: RoomUser) => {
      if (user.isMe) {
        return
      }
      if (!this.room.isOnline()) {
        // must skip if !isOnline, to ignore initials presence messages
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
    })
  }

  public stop (): void {
    this.removeAllListeners()
  }
}

export {
  HandlerHello
}
