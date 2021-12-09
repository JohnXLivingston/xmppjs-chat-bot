import type { Room } from '../room'

export abstract class Handler {
  constructor (
    protected readonly room: Room
  ) {
    this.init()
  }

  protected abstract init (): void
  public abstract stop (): void
}
