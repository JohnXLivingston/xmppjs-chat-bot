import { client, Client, Options as ClientOptions } from '@xmpp/client'
import { component, Component, Options as ComponentOptions } from '@xmpp/component'
import debug from '@xmpp/debug'
import { Bot } from '../bot'
import { Handler } from '../handlers'
import { ConsoleLogger } from '../logger'
import { Room } from '../room'
import { HandlersDirectory } from '../handlers_directory'
import fs from 'fs'

interface ConfigHandler {
  type: string
  options: any
}

interface ConfigBase {
  debug?: boolean
  name?: string
  logger?: 'ConsoleLogger'
  rooms?: Array<{
    local?: string
    domain?: string
    handlers?: ConfigHandler[]
  }>
  handlers?: ConfigHandler[]
}

interface ConfigClient extends ConfigBase {
  type: 'client'
  connection: ClientOptions
}

interface ConfigComponent extends ConfigBase {
  type: 'component'
  connection: ComponentOptions
}

type Config = ConfigClient | ConfigComponent

async function loadHandler (room: Room, handler: ConfigHandler): Promise<Handler | undefined> {
  const HandlerClass = HandlersDirectory.singleton().getClass(handler.type)
  if (!HandlerClass) {
    // FIXME: don't use console.error...
    console.error(`Unknown handler type '${(handler as any).type as string}`)
    return undefined
  }
  return new HandlerClass(room, handler.options)
}

async function getBotFromConfig (config: Config): Promise<Bot> {
  if (!config) {
    throw new Error('Missing config')
  }
  if (typeof config !== 'object') {
    throw new Error('Config invalid. Should be an object.')
  }
  let connection: Client | Component
  if (config.type === 'client') {
    connection = client(config.connection)
  } else if (config.type === 'component') {
    connection = component(config.connection)
  } else {
    throw new Error(`Invalid type '${(config as any).type as string}'`)
  }

  if (config.debug) {
    debug(connection, true)
  }

  let logger
  if (config.logger === 'ConsoleLogger') {
    logger = new ConsoleLogger()
  }

  const bot = new Bot(config.name ?? 'Bot', connection, logger)
  await bot.connect()
  try {
    if (!Array.isArray(config.rooms)) {
      throw new Error('The room entry must be an array')
    }
    for (const roomConfig of (config.rooms ?? [])) {
      if (!roomConfig.domain || !roomConfig.local) {
        throw new Error('Invalid room configuration')
      }
      const room = await bot.joinRoom(roomConfig.local, roomConfig.domain, bot.botName)
      for (const handler of (config.handlers ?? [])) {
        const h = await loadHandler(room, handler)
        if (h) { await h.start() }
      }
      for (const handler of (roomConfig.handlers ?? [])) {
        const h = await loadHandler(room, handler)
        if (h) { await h.start() }
      }
    }
  } catch (err) {
    console.error(err) // FIXME: don't use console.error
  }
  return bot
}

interface RoomConf {
  room: string
  nick: string
  domain: string
  enabled: boolean
  handlers: ConfigHandler[]
}

interface RoomConfDefault {
  domain?: string
  nick?: string
}

/**
 * Reads a JSON Room Configuration file, and returns a well formatted object
 * that can then be used to load or reload the room bot configuration.
 * @param filepath file path
 * @param defaults the defaults values
 * @returns well formatted Room configuration object, or null if the file can't be loaded.
 */
async function readRoomConf (filepath: string, defaults?: RoomConfDefault): Promise<RoomConf | null> {
  try {
    const content = await fs.promises.readFile(filepath)
    const o = JSON.parse(content.toString())
    if (typeof o !== 'object') { return null }
    if (!('room' in o) || !o.room || (typeof o.room !== 'string')) { return null }
    const room = o.room
    const enabled = !!o.enabled
    const handlers: ConfigHandler[] = []
    let domain: string
    if (('domain' in o) && (typeof o.domain === 'string')) {
      domain = o.domain
    } else if (defaults?.domain) {
      domain = defaults?.domain
    } else {
      throw new Error('Missing domain')
    }
    let nick: string
    if (('nick' in o) && (typeof o.nick === 'string')) {
      nick = o.nick
    } else if (defaults?.nick) {
      nick = defaults?.nick
    } else {
      throw new Error('Missing nick')
    }

    if (('handlers' in o) && Array.isArray(o.handlers)) {
      for (const h of o.handlers) {
        if (!('type' in h) || !(typeof h.type === 'string')) {
          continue
        }
        const handler: ConfigHandler = {
          type: h.type,
          options: {}
        }
        if ('options' in h) {
          handler.options = h.options
        }
        handlers.push(handler)
      }
    }

    return {
      room,
      nick,
      domain,
      enabled,
      handlers
    }
  } catch (err) {
    // FIXME: what is the proper way to log? not console.log...
    return null
  }
}

export {
  getBotFromConfig,
  readRoomConf,
  RoomConf,
  RoomConfDefault
}
