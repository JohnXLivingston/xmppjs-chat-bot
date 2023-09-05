#!/usr/bin/env node
import type { Bot } from '../bot'
import { Command } from 'commander'
import { getBotFromConfig } from '../config/read'
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
runCommand.option('-d, --debug', 'force the use @xmpp/debug')
runCommand.option('-l, --log-level <level>', 'set the log level')
// runCommand.option('-r, --reload', 'auto reload the bots if file are changing')
runCommand.action(async (options) => {
  console.log('Loading config files...')
  const bots: Map<string, Bot> = new Map()

  // catching signals and do something before exit
  signals.forEach((sig) => {
    process.on(sig, () => {
      console.info('Receiving signal: ' + sig)
      console.info('Shutdown...')
      bots.forEach(bot => {
        console.info('Stopping the bot ' + bot.botName + '...')
        bot.disconnect().then(() => {}, (err) => {
          console.error(`Error when stopping the bot ${bot.botName}: ${err as string}`)
        })
      })
      bots.clear()
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

      if (options['log-level']) {
        json.log_level = options['log-level']
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
})

program.parse(process.argv)
