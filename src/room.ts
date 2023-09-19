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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xmppid = require('@xmpp/id')

declare interface Room {
  on: (
    ((event: 'room_joined', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_parted', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_message', listener: (stanza: MessageStanza, fromUser: RoomUser) => void) => this) &
    ((event: 'room_mentionned', listener: (stanza: MessageStanza, fromUser: RoomUser) => void) => this) &
    ((event: 'room_command', listener: (
      command: string, parameters: string[], stanza: MessageStanza, fromUser: RoomUser
    ) => void) => this)
  )
  emit: (
    ((event: 'room_joined', user: RoomUser) => boolean) &
    ((event: 'room_parted', user: RoomUser) => boolean) &
    ((event: 'room_message', stanza: MessageStanza, fromUser: RoomUser) => boolean) &
    ((event: 'room_mentionned', stanza: MessageStanza, fromUser: RoomUser) => boolean) &
    ((
      event: 'room_command',
      command: string, parameters: string[],
      stanza: MessageStanza,
      fromUser: RoomUser
    ) => boolean)
  )
}

class Room extends EventEmitter {
  protected state: 'offline' | 'online' = 'offline'
  protected userJID: JID | undefined
  protected readonly roster: Map<string, RoomUser> = new Map()
  public readonly logger: Logger

  protected readonly handlers: {[id: string]: Handler} = {}

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
      if (user.isOnline()) { count++ }
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

  /**
   * Changes the bot nickname
   * @param nick new nickname
   * @returns void
   */
  public async changeNickname (nick: string): Promise<void> {
    // Changing nickname is equivalent to join a room.
    return this.join(nick)
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
    // FIXME: use https://github.com/xmppjs/xmpp.js/blob/main/packages/iq/caller.js
    //      instead of hard coding a sendStanza.
    await this.bot.sendStanza(
      'iq',
      {
        type: 'set',
        to: this.roomJID.toString(),
        id: xmppid()
      },
      applyTo
    )
  }

  public receiveStanza (stanza: Stanza): void {
    try {
      if (stanza.stanzaType === 'presence') {
        this.receivePresenceStanza(stanza as PresenceStanza)
      }
      if (stanza.stanzaType === 'message') {
        this.receiveMessageStanza(stanza as MessageStanza)
      }
    } catch (err) {
      this.logger.error('Error when processing a stanza: ' + (err as string))
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

    let user: RoomUser | undefined = this.roster.get(from.toString())
    if (!user) {
      this.logger.debug('[Room:receivePresenceStanza] user was not in roster, creating it')
      user = new RoomUser(this, stanza)
      this.roster.set(from.toString(), user)
    }

    // Updating userRoom object, and emitting events if state changed.
    const updated = user.update(stanza)
    if (user.isMe()) {
      // updating room state
      this.state = user.isOnline() ? 'online' : 'offline'
    }
    if (updated && this.isOnline()) {
      // must skip if !room.isOnline, to ignore initials presence messages
      if (user.isOnline()) {
        this.logger.debug('[Room:receivePresenceStanza] user was previously not online, emitting room_joined event')
        this.emit('room_joined', user)
      } else {
        this.logger.debug('[Room:receivePresenceStanza] user was previously online, emitting room_parted event')
        this.emit('room_parted', user)
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

    // Is this a command? (message that starts with !)
    if (body.startsWith('!')) {
      const parameters = body.split(/\s+/)
      const command = parameters.shift()?.substring(1)
      if (command) {
        this.emit('room_command', command, parameters, stanza, user)
      }
    }

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
    if (handler.id in this.handlers) {
      throw new Error('Can\'t attach handler, there is already an handler with the same id: ' + handler.id)
    }
    this.handlers[handler.id] = handler
  }

  public detachHandlers (): void {
    this.logger.debug('Stoping and Detaching all handlers')
    for (const id of Object.keys(this.handlers)) {
      const handler = this.handlers[id]
      handler.stop()
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.handlers[id]
    }
  }

  public getHandlerById (id: string): Handler | null {
    return this.handlers[id] ?? null
  }

  public detachHandlerById (id: string): void {
    const handler = this.handlers[id]
    if (!handler) { return }
    this.logger.debug('Stoping and Detaching handler ' + id)
    handler.stop()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.handlers[id]
  }
}

export {
  Room,
  RoomUser
}
