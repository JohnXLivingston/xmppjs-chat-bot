import type { JID } from '@xmpp/jid'
import type { Room } from './room'
import type { PresenceStanza } from './stanza'

type RoomUserState = 'offline' | 'online'

export class RoomUser {
  protected readonly room: Room
  protected currentState: RoomUserState = 'offline'
  public readonly jid: JID
  protected readonly userIsMe: boolean

  constructor (
    room: Room,
    presence: PresenceStanza
  ) {
    this.room = room
    if (!presence.from) {
      throw new Error('Can\'t instanciate a RoomUser from a presence stanza without from.')
    }
    this.jid = presence.from
    this.userIsMe = presence.isMe()
    this.update(presence)
  }

  /**
   * Update the information from a new presence stanza.
   * @param presence New presence stanza for the same user
   * @returns Returns true if the state changed.
   */
  public update (presence: PresenceStanza): boolean {
    if (presence.from?.toString() !== this.jid.toString()) {
      // FIXME: handle nickname changes!
      this.room.logger.error('This presence stanza is not for the same user.')
      return false
    }

    const isPresent = presence.type !== 'unavailable'
    const previousState = this.currentState
    this.currentState = isPresent ? 'online' : 'offline'
    return this.currentState !== previousState
  }

  public get nick (): string {
    return this.jid.getResource()
  }

  /**
   * Indicate if the user is online in the room.
   * @returns true if user is currently online in the room
   */
  public isOnline (): boolean {
    return this.currentState === 'online'
  }

  public isMe (): boolean {
    return this.userIsMe
  }
}
