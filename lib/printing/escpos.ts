import type {Bitmap} from '@/lib/ports/printer';

// 80 mm paper at 203 dpi.
export const MAX_WIDTH=576;
export const INIT=[0x1B,0x40];
// ESC d 4 (feed four lines), then GS V 66 0 (feed to the cutter and partial cut).
export const FEED_AND_CUT=[0x1B,0x64,0x04,0x1D,0x56,0x42,0x00];

// GS v 0 raster blocks; bands keep each block within small printer buffers.
export function rasterBands(bitmap:Bitmap,maxRows=255):Uint8Array{
 const rowBytes=bitmap.width/8,bands=Math.ceil(bitmap.height/maxRows);
 const out=new Uint8Array(bands*8+bitmap.data.length);
 let offset=0;
 for(let top=0;top<bitmap.height;top+=maxRows){
  const rows=Math.min(maxRows,bitmap.height-top);
  out.set([0x1D,0x76,0x30,0x00,rowBytes&0xFF,rowBytes>>8,rows&0xFF,rows>>8],offset);
  out.set(bitmap.data.subarray(top*rowBytes,(top+rows)*rowBytes),offset+8);
  offset+=8+rows*rowBytes;
 }
 return out;
}

export function buildPrintJob(bitmap:Bitmap):Uint8Array{
 if(!bitmap.width||!bitmap.height)throw new Error('Nothing to print: the bitmap is empty');
 if(bitmap.width>MAX_WIDTH)throw new Error(`Bitmap is wider than ${MAX_WIDTH} dots`);
 if(bitmap.width%8!==0||bitmap.data.length!==bitmap.width/8*bitmap.height)throw new Error('Bitmap data does not match its size');
 const bands=rasterBands(bitmap);
 const job=new Uint8Array(INIT.length+bands.length+FEED_AND_CUT.length);
 job.set(INIT,0);
 job.set(bands,INIT.length);
 job.set(FEED_AND_CUT,INIT.length+bands.length);
 return job;
}
