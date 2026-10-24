import type {BackupFiles} from '../ports/backup-files';
import type {ExportFiles} from '../ports/export-files';
import type {Invoke} from './tauri-invoke';

// Native Save/Open dialogs, opened by src-tauri/src/backup.rs.
export function createTauriBackupFiles(invoke:Invoke):BackupFiles {
 return {
  save:(defaultName,contents)=>invoke<boolean>('backup_save',{defaultName,contents}),
  open:()=>invoke<string|null>('backup_open'),
 };
}

// Native Save dialog for reports, opened by src-tauri/src/backup.rs.
export function createTauriExportFiles(invoke:Invoke):ExportFiles {
 return {save:(defaultName,bytes)=>invoke<boolean>('export_save',{defaultName,bytes:Array.from(bytes)})};
}
