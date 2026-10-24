import {invoke} from '@tauri-apps/api/core';

// The only module that imports the Tauri API. Other adapters take an Invoke
// so they stay testable in Node with a fake.
export type Invoke = <T>(cmd:string,args?:Record<string,unknown>)=>Promise<T>;
export const tauriInvoke:Invoke = (cmd,args) => invoke(cmd,args);
