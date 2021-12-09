import type { JID } from '@xmpp/jid'
import type { Room } from './room'

type RoomUserState = 'offline' | 'online'

export class RoomUser {
  public state: RoomUserState = 'offline'
  constructor (
    protected readonly room: Room,
    public readonly JID: JID,
    public readonly isMe: boolean
  ) {}

  public get nick (): string {
    return this.JID.getResource()
  }
}
