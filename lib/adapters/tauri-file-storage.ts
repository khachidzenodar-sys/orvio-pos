import type {KeyValueStore} from '../ports/storage';
import type {Invoke} from './tauri-invoke';

// Files in the app data folder, written atomically by src-tauri/src/storage.rs.
export function createTauriFileStorage(invoke:Invoke):KeyValueStore {
 return {
  getItem:key=>invoke<string|null>('storage_read',{key}),
  setItem:async(key,value)=>{await invoke<null>('storage_write',{key,value});},
 };
}
