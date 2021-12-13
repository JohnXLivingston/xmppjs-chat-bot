# xmppjs-chat-bot

This is a server-side XMPP chat bot, based on [xmpp.js](https://github.com/xmppjs/xmpp.js).

It is meant to be as modular as possible.

**Note:** it is still in alpha version. More to come...

## Quickart

Here is an example written in typescript.

```typescript
import { ConsoleLogger, Bot, HandlerHello } from 'xmppjs-chat-bot'
import { component } from '@xmpp/component'

const logger = new ConsoleLogger()
const runningBots: Bot[] = []

async function start (): Promise<void> {
  logger.info('Starting DemoBot...')

  const bot = new Bot(
    'DemoBot',
    component({
      service: 'xmpp://127.0.0.1:5347', // you must have a running XMPP server on localhost.
      domain: 'demobot.localhost', // Your XMPP server should have a «demobot» component
      password: 'xxxxxxx' // your component's password
    })
  )
  runningBots.push(bot)

  bot.connect().then(async () => {
    for (const roomId of ['6432f147-83c7-4fa3-b3b5-e49c2590e825']) {
      const room = await bot.joinRoom(roomId, 'room.localhost', 'DemoBot')

      // Create some handlers. Each handler provide some functionnalities.
      const handlerHello = new HandlerHello(room)
      // Then start the handlers.
      handlerHello.start()
    }
  }, (err) => {
    logger.error(err)
    process.exit(1)
  })
}

async function shutdown (): Promise<void> {
  logger.info('Shutdown...')
  for (const bot of runningBots) {
    logger.info('Stopping the bot ' + bot.botName + '...')
    await bot.disconnect()
  }
  process.exit(0)
}

// catching signals and do something before exit
['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach((sig) => {
  process.on(sig, () => {
    logger.debug('Receiving signal: ' + sig)
    shutdown().catch((err) => {
      logger.error(`Error on shutting down: ${err as string}`)
    })
  })
})

start().catch((err) => {
  logger.error(`Function start failed: ${err as string}`)
  process.exit(1)
})


```
