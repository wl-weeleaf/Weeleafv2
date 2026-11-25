const TOKEN=/\s*(?:(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?|[()+\-*/^%])/y;

/** Evaluate bounded arithmetic without eval or executing model supplied code. */
export function calculateExpression(source:string){
 if(typeof source!=='string'||!source.trim()||source.length>240)throw new Error('Indtast et regneudtryk på højst 240 tegn.');
 const input=source.trim().replace(/[×]/g,'*').replace(/[÷]/g,'/').replace(/[−–]/g,'-'),tokens:string[]=[];let offset=0;
 while(offset<input.length){TOKEN.lastIndex=offset;const match=TOKEN.exec(input);if(!match)throw new Error('Brug kun tal, parenteser og regnetegnene +, −, ×, ÷, %, ^. Skriv decimaler med punktum eller komma.');tokens.push(match[0].trim());offset=TOKEN.lastIndex;if(tokens.length>100)throw new Error('Regneudtrykket indeholder for mange led.');}
 let index=0,depth=0;
 const peek=()=>tokens[index],take=()=>tokens[index++];
 const finite=(value:number)=>{if(!Number.isFinite(value)||Math.abs(value)>1e100)throw new Error('Resultatet ligger uden for det sikre beregningsområde.');return Object.is(value,-0)?0:value;};
 const primary=():number=>{
  const token=take();if(token==='('){if(++depth>24)throw new Error('Der er for mange indlejrede parenteser.');const value=expression();if(take()!==')')throw new Error('Der mangler en afsluttende parentes.');depth--;return value;}
  if(!token||!/^\d/.test(token)&&!/^\.\d/.test(token)&&!/^,\d/.test(token))throw new Error('Forventede et tal eller en parentes.');
  const value=Number(token.replace(',','.'));if(!Number.isFinite(value))throw new Error('Tallet kan ikke beregnes.');return value;
 };
 const power=():number=>{const left=primary();return peek()==='^'?(take(),finite(left**unary())):left;};
 const unary=():number=>peek()==='+'?(take(),unary()):peek()==='-'?(take(),finite(-unary())):power();
 const term=():number=>{let value=unary();while(['*','/','%'].includes(peek()||'')){const op=take(),right=unary();if((op==='/'||op==='%')&&right===0)throw new Error('Du kan ikke dividere med nul.');value=finite(op==='*'?value*right:op==='/'?value/right:value%right);}return value;};
 const expression=():number=>{let value=term();while(peek()==='+'||peek()==='-'){const op=take(),right=term();value=finite(op==='+'?value+right:value-right);}return value;};
 const value=expression();if(index!==tokens.length)throw new Error('Regneudtrykket indeholder et uventet tegn eller en ubalanceret parentes.');
 const formatted=new Intl.NumberFormat('da-DK',{maximumSignificantDigits:12}).format(value);
 return {expression:source.trim(),value,formatted};
}
