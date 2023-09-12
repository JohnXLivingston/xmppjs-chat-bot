# xmppjs-chat-bot

This is a server-side XMPP chat bot, based on [xmpp.js](https://github.com/xmppjs/xmpp.js).
It is meant to be as modular as possible.

For now, the bot is meant to join chat rooms. It is not able to handle private messages.

Code is under [AGPL-v3 license](./LICENSE).

Please respect the [code of conduct](./CODE_OF_CONDUCT.md) for any contribution or interraction.

**Note:** it is still in beta version. API may change until version 1.0.0.
If you are using this bot, you can [open a discussion on github](https://github.com/JohnXLivingston/xmppjs-chat-bot/discussions),
to let me know you are using it. So I can try to not break your usages.

## Cli

You can run the bot using the CLI:

```bash
# install the bot:
mkdir xmppjs-chat-bot
cd xmppjs-chat-bot
npm install xmppjs-chat-bot
# then run it:
npx xmppjs-chat-bot run --file path/to/a/config/file.json --room-conf-dir path/to/a/room-conf/dir
# display available options:
npx xmppjs-chat-bot run --help
```

See below for the configuration files format.

## Quickstart

Here is an example written in typescript to use the bot in your code.

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
      const handlerHello = new HandlerHello('my_hello_handler', room)
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

## Configuration files

There are some file format that can be used to configure the bot.
These files can be loaded by using the appropriate CLI option, or in your code by using the relevant loading method.

### Global configuration files

Global configuration files are files containing some global options.
You can load one or more such files.

Each file will create one bot instance.

You can use multiple files, for example if you want to connect to multiple servers.

With the CLI: using the option `-f path.json` or `--file path.json`.
This option is required for the CLI. You can declare multiple files.

In your code:

```javascript
import { getBotFromConfig } from 'xmppjs-chat-bot'
const json = {...} // load your file content in the `json` var
const bot = await getBotFromConfig(json)
```

Here is the file format:

```json
{
  "type": "client",
  "connection": {
    "username": "bot",
    "password": "thepassw0rd"
  },
  "logger": "ColorConsoleLogger",
  "xmpp_debug": false,
  "log_level": "debug",
  "rooms": []
}
```

Where:

* `type`: `"client"` or `"component"`. The connection type. See [xmpp.js](https://github.com/xmppjs/xmpp.js) for more information.
* `connection`: connection options, as required by [xmpp.js](https://github.com/xmppjs/xmpp.js).
* `logger`: optionnal logger type. If none provided, nothing will be logged. You can choose `"ConsoleLogger"` to log in the console, or `"ColorConsoleLogger"` to log in console, with colors. For now, there is no other Logger type.
* `xmpp_debug`: optional, `true` or `false`. Enable the xmpp.js connection debug logs.
* `rooms`: optional. Rooms to join, with their configuration. This is an array of room configurations. Each array element has the same format as the room configuration files described bellow.

### Room configuration files and dir

For now the bot can't handle private messages, and can only join XMPP MUC rooms.

You can configure the bot room by room.

Room configuration can be in the global configuration files (under the `rooms` attribute), or in separate files.

You can make the bot listen for a whole directory.
The bot will try to load all `.json` files in this directory.
One room configuration by file.

The bot will then listen for changes in that directory.
If a file appears, it will automatically loaded.
If a file is modified, the bot will reload the content.

Note: for now, the bot is not able to handle file deletion.
If you want the bot to leave a room, change the `enabled` option in the file, don't delete it. Elsewhere the bot will still be in the room, until it is restarted.

Here is the file format:

```json
{
  "local": "8df24108-6e70-4fc8-b1cc-f2db7fcdd535",
  "domain": "muc.xmppserver.tld",
  "enabled": true,
  "nick": "The Bot",
  "handlers": []
}
```

Where:

* `local`: the local part of the room JID
* `domain`: the room MUC domain. The joined room Jabber ID will be `local@domain`
* `enabled`: optional, `true` or `false`. If `true`, the bot will join the room, else it will quit. If not present, will be considered `true`.
* `nick`: optional. The nickname to use in this room. If not present, will use the bot name.
* `handlers`: an array of handlers for this room. See below.

To load and listen a directory containing such files with the CLI: use the `--room-conf-dir path/to/dir` option.
You can load multiple directories.

To use it in sour code:

```javascript
await bot.loadRoomConfDir(dirPath1)
await bot.loadRoomConfDir(dirPath2) // you can add multiple folders
```

Note: don't put the global configuration file in this folder, it won't load.

As these files are automatically reloaded, you just have to edit the file to change the bot behaviour.
For example, if you want the bot to leave a room, just edit the file and set `enabled` to `false`.

### handlers configuration

The bot is composed of different handlers.

TODO: document this format
