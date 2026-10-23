import type {Bitmap} from '@/lib/ports/printer';
import type {Row} from './receipt-layout';
import {toBitmap} from './bitmap';

// 80 mm paper at 203 dpi; sizes in printer dots (1 px = 1 dot).
const WIDTH=576;
const MARGIN=8;
const CONTENT=WIDTH-MARGIN*2;
const PADDING_TOP=8;
const PADDING_BOTTOM=24;
const COLUMN_GAP=12;
const RULE_HEIGHT=2;
const RULE_SPACE=8;
const FAMILY='"Noto Sans Georgian", Sylfaen, sans-serif';
const SIZES={normal:{px:24,bold:false},large:{px:34,bold:true},huge:{px:48,bold:true}};
const SAMPLE='ქართული ₾';

type TextRow=Extract<Row,{text:string}>;
type Op={kind:'text';font:string;text:string;x:number;y:number;align:CanvasTextAlign}|{kind:'rule';y:number}|{kind:'image';image:CanvasImageSource;x:number;y:number;width:number;height:number};
const LOGO_MAX={width:320,height:200};
type Images=Map<string,{image:CanvasImageSource;width:number;height:number}>;

const fontOf=(row:TextRow)=>{const size=SIZES[row.size||'normal'];return `${size.bold||row.bold?'bold ':''}${size.px}px ${FAMILY}`;};
const lineHeight=(row:TextRow)=>Math.round(SIZES[row.size||'normal'].px*1.35);

function breakWord(ctx:CanvasRenderingContext2D,word:string,max:number):string[]{
 const parts:string[]=[];let part='';
 for(const ch of Array.from(word)){
  if(part&&ctx.measureText(part+ch).width>max){parts.push(part);part='';}
  part+=ch;
 }
 return part?[...parts,part]:parts;
}

function wrap(ctx:CanvasRenderingContext2D,text:string,max:number):string[]{
 const lines:string[]=[];let line='';
 for(const word of text.split(/\s+/).filter(Boolean)){
  const candidate=line?`${line} ${word}`:word;
  if(ctx.measureText(candidate).width<=max){line=candidate;continue;}
  if(line)lines.push(line);
  if(ctx.measureText(word).width<=max){line=word;continue;}
  const pieces=breakWord(ctx,word,max);
  line=pieces.pop()||'';
  lines.push(...pieces);
 }
 return line||!lines.length?[...lines,line]:lines;
}

// First pass: positions only, so the canvas can be sized before drawing.
function layout(ctx:CanvasRenderingContext2D,rows:Row[],images:Images=new Map()):{ops:Op[];height:number}{
 const ops:Op[]=[];let y=PADDING_TOP;
 for(const row of rows){
  if('gap' in row){y+=row.gap;continue;}
  if('image' in row){
   const img=images.get(row.image);if(!img)continue;
   const scale=Math.min(1,LOGO_MAX.width/img.width,LOGO_MAX.height/img.height),width=Math.round(img.width*scale),height=Math.round(img.height*scale);
   ops.push({kind:'image',image:img.image,x:Math.round((WIDTH-width)/2),y,width,height});y+=height+12;continue;
  }
  if('rule' in row){y+=RULE_SPACE;ops.push({kind:'rule',y});y+=RULE_HEIGHT+RULE_SPACE;continue;}
  const font=fontOf(row),height=lineHeight(row);
  ctx.font=font;
  const right=row.right,room=right===undefined?CONTENT:CONTENT-ctx.measureText(right).width-COLUMN_GAP;
  // A very wide right part gets its own line instead of squeezing the left text.
  const sameLine=room>=CONTENT/3;
  const align=right!==undefined?'left':row.align||'left';
  const x=align==='center'?WIDTH/2:align==='right'?WIDTH-MARGIN:MARGIN;
  const lines=wrap(ctx,row.text,sameLine?room:CONTENT);
  if(right!==undefined&&!sameLine)lines.push('');
  lines.forEach((text,i)=>ops.push({kind:'text',font,text,x,y:y+height*i+height/2,align}));
  if(right!==undefined)ops.push({kind:'text',font,text:right,x:WIDTH-MARGIN,y:y+height*(sameLine?0:lines.length-1)+height/2,align:'right'});
  y+=height*lines.length;
 }
 return {ops,height:Math.ceil(y+PADDING_BOTTOM)};
}

async function loadFonts(rows:Row[]){
 if(typeof document==='undefined'||!document.fonts)return;
 const fonts=new Set(rows.filter((r):r is TextRow=>'text' in r).map(fontOf));
 await Promise.all(Array.from(fonts,font=>document.fonts.load(font,SAMPLE).catch(()=>[])));
}

// A logo that cannot be decoded is skipped rather than blocking the print.
async function loadImages(rows:Row[]):Promise<Images>{
 const images:Images=new Map();
 for(const row of rows){
  if(!('image' in row)||images.has(row.image))continue;
  try{const img=new Image();img.src=row.image;await img.decode();if(img.naturalWidth&&img.naturalHeight)images.set(row.image,{image:img,width:img.naturalWidth,height:img.naturalHeight});}catch{/* skip */}
 }
 return images;
}

export async function renderRows(rows:Row[]):Promise<Bitmap>{
 await loadFonts(rows);
 const images=await loadImages(rows);
 const canvas=document.createElement('canvas');
 canvas.width=WIDTH;canvas.height=1;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('ჩეკის დახატვა ვერ მოხერხდა');
 const {ops,height}=layout(ctx,rows,images);
 canvas.height=height; // resizing resets the context state
 ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,height);
 ctx.fillStyle='#000';ctx.textBaseline='middle';
 for(const op of ops){
  if(op.kind==='rule'){ctx.fillRect(MARGIN,op.y,CONTENT,RULE_HEIGHT);continue;}
  if(op.kind==='image'){ctx.drawImage(op.image,op.x,op.y,op.width,op.height);ctx.fillStyle='#000';continue;}
  ctx.font=op.font;ctx.textAlign=op.align;ctx.fillText(op.text,op.x,op.y);
 }
 return toBitmap(ctx.getImageData(0,0,WIDTH,height).data,WIDTH,height);
}
