import { streamCorti } from '../../lib/livi/corti'

export async function askLeafy(text, history = []) {
  const messages = [...history.slice(-6), { role: 'user', content: text }]
  return streamCorti({ messages, onDelta: () => {} })
}
