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

  public static mention (
    txt: string,
    jid: JID,
    placeholder: string = '{{NICK}}'
  ): { txt: string, references: ReferenceMention[]} {
    const references: ReferenceMention[] = []
    const nick = jid.getResource()

    if (!placeholder.length) {
      // hum... thats dangerous...
      return {
        txt,
        references
      }
    }

    const parts: string[] = txt.split(placeholder)
    txt = ''
    while (parts.length) {
      txt += parts.shift() ?? ''

      // as long as we are not on the last part...
      if (parts.length > 0) {
        const begin = txt.length
        const end = begin + nick.length
        txt += nick
        references.push(new ReferenceMention(jid, begin, end))
      }
    }

    return {
      txt,
      references
    }
  }
}

export {
  Reference,
  ReferenceMention
}
