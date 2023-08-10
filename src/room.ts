import type { Node } from '@xmpp/xml'
import type { Bot } from './bot'
import { Logger, wrapLogger } from './logger'
import type { Stanza, MessageStanza, PresenceStanza } from './stanza'
import type { Reference } from './reference'
import type { Handler } from './handlers/abstract'
import EventEmitter from 'events'
import { JID } from '@xmpp/jid'
import xml from '@xmpp/xml'
import { RoomUser } from './user'

class Room extends EventEmitter {
  protected state: 'offline' | 'online' = 'offline'
  protected userJID: JID | undefined
  protected readonly roster: Map<string, RoomUser> = new Map()
  public readonly logger: Logger

  protected readonly handlers: Handler[] = []

  constructor (
    protected readonly bot: Bot,
    protected readonly roomJID: JID
  ) {
    super()
    this.logger = wrapLogger(this.roomJID.toString(), bot.logger)
  }

  /**
   * Resets the room states (empties the roster, mark offline).
   */
  public reset (): void {
    this.state = 'offline'
    this.roster.clear()
  }

  /**
   * Indicate if we are in the room
   * @returns is online
   */
  public isOnline (): boolean {
    return this.state === 'online'
  }

  public onlineUserCount (): number {
    let count = 0
    this.roster.forEach(user => {
      if (user.state === 'online') { count++ }
    })
    return count
  }

  public get myNick (): string | undefined {
    return this.userJID?.getResource()
  }

  public get jid (): JID {
    return this.roomJID
  }

  public async join (nick: string): Promise<void> {
    this.userJID = new JID(this.roomJID.getLocal(), this.roomJID.getDomain(), nick)
    this.logger.debug(`Emitting a presence for room ${this.roomJID.toString()}...`)
    await this.bot.sendStanza('presence',
      {
        to: this.userJID.toString()
      },
      xml('x', {
        xmlns: 'http://jabber.org/protocol/muc'
      })
    )
    // FIXME: should wait for a presence stanza from the server.
    // FIXME: should handle used nick errors.
  }

  public async part (): Promise<void> {
    if (!this.userJID) { return }
    this.logger.debug(`Emitting a presence=unavailable for room ${this.roomJID.toString()}...`)
    await this.bot.sendStanza('presence', {
      to: this.userJID.toString(),
      type: 'unavailable'
    })
    // FIXME: should wait for a presence stanza from the server.
  }

  public async sendGroupchat (msg: string, references?: Reference[]): Promise<void> {
    if (!this.userJID) { return }
    this.logger.debug(`Emitting a groupchat message for room ${this.roomJID.toString()}...`)
    const children: Node[] = []
    children.push(xml('body', {}, msg))
    if (references) {
      references.forEach(reference => {
        children.push(reference.toXml())
      })
    }
    await this.bot.sendStanza(
      'message',
      {
        type: 'groupchat',
        to: this.roomJID.toString()
      },
      ...children
    )
  }

  public receiveStanza (stanza: Stanza): void {
    if (stanza.stanzaType === 'presence') {
      this.receivePresenceStanza(stanza as PresenceStanza)
    }
    if (stanza.stanzaType === 'message') {
      this.receiveMessageStanza(stanza as MessageStanza)
    }
  }

  public receivePresenceStanza (stanza: PresenceStanza): void {
    const from = stanza.from
    if (!from) {
      this.logger.debug('[Room:receivePresenceStanza] no from, discard.')
      return
    }
    if (!from.getResource()) {
      // This is not a room user.
      this.logger.debug('[Room:receivePresenceStanza] no resource in from, discard.')
      return
    }

    if (stanza.type === 'error') {
      this.logger.error('[Room:receivePresenceStanza] Received error stanza. Dont deal with errors yet, discard')
      return
    }

    const isPresent = stanza.type !== 'unavailable'

    const isMe: boolean = stanza.isMe()

    let user: RoomUser | undefined = this.roster.get(from.toString())
    const previousState = user?.state
    if (!isPresent) {
      this.logger.debug('[Room:receivePresenceStanza] presence=unavailable...')
      if (!user) {
        this.logger.debug('[Room:receivePresenceStanza] user was not in roster, discard')
        return
      }
      user.state = 'offline'
      if (isMe) {
        this.logger.debug('[Room:receivePresenceStanza] im offline, changing the room state to reflect')
        this.state = 'offline'
      }
      if (previousState === 'online') {
        this.logger.debug('[Room:receivePresenceStanza] user was previously online, emitting room_parted event')
        this.handlers.forEach((handler) => {
          handler.emit('room_parted', user as RoomUser)
        })
      }
    } else {
      this.logger.debug('[Room:receivePresenceStanza] presence=yes')
      if (!user) {
        this.logger.debug('[Room:receivePresenceStanza] user not in roster, creating it')
        user = new RoomUser(
          this,
          from,
          isMe
        )
        user.state = 'online'
        this.roster.set(from.toString(), user)
      } else {
        this.logger.debug('[Room:receivePresenceStanza] marking user online')
        user.state = 'online'
      }
      if (isMe) {
        this.logger.debug('[Room:receivePresenceStanza] im online, changing the room state to reflect')
        this.state = 'online'
      }
      if (previousState !== 'online') {
        this.logger.debug('[Room:receivePresenceStanza] user was previously not online, emitting room_joined event')
        this.handlers.forEach((handler) => {
          handler.emit('room_joined', user as RoomUser)
        })
      }
    }
  }

  protected receiveMessageStanza (stanza: MessageStanza): void {
    const from = stanza.from
    if (!from) { return }

    if (stanza.type !== 'groupchat') {
      return
    }
    // ignoring messages send by the bot himself
    if (this.userJID && from.equals(this.userJID)) {
      return
    }
    // ignoring history messages
    if (stanza.isDelayed()) {
      return
    }
    const body = stanza.body()
    // ignoring message without body (subject, ...)
    if (!body) {
      return
    }

    let mentionned: boolean = false // I'm I mentionned?
    if (this.userJID) {
      const searchJIDs = [this.userJID]
      const addr = this.bot.getAddress()
      if (addr) {
        searchJIDs.push(addr)
      }
      mentionned = stanza.isMentionned(searchJIDs)
    }

    const user = this.roster.get(from.toString())
    if (!user) {
      this.logger.error(`Cant find user ${from.toString()} in room ${this.roomJID.toString()} roster.`)
      return
    }
    const message = new RoomMessage(this, user, body.toString(), mentionned)
    this.handlers.forEach((handler) => {
      handler.emit('room_message', message)
    })
  }

  public attachHandler (handler: Handler): void {
    this.handlers.push(handler)
  }

  public stopHandlers (): void {
    for (const handler of this.handlers) {
      handler.stop()
    }
  }
}

class RoomMessage {
  constructor (
    protected readonly room: Room,
    public readonly from: RoomUser,
    public readonly txt: string,
    public readonly mentionned: boolean
  ) {}

  public get containsMyNick (): boolean {
    const myNick = this.room.myNick
    return !!(myNick && myNick.length > 0 && this.txt.includes(myNick))
  }
}

export {
  Room,
  RoomMessage
}
