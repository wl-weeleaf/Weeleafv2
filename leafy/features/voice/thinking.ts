/** Short acknowledgements only: never claim a search or tool succeeded. */
export function thinkingPhrase(question:string,index=0){
 if(/tidligere|før|sidst|husker|samtale|historik/i.test(question))return 'Jeg samler lige tråden.';
 if(/forskel|sammenlign|fordel|ulempe|vurdér|vurder/i.test(question))return 'Godt, jeg vejer det lige op.';
 if(/hvordan|forklar|hvorfor/i.test(question))return 'Godt spørgsmål. Jeg tænker lige.';
 return ['Aha, jeg er med.','Okay, jeg tænker lige.','Hmm, jeg ser på det.'][index%3];
}
