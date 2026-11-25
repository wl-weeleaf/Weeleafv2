/** Show an actionable API error; never expose returned HTML or submitted credentials. */
export async function readApiJSON<T>(response:Response):Promise<T>{
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error(`Leafys server returnerede ikke JSON (HTTP ${response.status}). Genindlæs appen og prøv igen. Din nøgle er endnu ikke gemt.`);
 try{return await response.json() as T;}catch{throw Error('Leafys server returnerede et ugyldigt svar. Din nøgle er endnu ikke gemt. Prøv igen.');}
}
