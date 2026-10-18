import type {BackupFiles} from '../ports/backup-files';
import type {Invoke} from './tauri-invoke';

// Native Save/Open dialogs, opened by src-tauri/src/backup.rs.
export function createTauriBackupFiles(invoke:Invoke):BackupFiles {
 return {
  save:(defaultName,contents)=>invoke<boolean>('backup_save',{defaultName,contents}),
  open:()=>invoke<string|null>('backup_open'),
 };
}
