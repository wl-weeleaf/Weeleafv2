export function conversationPose(listening, speaking, thinking, questioning, engaged) {
  if (listening) return 'listening'
  if (speaking) return 'speaking'
  if (thinking) return 'thinking'
  if (questioning && engaged) return 'questioning'
  return engaged ? 'listening' : 'idle'
}
