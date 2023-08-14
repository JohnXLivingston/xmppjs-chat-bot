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

declare interface Room {
  on: (
    ((event: 'room_joined', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_parted', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_message', listener: (stanza: MessageStanza, fromUser: RoomUser) => void) => this) &
    ((event: 'room_mentionned', listener: (stanza: MessageStanza, fromUser: RoomUser) => void) => this)
  )
  emit: (
    ((event: 'room_joined', user: RoomUser) => boolean) &
    ((event: 'room_parted', user: RoomUser) => boolean) &
    ((event: 'room_message', stanza: MessageStanza, fromUser: RoomUser) => boolean) &
    ((event: 'room_mentionned', stanza: MessageStanza, fromUser: RoomUser) => boolean)
  )
}

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

  /**
   * Moderate a message by sending the corresponding stanza.
   * See https://xmpp.org/extensions/xep-0425.html.
   * @param stanza The message to moderate
   * @param reason The optionnal reason for the moderation
   * @returns void
   */
  public async moderateMessage (stanza: MessageStanza, reason?: string): Promise<void> {
    const messageId = stanza.uniqueAndStableStanzaID()
    if (!messageId) {
      this.logger.error('Can\'t emit a retract for a message without uniqueAndStableStanzaID.')
      return
    }
    this.logger.debug(`Emitting a retract for room ${this.roomJID.toString()} and message ${messageId}...`)

    const moderateChildren: Node[] = [
      xml('retract', {
        xmlns: 'urn:xmpp:message-retract:0'
      })
    ]
    if (reason) {
      moderateChildren.push(xml('reason', {}, reason))
    }

    const applyTo = xml(
      'apply-to', {
        xmlns: 'urn:xmpp:fasten:0',
        id: messageId
      },
      xml(
        'moderate',
        {
          xmlns: 'urn:xmpp:message-moderate:0'
        },
        ...moderateChildren
      )
    )
    await this.bot.sendStanza(
      'iq',
      {
        type: 'set',
        to: this.roomJID.toString()
      },
      applyTo
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
        if (this.isOnline()) {
          // must skip if !isOnline, to ignore initials presence messages
          this.logger.debug('[Room:receivePresenceStanza] user was previously online, emitting room_parted event')
          this.emit('room_parted', user)
        }
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
        if (this.isOnline()) {
          // must skip if !isOnline, to ignore initials presence messages
          this.logger.debug('[Room:receivePresenceStanza] user was previously not online, emitting room_joined event')
          this.emit('room_joined', user)
        }
      }
    }
  }

  protected receiveMessageStanza (stanza: MessageStanza): void {
    const from = stanza.from
    if (!from) { return }

    if (!this.isOnline()) {
      // We are no more in the room, don't trigger anything.
      return
    }

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

    const user = this.roster.get(from.toString())
    if (!user) {
      this.logger.error(`Cant find user ${from.toString()} in room ${this.roomJID.toString()} roster.`)
      return
    }
    this.emit('room_message', stanza, user)

    // I'm I mentionned?
    if (this.userJID) {
      const searchJIDs = [this.userJID]
      const addr = this.bot.getAddress()
      if (addr) {
        searchJIDs.push(addr)
      }
      if (stanza.isMentionned(searchJIDs)) {
        this.logger.debug('[HandlerRespond] Im mentionned in the message, using XMPP references')
        this.emit('room_mentionned', stanza, user)
      }
    }
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

export {
  Room,
  RoomUser
}
