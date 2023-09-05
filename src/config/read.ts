import { client, Client, Options as ClientOptions } from '@xmpp/client'
import { component, Component, Options as ComponentOptions } from '@xmpp/component'
import debug from '@xmpp/debug'
import { Bot } from '../bot'
import { ConsoleLogger, ColorConsoleLogger, DefaultLogger, Logger, wrapLogger } from '../logger'
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
  } else if (config.logger === 'ColorConsoleLogger') {
    logger = new ColorConsoleLogger()
  }
  logger ??= new DefaultLogger()

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
      const cleanedRoomConfig = await readRoomConf(roomConfig, logger)
      if (!cleanedRoomConfig) {
        throw new Error('Invalid room configuration')
      }
      // Now, merging global handlers into roomConfig.
      if (config.handlers && Array.isArray(config.handlers) && config.handlers.length) {
        cleanedRoomConfig.handlers = config.handlers.concat(cleanedRoomConfig.handlers)
      }
      await bot.loadRoomConf(cleanedRoomConfig)
    }
  } catch (err) {
    logger.error(err as string)
  }
  return bot
}

/**
 * Reads and clean a JSON Room Configuration file, and returns a well formatted object
 * that can then be used to load or reload the room bot configuration.
 * @param config file path or config object
 * @returns well formatted Room configuration object, or null if the file can't be loaded.
 */
async function readRoomConf (config: string | any, logger?: Logger): Promise<RoomConf | null> {
  logger ??= new DefaultLogger()
  logger = wrapLogger('readRoomConf', logger)
  try {
    let o: any
    if (typeof config === 'string') {
      const content = await fs.promises.readFile(config)
      o = JSON.parse(content.toString())
    } else {
      o = config
    }
    if (typeof o !== 'object') {
      logger.error('Config parameter is not an object, can\'t load.')
      return null
    }
    if (!('local' in o) || !o.local || (typeof o.local !== 'string')) {
      logger.error('Missing local attribute')
      return null
    }
    const local = o.local
    if (!('domain' in o) || !(typeof o.domain === 'string')) {
      logger.error('Missing domain attribute')
      return null
    }
    const domain = o.domain

    const enabled = !!(o.enabled ?? true)
    const handlers: ConfigHandler[] = []
    let nick: string | undefined
    if (('nick' in o) && (typeof o.nick === 'string')) {
      nick = o.nick
    }

    if (('handlers' in o) && Array.isArray(o.handlers)) {
      for (const h of o.handlers) {
        if (!('type' in h) || !(typeof h.type === 'string')) {
          logger.error('Missing type attribute for handler configuration')
          continue
        }
        if (!('id' in h) || !(typeof h.id === 'string')) {
          logger.error('Missing id attribute for handler configuration')
          continue
        }
        const handlerEnabled = !!(h.enabled ?? true)
        const handler: ConfigHandler = {
          id: h.id,
          enabled: handlerEnabled,
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
    logger.error(err as string)
    return null
  }
}

export {
  getBotFromConfig,
  readRoomConf,
  RoomConf
}
