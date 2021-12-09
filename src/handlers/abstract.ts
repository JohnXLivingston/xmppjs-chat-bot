import type { Room } from '../room'
import type { Logger } from '../logger'
import { EventEmitter } from 'events'

export interface Handler {
  on: (event: 'room_joined', listener: (...args: any[]) => void) => this
}

export abstract class Handler extends EventEmitter {
  public readonly logger: Logger

  constructor (
    protected readonly room: Room
  ) {
    super()
    this.logger = room.logger
  }

  public abstract start (): void
  public abstract stop (): void
}
