// Saving and opening backup files. The desktop adapter shows native dialogs;
// file paths never reach the UI.
export type BackupFiles = {
 save(defaultName:string,contents:string):Promise<boolean>; // false = cancelled
 open():Promise<string|null>;                                // null = cancelled
};
