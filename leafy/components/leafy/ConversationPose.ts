export type ConversationPose='idle'|'listening'|'thinking'|'speaking'|'questioning';
export function conversationPose(listening:boolean,speaking:boolean,thinking:boolean,questioning:boolean,engaged:boolean):ConversationPose{
 if(listening)return 'listening';if(speaking)return 'speaking';if(thinking)return 'thinking';if(questioning&&engaged)return 'questioning';return engaged?'listening':'idle';
}
