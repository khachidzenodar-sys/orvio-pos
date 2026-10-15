'use client';
import {useState, type FormEvent} from 'react';

export function Login({onSignedIn}: {onSignedIn: () => Promise<void>}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault(); const form=event.currentTarget; const fields=new FormData(form);
  setBusy(true);setError('');
  try {
   const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fields.get('email'),password:fields.get('password')})});
   if(!response.ok){const body=await response.json();throw new Error(body.error||'შესვლა ვერ მოხერხდა');}
   form.reset();await onSignedIn();
  }catch(cause){setError(cause instanceof Error?cause.message:'სერვერთან დაკავშირება ვერ მოხერხდა');}
  finally{setBusy(false);}
 }
 return <main className="loginpage"><section className="logincard"><img src="/orvio-mark.svg" width="68" height="68" alt=""/><h1>ORVIO</h1><p className="loginsubtitle">RESTAURANT POS</p><h2>სამუშაო სივრცეში შესვლა</h2><p className="muted">შეიყვანეთ თქვენთვის შექმნილი ანგარიშის მონაცემები.</p><form onSubmit={submit}><label>ელფოსტა<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>პაროლი<input name="password" type="password" autoComplete="current-password" required maxLength={1024}/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'შედის…':'შესვლა'}</button></form><p className="muted">ანგარიშისთვის ან პაროლის აღსადგენად მიმართეთ მფლობელს.</p></section></main>;
}
