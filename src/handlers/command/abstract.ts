import type { Room, RoomUser } from '../../room'
import type { MessageStanza } from '../../stanza'
import { Handler } from '../abstract'

abstract class HandlerCommand extends Handler {
  protected commandNames: string[]
  protected readonly roomCommand

  constructor (id: string, room: Room, options: any) {
    super(id, room, options)
    this.commandNames ??= []

    this.roomCommand = (
      command: string,
      parameters: string[],
      stanza: MessageStanza,
      fromUser: RoomUser
    ): void => {
      if (!stanza.from) {
        return
      }
      if (!this.commandNames.includes(command)) {
        // not my command.
        return
      }
      this.handleCommand(command, parameters, stanza, fromUser)
    }
  }

  public loadOptions (options: any): void {
    if (typeof options !== 'object') { return }
    if ('command' in options) {
      this.commandNames = []
      let newcommandNames = options.command
      if (!Array.isArray(newcommandNames)) {
        newcommandNames = [newcommandNames]
      }
      for (const q of newcommandNames) {
        if (typeof q === 'string') {
          this.commandNames.push(q)
        }
      }
    }
  }

  public start (): void {
    this.room.on('room_command', this.roomCommand)
  }

  public stop (): void {
    this.room.off('room_command', this.roomCommand)
  }

  /**
   * Method that implement the command handler.
   * @param command the command name
   * @param parameters command parameters
   * @param stanza the message stanza
   * @param user the room user
   */
  protected abstract handleCommand (
    command: string,
    parameters: string[],
    stanza: MessageStanza,
    user: RoomUser
  ): void
}

export {
  HandlerCommand
}
