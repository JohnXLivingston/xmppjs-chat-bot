import type { Node, Element } from '@xmpp/xml'
import type { XMPPElementType } from './stanza'
import { getBotFromConfig, type RoomConf } from './config/read'
import { Stanza } from './stanza'
import Connection from '@xmpp/connection'
import { JID } from '@xmpp/jid'
import xml from '@xmpp/xml'
import { DefaultLogger, Logger, wrapLogger } from './logger'
import { Room } from './room'
import { listenRoomConfDir } from './config/listen'
import { HandlersDirectory } from './handlers_directory'

export class Bot {
  public readonly botName: string
  protected readonly xmpp: Connection
  protected address?: JID
  public readonly logger: Logger
  protected rooms: Map<string, Room> = new Map()
  protected dirListeners: Map<string, () => void> = new Map<string, () => {}>()

  constructor (
    botName: string,
    xmpp: Connection,
    logger?: Logger
  ) {
    this.botName = botName
    this.xmpp = xmpp
    this.logger = wrapLogger(botName, logger ?? new DefaultLogger())
  }

  /**
   * Creates a bot from a configuration file.
   * Can throw an error if the configuration file is not correct.
   * @param filepath configuration file path
   * @returns a bot
   */
  public static async loadsFromConfigFile (filepath: string): Promise<Bot> {
    const bot = await getBotFromConfig(filepath)
    return bot
  }

  /**
   * Start the connection process.
   */
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

  /**
   * Stops all handlers, leave all rooms, and disconnect the bot.
   */
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

  /**
   * Joins a MUC room.
   * @param local local part of the room JID
   * @param domain MUC domain
   * @param nick Nickname to use
   * @returns the room object
   */
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

  /**
   * Detach all hanlders, and leaves a room.
   * @param local local part of the room JID
   * @param mucDomain MUC domain
   * @returns void
   */
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

  /**
   * Get the bot JID.
   * @returns the bot JID
   */
  public getAddress (): JID | undefined {
    return this.address
  }

  /**
   * Load room configuration from a directory,
   * and starts listening to file changes (and reload configuration if needed).
   * @param dir directory path
   */
  public async loadRoomConfDir (dir: string): Promise<void> {
    if (this.dirListeners.has(dir)) {
      this.logger.error('There is already a listener for the dir ' + dir)
      return
    }
    this.logger.info('Loading and listening conf directory ' + dir + '...')
    const w = await listenRoomConfDir(this.logger, dir, async (conf) => {
      await this.loadRoomConf(conf)
    })
    if (w) {
      this.dirListeners.set(dir, w)
    } else {
      this.logger.error('Failed loading conf directory ' + dir)
    }
  }

  /**
   * Loads a room configuration from a configuration object.
   * Create or updates all handlers mentionned in the configuration.
   * @param conf room configuration
   * @returns void
   */
  public async loadRoomConf (conf: RoomConf): Promise<void> {
    if (!conf) { return }

    this.logger.debug('Loading conf...')
    const enabled = !!(conf.enabled ?? true)
    const roomJID = (new JID(conf.local, conf.domain)).toString()

    if (!enabled) {
      this.logger.debug('Room ' + roomJID + 'is disabled')
      // in case we are still in the room...
      if (this.rooms.has(roomJID)) {
        this.logger.debug('Room ' + roomJID + ' disabled, Must leave room ' + roomJID)
        await this.partRoom(conf.local, conf.domain)
      } else {
        this.logger.debug('Room ' + roomJID + ' was not loaded')
      }
      return
    }

    this.logger.debug('Room ' + roomJID + 'is enabled')

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
      const handlerEnabled = !!(handlerConf.enabled ?? true)
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
