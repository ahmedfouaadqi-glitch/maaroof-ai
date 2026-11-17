import type {ReactNode} from "react";
type Props={open:boolean;title:string;html:string;onClose:()=>void;children?:ReactNode};
export function ReportPreviewModal({open,title,html,onClose,children}:Props){
 if(!open)return null;
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="report-preview-title" className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
   <header className="flex items-center justify-between gap-3 border-b p-3"><h2 id="report-preview-title" className="font-semibold">{title}</h2><div className="flex items-center gap-2">{children}<button type="button" className="rounded-md border px-3 py-1.5" onClick={onClose}>Close</button></div></header>
   <iframe title={title} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" className="min-h-0 flex-1 bg-white"/>
  </section>
 </div>;
}
