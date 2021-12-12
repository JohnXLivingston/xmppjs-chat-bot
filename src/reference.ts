import type { JID } from '@xmpp/jid'
import type { Node } from '@xmpp/xml'
import xml from '@xmpp/xml'

abstract class Reference {
  public abstract readonly type: string

  public abstract toXml (): Node
}

class ReferenceMention extends Reference {
  public readonly type = 'mention'

  constructor (
    protected readonly jid: JID,
    protected readonly begin: number,
    protected readonly end: number
  ) {
    super()
  }

  public toXml (): Node {
    return xml(
      'reference',
      {
        xmlns: 'urn:xmpp:reference:0',
        begin: this.begin.toString(),
        end: this.end.toString(),
        type: this.type,
        uri: 'xmpp:' + this.jid.toString()
      }
    )
  }
}

export {
  Reference,
  ReferenceMention
}
