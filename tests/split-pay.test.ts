import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState, orderTotals} from '../lib/pos.ts';

function sentOrder(price:number) {
 let state=seedState();
 const act=(action:string,p:Record<string,unknown>={})=>{state=applyAction(state,action,p,false,'2026-10-20T12:00:00.000Z');return state;};
 act('saveProduct',{id:'test',name:'Test',category:'Test',price,departmentIds:['kitchen'],active:true});
 act('openOrder',{tableId:'table-1'});
 const oid=state.orders[0].id;
 act('addItem',{orderId:oid,productId:'test',quantity:1});
 act('sendOrder',{orderId:oid});
 return {act,oid,get state(){return state},get order(){return state.orders[0]}};
}
test('split pay records cash and card together and closes the bill',()=>{
 const f=sentOrder(5000);
 f.act('splitPay',{orderId:f.oid,cash:2000,card:3000});
 assert.deepEqual(f.order.payments.map(x=>[x.method,x.amount]),[['cash',2000],['card',3000]]);
 assert.equal(f.order.status,'closed');assert.equal(orderTotals(f.order).due,0);
});
test('split pay may leave a remainder and accepts a single method',()=>{
 const f=sentOrder(5000);
 f.act('splitPay',{orderId:f.oid,cash:0,card:1500});
 assert.deepEqual(f.order.payments.map(x=>[x.method,x.amount]),[['card',1500]]);
 assert.equal(f.order.status,'open');assert.equal(orderTotals(f.order).due,3500);
});
test('invalid split changes nothing',()=>{
 const f=sentOrder(5000);
 const before=f.state;
 assert.throws(()=>f.act('splitPay',{orderId:f.oid,cash:3000,card:3000}),/აღემატება/);
 assert.throws(()=>f.act('splitPay',{orderId:f.oid,cash:0,card:0}),/დადებითი/);
 assert.throws(()=>f.act('splitPay',{orderId:f.oid,cash:-100,card:5100}));
 assert.equal(f.state,before);assert.equal(f.order.payments.length,0);
});
