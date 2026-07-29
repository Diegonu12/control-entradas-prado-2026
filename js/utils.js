export const $ = id => document.getElementById(id);
export function hoyISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export function fechaLocal(d=new Date()){return {fechaEntrega:hoyISO(),horaEntrega:d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})};}
export function formatDate(iso){const p=String(iso||"").split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:(iso||"—");}
export function normNumber(v){return String(v||"").trim().toUpperCase().replace(/\s+/g,"");}
export function normClient(v){return String(v||"").trim().toLocaleLowerCase("es").replace(/\s+/g," ");}
export function docIdForNumber(v){return encodeURIComponent(normNumber(v));}
export function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
export function downloadText(filename,text,type="text/plain"){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
export function errorMessage(err){const c=err?.code||"";if(c.includes("auth/invalid-credential"))return "Correo o contraseña incorrectos.";if(c.includes("auth/too-many-requests"))return "Demasiados intentos. Esperá unos minutos.";if(c.includes("permission-denied"))return "Firebase rechazó la operación. Revisá las reglas de Firestore.";if(c.includes("unavailable"))return "No hay conexión con Firebase.";return "Ocurrió un error. Revisá la consola del navegador.";}
