#!/usr/bin/env node
import type { Bot } from '../bot'
import { Command } from 'commander'
import { getBotFromConfig } from '../config/read'
import { HandlersDirectory } from '../handlers_directory'
import path from 'path'
import fs from 'fs'

const signals = ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM']

// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../../package.json').version

const program = new Command()
program
  .version(version, '-v --version')
  .usage('[command] [options]')
  .showHelpAfterError()

const runCommand = program.command('run')
runCommand.description('Read one or more config files and execute the corresponding bot.')
runCommand.requiredOption('-f, --file <files...>', 'one or more JSON files to parse')
runCommand.option('--room-conf-dir <directories...>', 'a directory containing room configuration JSON files')
runCommand.option(
  '--load-handlers <files...>',
  'one or more external handler to load. Files must be Javascript modules, ' +
  'exporting a "registerHandlers" function. See documentation for more information.'
)
runCommand.option('-d, --debug', 'force the use @xmpp/debug')
runCommand.option('-l, --log-level <level>', 'set the log level')
// runCommand.option('-r, --reload', 'auto reload the bots if file are changing')
runCommand.action(async (options) => {
  if (options.loadHandlers && options.loadHandlers.length > 0) {
    console.log('Loading additional handlers...')
    for (const handlersFilePath of options.loadHandlers) {
      await HandlersDirectory.singleton().registerFromFile(handlersFilePath)
    }
  }

  console.log('Loading config files...')
  const bots: Map<string, Bot> = new Map()

  // catching signals and do something before exit
  signals.forEach((sig) => {
    process.on(sig, () => {
      console.info('Receiving signal: ' + sig)
      console.info('Shutdown...')
      const promises: Array<Promise<any>> = []
      bots.forEach(bot => {
        console.info('Stopping the bot ' + bot.botName + '...')
        const p = new Promise<void>(resolve => {
          bot.disconnect().then(() => {}, (err) => {
            console.error(`Error when stopping the bot ${bot.botName}: ${err as string}`)
          }).finally(() => resolve())
        })
        promises.push(p)
      })
      bots.clear()

      console.info('Waiting all bots to disconnect...')
      Promise.all(promises).then(
        () => {},
        () => {}
      ).finally(() => {
        console.info('We can now exit.')
        process.exit()
      })

      // Just in case, we also set a max timeout
      setTimeout(() => {
        console.error('It seems the bots have not disconnected within 1000ms, exiting anyway.')
        process.exit(1)
      }, 1000)
    })
  })

  async function loadFile (filePath: string): Promise<void> {
    if (bots.has(filePath)) {
      console.info(`File ${filePath} is already loaded, unloading...`)
      const bot = bots.get(filePath)
      await bot?.disconnect()
      bots.delete(filePath)
    }
    if (!fs.existsSync(filePath)) {
      console.error(`File '${filePath} not found, skipping...`)
      return
    }
    try {
      const content = fs.readFileSync(filePath, { encoding: 'utf8' })
      const json = JSON.parse(content)

      if (!json) {
        console.error(`File ${filePath} seems to be empty.`)
        return
      }
      if (typeof json !== 'object') {
        console.error(`File ${filePath} dont seem to contain a json object`)
        return
      }

      if (options.debug) {
        json.debug = true
      }

      if (options.logLevel) {
        json.log_level = options.logLevel
      }

      const bot = await getBotFromConfig(json)
      bots.set(filePath, bot)
      // FIXME: listen for file change.
    } catch (err) {
      console.error(`Error loading the file ${filePath}: ${err as string}`)
    }
  }

  for (const file of (options.file) ?? []) {
    const filePath = path.resolve(file)
    await loadFile(filePath)
  }

  if (options.roomConfDir) {
    const dirs = Array.isArray(options.roomConfDir) ? options.roomConfDir : [options.roomConfDir]
    for (const dir of dirs) {
      bots.forEach(bot => {
        bot.waitOnline().then(
          () => {
            bot.loadRoomConfDir(dir).then(() => {}, (reason) => console.error(reason))
          },
          (reason) => console.error(reason)
        )
      })
    }
  }
})

program.parse(process.argv)
