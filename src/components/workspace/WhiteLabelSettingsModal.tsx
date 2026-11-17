import {useEffect,useState} from "react";
export type WhiteLabelFormValue={workspaceId:string;companyName:string;logoUrl:string;brandColor:string;advisorName:string;advisorTitle:string};
type Props={open:boolean;workspaceId:string;initial?:Partial<WhiteLabelFormValue>;onSave:(value:WhiteLabelFormValue)=>void;onClose:()=>void};
export function WhiteLabelSettingsModal({open,workspaceId,initial,onSave,onClose}:Props){
 const [value,setValue]=useState<WhiteLabelFormValue>({workspaceId,companyName:"",logoUrl:"",brandColor:"#214b46",advisorName:"",advisorTitle:""});
 useEffect(()=>{setValue({workspaceId,companyName:initial?.companyName||"",logoUrl:initial?.logoUrl||"",brandColor:initial?.brandColor||"#214b46",advisorName:initial?.advisorName||"",advisorTitle:initial?.advisorTitle||""});},[workspaceId,initial,open]);
 if(!open)return null;
 const update=(key:keyof WhiteLabelFormValue,next:string)=>setValue(v=>({...v,[key]:next}));
 const validColor=/^#[0-9a-fA-F]{6}$/.test(value.brandColor);
 const validLogo=!value.logoUrl||/^https:\/\//i.test(value.logoUrl);
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"><section role="dialog" aria-modal="true" aria-labelledby="white-label-title" className="w-full max-w-xl space-y-4 rounded-2xl border bg-background p-5 shadow-2xl">
  <header><h2 id="white-label-title" className="text-lg font-semibold">White-label settings</h2><p className="text-sm text-muted-foreground">Settings apply only to the selected workspace.</p></header>
  <label className="block text-sm">Client / company name<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={value.companyName} onChange={e=>update("companyName",e.target.value)}/></label>
  <label className="block text-sm">Logo URL (HTTPS)<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={value.logoUrl} onChange={e=>update("logoUrl",e.target.value)} placeholder="https://…"/></label>
  <label className="block text-sm">Brand color<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={value.brandColor} onChange={e=>update("brandColor",e.target.value)}/></label>
  <label className="block text-sm">Advisor name<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={value.advisorName} onChange={e=>update("advisorName",e.target.value)}/></label>
  <label className="block text-sm">Advisor title<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={value.advisorTitle} onChange={e=>update("advisorTitle",e.target.value)}/></label>
  {(!validColor||!validLogo)&&<p role="alert" className="text-sm text-destructive">Use a six-digit hex color and an HTTPS logo URL.</p>}
  <footer className="flex justify-end gap-2"><button className="rounded-lg border px-3 py-2" onClick={onClose}>Cancel</button><button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={!value.companyName.trim()||!validColor||!validLogo} onClick={()=>onSave(value)}>Save settings</button></footer>
 </section></div>;
}
