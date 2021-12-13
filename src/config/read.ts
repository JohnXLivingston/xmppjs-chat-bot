import { client, Client, Options as ClientOptions } from '@xmpp/client'
import { component, Component, Options as ComponentOptions } from '@xmpp/component'
import debug from '@xmpp/debug'
import { Bot } from '../bot'
import { Handler, HandlerHello, HandlerRespond, HandlerQuotes, HandlerRandomQuotes } from '../handlers'
import { ConsoleLogger } from '../logger'
import { Room } from '../room'

interface ConfigHandlerHello {
  type: 'hello'
  txt?: string
  delay?: number
}

interface ConfigHandlerRespond {
  type: 'respond'
  txt?: string
}

interface ConfigHandlerQuotes {
  type: 'quotes' | 'quotes_random'
  quotes?: string[]
  delay?: number
}

type ConfigHandler = ConfigHandlerHello | ConfigHandlerRespond | ConfigHandlerQuotes

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
  switch (handler.type) {
    case 'hello':
      return new HandlerHello(room, handler.txt, handler.delay)
    case 'respond':
      return new HandlerRespond(room, handler.txt)
    case 'quotes':
      return new HandlerQuotes(room, handler.quotes ?? [], handler.delay)
    case 'quotes_random':
      return new HandlerRandomQuotes(room, handler.quotes ?? [], handler.delay)
  }
  console.error(`Unknown handler type '${(handler as any).type as string}`)
  return undefined
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
    console.error(err)
  }
  return bot
}

export {
  getBotFromConfig
}
