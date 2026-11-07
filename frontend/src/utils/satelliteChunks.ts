// Only publish complete, ordered snapshots; never replace the catalog with a
// partial transfer. One bounded assembly per connection is retained.
export function satelliteChunkAssembler(){
 let id='',count=0,rows:unknown[]=[],next=0,started=0;
 return (value:any):unknown=>{
  if(value?.type!=='satelliteChunk')return value;
  if(typeof value.id!=='string'||!Number.isInteger(value.count)||value.count<1||value.count>200||!Number.isInteger(value.index)||!Array.isArray(value.rows)||value.rows.length>500) return null;
  if(value.index===0){id=value.id;count=value.count;rows=[];next=0;started=Date.now();}
  if(value.id!==id||value.count!==count||value.index!==next||Date.now()-started>60000){rows=[];id='';return null;}
  rows.push(...value.rows);next++;
  if(next!==count)return null;
  const payload=rows;rows=[];id='';return {type:'satellites',payload};
 };
}
