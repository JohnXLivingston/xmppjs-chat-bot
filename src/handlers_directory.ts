import { HandlerDerivedClass } from './handlers/abstract'

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

  public getClass (key: string): HandlerDerivedClass | undefined {
    return this.handlers.get(key)
  }
}

export {
  HandlersDirectory
}
