import {it,expect} from 'vitest';
import {satelliteChunkAssembler} from '../satelliteChunks';
it('publishes only a complete ordered snapshot and recovers after a missing chunk',()=>{
 const assemble=satelliteChunkAssembler();const frame=(index:number,rows:number[])=>({type:'satelliteChunk',id:'a',count:2,index,rows});
 expect(assemble(frame(0,[1]))).toBeNull();expect(assemble(frame(1,[2]))).toEqual({type:'satellites',payload:[1,2]});
 expect(assemble(frame(1,[2]))).toBeNull();expect(assemble(frame(0,[3]))).toBeNull();expect(assemble(frame(1,[4]))).toEqual({type:'satellites',payload:[3,4]});
 expect(assemble({...frame(0,[1]),count:99999})).toBeNull();
});
