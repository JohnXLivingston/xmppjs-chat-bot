import { Handler, HandlerDerivedClass } from './handlers/abstract'
import { promises as fsPromises } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

let directory: HandlersDirectory | undefined

class HandlersDirectory {
  private readonly handlers: Map<string, HandlerDerivedClass>

  constructor () {
    this.handlers = new Map<string, HandlerDerivedClass>()
  }

  public static singleton (): HandlersDirectory {
    if (!directory) {
      directory = new HandlersDirectory()
    }
    return directory
  }

  public register (key: string, handlerDHandlerDerivedClass: HandlerDerivedClass): void {
    if (this.handlers.has(key)) {
      throw new Error('Handler ' + key + ' already exists')
    }
    this.handlers.set(key, handlerDHandlerDerivedClass)
  }

  public async registerFromFile (filePath: string): Promise<void> {
    filePath = pathResolve(filePath)
    const stat = await fsPromises.stat(filePath)
    if (!stat) {
      throw new Error(`File "${filePath}" does not exist`)
    }
    if (!stat.isFile()) {
      throw new Error(`"${filePath}" is not a file`)
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib = require(filePath)
    if (!('registerHandlers' in lib) || (typeof lib.registerHandlers !== 'function')) {
      throw new Error(`"${filePath} has no exported "registerHandlers" function`)
    }
    await lib.registerHandlers(this)
  }

  public getClass (key: string): HandlerDerivedClass | undefined {
    return this.handlers.get(key)
  }

  public get HandlerBaseClass (): typeof Handler {
    return Handler
  }
}

export {
  HandlersDirectory
}
