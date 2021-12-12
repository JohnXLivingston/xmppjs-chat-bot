import type { Node } from '@xmpp/xml'
import type { XMPPStanza, XMPPStanzaType } from './stanza'
import Connection from '@xmpp/connection'
import { parse, JID } from '@xmpp/jid'
import xml from '@xmpp/xml'
import { DefaultLogger, Logger } from './logger'
import { Room } from './room'

export class Bot {
  protected address?: JID
  public readonly logger: Logger
  protected rooms: Map<string, Room> = new Map()

  constructor (
    public readonly botName: string,
    protected readonly xmpp: Connection,
    logger?: Logger
  ) {
    this.logger = logger ?? new DefaultLogger()
  }

  public async connect (): Promise<void> {
    this.xmpp.on('error', (err: any) => {
      this.logger.error(err)
    })

    this.xmpp.on('offline', () => {
      this.logger.info(`${this.botName} is now offline.`)
    })

    this.xmpp.on('stanza', (stanza: XMPPStanza) => {
      this.logger.debug('stanza received' + stanza.toString())
      if (!stanza.attrs.from) { return }
      const from = parse(stanza.attrs.from)
      const roomJid = from.bare() // removing the «resource» part of the jid.
      const room = this.rooms.get(roomJid.toString())
      if (!room) {
        return
      }
      room.emit('stanza', stanza, from)
    })

    this.xmpp.on('online', (address) => {
      this.logger.debug('Online with address' + address.toString())

      this.address = address

      // 'online' is emitted at reconnection, so we must reset rooms rosters
      this.rooms.forEach(room => room.emit('reset'))
    })

    this.xmpp.on('offline', () => {
      this.logger.info(`Stoppping process: ${this.botName} is now offline.`)
    })

    await this.xmpp.start()
  }

  public async disconnect (): Promise<any> {
    for (const [roomId, room] of this.rooms) {
      this.logger.debug(`Leaving room ${roomId}...`)
      await room.stopHandlers()
      await room.part()
    }
    await this.xmpp.stop()
  }

  public async sendStanza (
    type: XMPPStanzaType,
    attrs: object,
    ...children: Node[]
  ): Promise<void> {
    attrs = Object.assign({
      from: this.address?.toString()
    }, attrs)

    const stanza = xml(type, attrs, ...children)
    this.logger.debug('stanza to emit: ' + stanza.toString())
    await this.xmpp.send(stanza)
  }

  public async joinRoom (local: string, domain: string, resource: string): Promise<Room> {
    const roomJID = new JID(local, domain)
    const roomJIDstr = roomJID.toString()
    let room: Room | undefined = this.rooms.get(roomJIDstr)
    if (!room) {
      room = new Room(this, roomJID)
      this.rooms.set(roomJIDstr, room)
    }
    this.logger.debug('Joining room ' + roomJID.toString())
    await room.join(resource)
    return room
  }

  public async partRoom (local: string, mucDomain: string): Promise<void> {
    const roomJID = new JID(local, mucDomain)
    const room = this.rooms.get(roomJID.toString())
    if (!room) {
      return
    }
    await room.part()
  }

  public getAddress (): JID | undefined {
    return this.address
  }
}
