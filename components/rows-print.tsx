import type {Row} from '@/lib/printing/receipt-layout';

// Browser-print fallback: shows the same rows the thermal printer would print.
export function RowsPrint({rows}:{rows:Row[]}){
 return <div className="rowsprint">{rows.map((row,i)=>{
  if('rule' in row)return <hr key={i}/>;
  if('gap' in row)return <div key={i} style={{height:row.gap}}/>;
  const classes=[row.align==='center'?'center':'',row.size==='large'?'large':row.size==='huge'?'huge':''].filter(Boolean).join(' ');
  if(row.right!==undefined)return <div key={i} className={`summaryrow ${classes}`.trim()} style={row.bold?{fontWeight:700}:undefined}><span>{row.text}</span><b>{row.right}</b></div>;
  return <div key={i} className={classes||undefined} style={{fontWeight:row.bold?700:undefined,textAlign:row.align==='right'?'right':undefined}}>{row.text}</div>;
 })}</div>;
}
