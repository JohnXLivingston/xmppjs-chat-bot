import type { Room } from '../room'
import type { RoomUser } from '../user'
import { Handler } from './abstract'
import { ReferenceMention } from '../reference'
import { HandlersDirectory } from '../handlers_directory'

/**
 * HandlerHello: says hello to incoming users.
 */
class HandlerHello extends Handler {
  protected readonly lastHellos: Map<string, Date> = new Map()
  private readonly roomJoined
  protected txt: string
  protected delay: number | undefined

  /**
   * @param room the room to handle
   * @param txt optionnal message to say. Use {{NICK}} as a placeholder for the user's nick
   * @param delay if not undefined, do not repeat hello message if the user was already welcomed this past delay seconds
   */
  constructor (
    room: Room,
    options?: any
  ) {
    super(room, options)
    this.txt ??= 'Hello {{NICK}}!'

    this.roomJoined = (user: RoomUser): void => {
      if (user.isMe()) {
        return
      }
      if (this.delay !== undefined) {
        const jid = user.jid.toString()
        const now = new Date()
        const lastHello = this.lastHellos.get(jid)
        if (lastHello) {
          this.logger.debug(`We already helloed the user ${jid}, checking if delay ${this.delay} is over.`)
          if ((now.getTime() - lastHello.getTime()) < this.delay * 1000) {
            this.logger.debug('Last hello was too recent.')
            this.lastHellos.set(jid, now)
            return
          }
        }
        this.lastHellos.set(jid, now)
      }
      const mention = ReferenceMention.mention(this.txt, user.jid, '{{NICK}}')
      this.room.sendGroupchat(mention.txt, mention.references).catch((err) => { this.logger.error(err) })
    }
  }

  public loadOptions (options: any): void {
    if (typeof options !== 'object') { return }
    if (('txt' in options) && (typeof options.txt === 'string')) {
      this.txt = options.txt
    }
    if (('delay' in options) && (options.delay === undefined || (typeof options.delay === 'number'))) {
      this.delay = options.delay
    }
  }

  public start (): void {
    this.room.on('room_joined', this.roomJoined)
  }

  public stop (): void {
    this.room.off('room_joined', this.roomJoined)
  }
}

HandlersDirectory.singleton().register('hello', HandlerHello)

export {
  HandlerHello
}
