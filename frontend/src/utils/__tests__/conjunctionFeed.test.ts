import { expect, it } from "vitest";
import { currentConjunctions } from "../conjunctionFeed";
import { parseFeedMessage } from "../parseFeedMessage";
import { mockConjunctions } from "../../data/mock/conjunctions";
it('expires historical CDMs and rejects source records with no issue date',()=>{
 const now=new Date('2026-10-11T12:00:00Z');
 const event={...mockConjunctions[0],createdAt:'2026-10-11T10:00:00Z',tca:new Date('2026-10-12T12:00:00Z')};
 expect(currentConjunctions([event,{...event,createdAt:undefined},{...event,tca:new Date('2026-09-11')},{...event,createdAt:'2026-09-11'}],now)).toEqual([event]);
 expect(currentConjunctions([event],new Date('2026-10-12T12:00:01Z'))).toEqual([]);
});
it('preserves provider fetch time across reconnects, including a valid empty feed',()=>{
 const parsed=parseFeedMessage({type:'conjunctions',payload:{events:[],fetchedAt:'2026-10-11T10:00:00Z',source:'Space-Track CDM public'}});
 expect(parsed).toEqual({type:'conjunctions',payload:[],fetchedAt:new Date('2026-10-11T10:00:00Z')});
 expect(parseFeedMessage({type:'conjunctions',payload:{events:[],fetchedAt:'invalid'}})).toBeNull();
});
