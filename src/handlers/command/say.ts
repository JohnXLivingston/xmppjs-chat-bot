import type { Room, RoomUser } from '../../room'
import type { MessageStanza } from '../../stanza'
import { HandlerCommand } from './abstract'
import { HandlersDirectory } from '../../handlers_directory'

class HandlerCommandSay extends HandlerCommand {
  protected quotes: string[]

  constructor (id: string, room: Room, options: any) {
    super(id, room, options)
    this.quotes ??= []
  }

  public loadOptions (options: any): void {
    super.loadOptions(options)

    if (typeof options !== 'object') { return }
    if ('quotes' in options) {
      this.quotes = []
      let newQuotes = options.quotes
      if (!Array.isArray(newQuotes)) {
        newQuotes = [newQuotes]
      }
      for (const q of newQuotes) {
        if (typeof q === 'string') {
          this.quotes.push(q)
        }
      }
    }
  }

  protected handleCommand (
    command: string,
    _parameters: string[],
    _stanza: MessageStanza,
    _user: RoomUser
  ): void {
    // Getting a random message from this.quotes
    let count = Math.round(Math.random() * (this.quotes.length - 1))
    if (count >= this.quotes.length) { count = 0 }
    this.logger.info(`Emitting the message number ${count}, responding to !${command}.`)
    const txt = this.quotes[count]
    this.room.sendGroupchat(txt).catch((err) => { this.logger.error(err) })
  }
}

HandlersDirectory.singleton().register('command_say', HandlerCommandSay)

export {
  HandlerCommandSay
}
