import type { Node, Element } from '@xmpp/xml'
import type { XMPPElementType } from './stanza'
import type { RoomConf } from './config/read'
import { Stanza } from './stanza'
import Connection from '@xmpp/connection'
import { JID } from '@xmpp/jid'
import xml from '@xmpp/xml'
import { DefaultLogger, Logger, wrapLogger } from './logger'
import { Room } from './room'
import { listenRoomConfDir } from './config/listen'
import { HandlersDirectory } from './handlers_directory'

export class Bot {
  protected address?: JID
  public readonly logger: Logger
  protected rooms: Map<string, Room> = new Map()
  protected dirListeners: Map<string, () => void> = new Map<string, () => {}>()

  constructor (
    public readonly botName: string,
    protected readonly xmpp: Connection,
    logger?: Logger
  ) {
    this.logger = wrapLogger(botName, logger ?? new DefaultLogger())
  }

  public async connect (): Promise<void> {
    this.xmpp.on('error', (err: any) => {
      this.logger.error(err)
    })

    this.xmpp.on('offline', () => {
      this.logger.info(`${this.botName} is now offline.`)
    })

    this.xmpp.on('stanza', (xmppElement: Element) => {
      const stanza = Stanza.parseIncoming(xmppElement)
      if (!stanza) {
        this.logger.error('Failed to initiate a Stanza object from: ' + xmppElement.toString())
        return
      }
      this.logger.debug('stanza received: ' + stanza.toString())
      if (!stanza.from) { return }
      const roomJid = stanza.from.bare() // removing the «resource» part of the jid.
      const room = this.rooms.get(roomJid.toString())
      room?.receiveStanza(stanza)
    })

    this.xmpp.on('online', (address) => {
      this.logger.debug('Online with address ' + address.toString())

      this.address = address

      // 'online' is emitted at reconnection, so we must reset rooms rosters
      this.rooms.forEach(room => room.reset())
    })

    this.xmpp.on('offline', () => {
      this.logger.info(`Stoppping process: ${this.botName} is now offline.`)
    })

    await this.xmpp.start()
  }

  public async disconnect (): Promise<any> {
    for (const [dir, callback] of this.dirListeners) {
      this.logger.debug('Stop listening the configuration directory ' + dir)
      callback()
    }
    for (const [roomId, room] of this.rooms) {
      this.logger.debug(`Leaving room ${roomId}...`)
      await room.detachHandlers()
      await room.part()
    }
    await this.xmpp.stop()
  }

  public async sendStanza (
    type: XMPPElementType,
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

  public async joinRoom (local: string, domain: string, nick: string): Promise<Room> {
    const roomJID = new JID(local, domain)
    const roomJIDstr = roomJID.toString()
    let room: Room | undefined = this.rooms.get(roomJIDstr)
    if (!room) {
      room = new Room(this, roomJID)
      this.rooms.set(roomJIDstr, room)
    }
    this.logger.debug('Joining room ' + roomJID.toString())
    await room.join(nick)
    return room
  }

  public async partRoom (local: string, mucDomain: string): Promise<void> {
    const roomJID = (new JID(local, mucDomain)).toString()
    const room = this.rooms.get(roomJID)
    if (!room) {
      return
    }
    await room.detachHandlers()
    await room.part()
    this.rooms.delete(roomJID)
  }

  public getAddress (): JID | undefined {
    return this.address
  }

  /**
   * Load room configuration from a directory, and starts listening to file changes.
   * @param dir directory path
   */
  public async loadRoomConfDir (dir: string): Promise<void> {
    if (this.dirListeners.has(dir)) {
      this.logger.error('There is already a listener for the dir ' + dir)
      return
    }
    this.logger.info('Loading and listening conf directory ' + dir + '...')
    const w = await listenRoomConfDir(this, dir)
    if (w) {
      this.dirListeners.set(dir, w)
    } else {
      this.logger.error('Failed loading conf directory ' + dir)
    }
  }

  public async loadRoomConf (conf: RoomConf): Promise<void> {
    if (!conf) { return }

    this.logger.debug('Loading conf...')
    const enabled = conf.enabled ?? true
    const roomJID = (new JID(conf.local, conf.domain)).toString()

    if (!enabled) {
      // in case we are still in the room...
      if (this.rooms.has(roomJID)) {
        this.logger.debug('Room disabled, Must leave room ' + roomJID)
        await this.partRoom(conf.local, conf.domain)
      }
      return
    }

    if (!this.rooms.has(roomJID)) {
      this.logger.debug('Room enabled, Joining room ' + roomJID)
      await this.joinRoom(conf.local, conf.domain, conf.nick ?? this.botName)
    }
    const room = this.rooms.get(roomJID)
    if (!room) {
      this.logger.error('Failed getting the freshly joined room')
      return
    }

    // TODO: detect nick change, and change nick if required.

    for (const handlerConf of (conf.handlers ?? [])) {
      const loadedHandler = room.getHandlerById(handlerConf.id)
      const handlerEnabled = handlerConf.enabled ?? true
      if (loadedHandler) {
        if (handlerEnabled) {
          loadedHandler.loadOptions(handlerConf.options)
        } else {
          room.detachHandlerById(loadedHandler.id)
        }
        continue
      }

      if (!handlerEnabled) { continue }

      const HandlerClass = HandlersDirectory.singleton().getClass(handlerConf.type)
      if (!HandlerClass) {
        this.logger.error('Can\'t find class for handler type ' + handlerConf.type)
        continue
      }
      const handler = new HandlerClass(handlerConf.id, room, handlerConf.options)
      await handler.start()
    }
  }
}
