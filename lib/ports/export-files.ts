// Saving a generated file (e.g. an Excel report). The desktop adapter shows a native Save dialog.
export type ExportFiles = {
 save(defaultName:string,bytes:Uint8Array):Promise<boolean>; // false = cancelled
};
