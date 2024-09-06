# xmppjs-chat-bot

This is a server-side XMPP chat bot, based on [xmpp.js](https://github.com/xmppjs/xmpp.js).
It is meant to be as modular as possible.

For now, the bot is meant to join chat rooms. It is not able to handle private messages.

Code is under [AGPL-v3 license](./LICENSE).

Please respect the [code of conduct](./CODE_OF_CONDUCT.md) for any contribution or interraction.

**Note:** it is still in beta version. API may change until version 1.0.0.
If you are using this bot, you can [open a discussion on github](https://github.com/JohnXLivingston/xmppjs-chat-bot/discussions),
to let me know you are using it. So I can try to not break your usages.

This bot was originally created to be part of the [Peertube livechat](https://github.com/JohnXLivingston/peertube-plugin-livechat/) project.

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

The bot automatically start connecting when the configuration file is loaded.

Each file will create one bot instance.

You can use multiple files, for example if you want to connect to multiple servers.

With the CLI: using the option `-f path.json` or `--file path.json`.
This option is required for the CLI. You can declare multiple files.

In your code:

```javascript
import { getBotFromConfig } from 'xmppjs-chat-bot'
const json = {...} // load your file content in the `json` var
const bot = await getBotFromConfig(json)

// If you have to load other handler, or want to do specific actions,
// you can wait the bot to be connected using:
await bot.waitOnline()
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

A handler is a javascript class that is meant to handle one type of interraction.
It can listen events (for example to respond to messages), send messages, do moderation actions, ...

In room configuration files, you can attach one or more handler to a room.

Here is the handler configuration format:

```json
{
  "type": "quotes",
  "id": "quotator",
  "enabled": true,
  "options": {}
}
```

Where:

* `type` is the handler type. Each handler javascript class register itself with a type. For example the `"quotes"` handler can send some quotes at regular interval. See bellow for a list of builtin handlers, or how you can add your handlers.
* `id`: a unique name for the handler instance in the room. This id is used when relaoding the configuration after a file change, to match loaded handler with the configuration one. You can use any string, but it must be unique per room.
* `enabled`: optional, `true` or `false`. If `true`, the bot will load and start this handler, else it will be ignored or stopped. If not present, will be considered `true`.
* `options`: optional. Handler specific options (see handler's documentation)

## Builtin handlers

Existing handlers source code is in the `src/handlers` folder.

Each handler has options. These options are usually optionals, and default values are implemented.

### Hello

Handler that can send a message each time a user join's a room.

Type name (to use in configuration files): `hello`.

Options:

* `txt`: the message to send. The placeholder `{{NICK}}` will be replaced by the joining user's nickname
* `delay`: if not undefined, won't send message for users that were already here the last `delay` seconds.

### Moderate

Handler that can delete messages containing forbidden patterns.

Type name (to use in configuration files): `moderate`.

Options:

* `rules`: one ore more moderation rules
* `applyToModerators`: by default, moderator's messages will not be moderated, unless you set this option to true

A moderation rule can be:

* a string: it will be converted to a RegExp object (regular expression), with a `/i` modifier.
* a single RegExp object
* an mixed array of string,RegExp or "rule definition"

A "rule definition" is an object like:

```javascript
{
  name: "the_rule_name",
  regexp: /^forbidden$/,
  reason: "The optional text to display when a message is deleted"
},
{
  name: "the_rule_name",
  regexp: "^forbidden$", // will give /^forbidden$/i
  reason: "The optional text to display when a message is deleted"
},
{
  name: "the_rule_name",
  regexp: "^forbidden$",
  modifiers: "imu", // you can specify modifiers
  reason: "The optional text to display when a message is deleted"
},

```

### Quotes and Random Quotes

These handlers can send messages in a room at some time interval.
The "Quotes" handler send them in the definition order (and loops when all messages were sent), and the "Random Quotes" handler sends them randomly.

Type name (to use in configuration files): `quotes` and `quotes_random`.

Options:

* `quotes`: an array of strings (messages to send)
* `delay`: a number representing the delay between two messages, in seconds (by default 10 seconds)

Example:

```javascript
{
  "quotes": [
    "🎵🎶",
    "🎵🎶 I'm just a bot, I'm just a bot in the world. 🎵🎶"
  ],
  "delay": 60 * 5 // 5 minutes
}
```

### Respond

This handler can send a message to the room when a user mentions the bot.

Type name (to use in configuration files): `respond`

Options:

* `txt`: the text to respond with. You can use the `{{NICK}}` placeholder to insert the user's nickname.

### Commands

Commands handlers are handlers meant to respond to a command.
A command is a message starting with a `!`. The command name is the string just after the `!`. A command can have parameters, separated by spaces.

For example, in `!the_command x@muc.domain.tld 10`:

* the command name is `the_command`
* the command parameters are `x@muc.domain.tld` and `10`

All command handler have these options:

* `command`: a string, or array of string, with the command_name this handler must listen to

#### Say Command

The "Say" command handler can send a message when it's command is used.

For example, you can setup this handler to respond to `!help`.

Type name (to use in configuration files): `command_say`.

Options:

* `command`: a string, or array of string, with the command_name this handler must listen to
* `quotes`: a string, or list of string representing the messages to send when the command is called

If there are multiple quotes, a quote will be picked randomly each time.

## Adding your own handler

### In custom code

To implement your own handler, just create a javascript class that inherits and implements abstract class `Handler`.

Then you can register this class, so it can be loaded from a configuration file, using `HandlersDirectory.singleton().register('your_handler_type', YourHandlerClass)`.

Note: for now you can't use custom handlers with the CLI, you have to write your own code.

Example:

```javascript
import { Handler, HandlersDirectory } from 'xmppjs-chat-bot'

class MyHandler extends Handler {
  /* implement the abstract class */
}

HandlersDirectory.singleton().register('my_handler', MyHandler)
```

Note: the documentation for how a handler can be implemented (existing events and methods) is not written yet. Just check existing handlers code.

### Loading handlers from an external Javascript file

You can also write a Javascript module that exports a `registerHandlers` function, taking the `handlersDirectory` singleton object as argument.
Then call `handlersDirectory.registerFromFile(filePath)` to load your extra code.

Here is an example of such javascript file:

```javascript
async function registerHandlers (directory) {
  class MyHandler extends directory.HandlerBaseClass {
    constructor () {
      super(...arguments)
      // add some custom code
    }
    loadOptions (options) {}
    start () {
      // add some custom code
    }
    stop () {
      // add some custom code
    }
  }

  directory.register('my_handler', MyHandler)
}

exports.registerHandlers = registerHandlers
```

Note: as a conveniance, you can use `directory.HandlerBaseClass` to get the base class for handlers. So you don't have to import xmppjs-chat-bot in your custom file (which could make some trouble if your javascript file is not in the correct folder).
If you don't use the `directory` object to make your imports, just be sure that the used xmppjs-chat-bot lib will be the same as the running code.

**Important note**: don't load files that you don't trust. Don't load files that are writable by untrusted users. Otherwise, you can execute some evil code.

There is an option to load handlers from files when you are using the CLI:

```bash
npx xmppjs-chat-bot run --load-handlers path/to/a/javascript/file.js
```

For now, there is no way to load handlers from configuration file. It could be a security issue, if you don't set correct write rights on your configuration files.

## Troubleshooting

### Self-signed certificates

If your XMPP server uses self-signed certificates, you have to set the following env var: `NODE_TLS_REJECT_UNAUTHORIZED=0`.
See [https://github.com/xmppjs/xmpp.js/issues/598](https://github.com/xmppjs/xmpp.js/iss
ues/598).
