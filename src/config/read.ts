import { client, Client, Options as ClientOptions } from '@xmpp/client'
import { component, Component, Options as ComponentOptions } from '@xmpp/component'
import debug from '@xmpp/debug'
import { Bot } from '../bot'
import { ConsoleLogger } from '../logger'
import fs from 'fs'

interface ConfigHandler {
  id: string
  type: string
  enabled?: boolean
  options: any
}

interface RoomConf {
  local: string
  domain: string
  nick?: string
  enabled?: boolean
  handlers: ConfigHandler[]
}

interface ConfigBase {
  debug?: boolean
  name?: string
  logger?: 'ConsoleLogger'
  rooms?: RoomConf[]
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

/**
 * Loads a bot from a configuration object or file.
 * @param config: Configuration filepath, or configuration object
 */
async function getBotFromConfig (config: Config | string): Promise<Bot> {
  if (typeof config === 'string') {
    const filePath = config
    const content = await fs.promises.readFile(filePath, { encoding: 'utf8' })
    const json = JSON.parse(content)

    if (!json) {
      throw new Error(`File ${filePath} seems to be empty.`)
    }
    if (typeof json !== 'object') {
      throw new Error(`File ${filePath} dont seem to contain a json object`)
    }
    config = json
  } else {
    // To avoid side effect (because we later on merge some stuff in config), cloning config:
    config = JSON.parse(JSON.stringify(config))
  }
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
  if (!config.rooms) {
    return bot
  }
  try {
    if (!Array.isArray(config.rooms)) {
      throw new Error('The room entry must be an array')
    }
    for (const roomConfig of (config.rooms ?? [])) {
      if (!roomConfig.domain || !roomConfig.local) {
        throw new Error('Invalid room configuration')
      }
      // Now, merging global handlers into roomConfig.
      if (config.handlers && Array.isArray(config.handlers) && config.handlers.length) {
        roomConfig.handlers = config.handlers.concat(roomConfig.handlers)
      }
      await bot.loadRoomConf(roomConfig)
    }
  } catch (err) {
    console.error(err) // FIXME: don't use console.error
  }
  return bot
}

/**
 * Reads a JSON Room Configuration file, and returns a well formatted object
 * that can then be used to load or reload the room bot configuration.
 * @param filepath file path
 * @returns well formatted Room configuration object, or null if the file can't be loaded.
 */
async function readRoomConf (filepath: string): Promise<RoomConf | null> {
  try {
    const content = await fs.promises.readFile(filepath)
    const o = JSON.parse(content.toString())
    if (typeof o !== 'object') { return null }
    if (!('local' in o) || !o.local || (typeof o.local !== 'string')) { return null }
    const local = o.local

    const enabled = !!o.enabled
    const handlers: ConfigHandler[] = []
    let domain: string
    if (('domain' in o) && (typeof o.domain === 'string')) {
      domain = o.domain
    } else {
      throw new Error('Missing domain')
    }
    let nick: string | undefined
    if (('nick' in o) && (typeof o.nick === 'string')) {
      nick = o.nick
    }

    if (('handlers' in o) && Array.isArray(o.handlers)) {
      for (const h of o.handlers) {
        if (!('type' in h) || !(typeof h.type === 'string')) {
          continue
        }
        if (!('id' in h) || !(typeof h.id === 'string')) {
          continue
        }
        const handler: ConfigHandler = {
          id: h.id,
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
      local,
      domain,
      nick,
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
  RoomConf
}
