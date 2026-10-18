import type {Bitmap} from '@/lib/ports/printer';

// RGBA pixels → packed 1-bit rows. Transparent pixels count as white paper.
export function toBitmap(rgba:Uint8ClampedArray|Uint8Array,width:number,height:number,threshold=160):Bitmap{
 if(width<=0||width%8!==0)throw new Error(`Bitmap width must be a positive multiple of 8, got ${width}`);
 if(rgba.length<width*height*4)throw new Error('Pixel buffer is smaller than width × height');
 const rowBytes=width/8,data=new Uint8Array(rowBytes*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,alpha=rgba[i+3]/255;
  const luminance=0.299*rgba[i]+0.587*rgba[i+1]+0.114*rgba[i+2];
  const onWhite=luminance*alpha+255*(1-alpha);
  if(onWhite<threshold)data[y*rowBytes+(x>>3)]|=0x80>>(x&7);
 }
 return {width,height,data};
}
