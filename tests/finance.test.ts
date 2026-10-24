import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState, orderTotals, lineBalances} from '../lib/pos.ts';

function fixture(price=101,quantity=1,routes=['kitchen']) {
 let state=seedState();
 const act=(action:string,p:Record<string,unknown>={},manager=false)=>{state=applyAction(state,action,p,manager,'2026-10-09T12:00:00.000Z');return state;};
 act('saveProduct',{id:'test',name:'Test',category:'Test',price,departmentIds:routes,active:true});
 act('openOrder',{tableId:'table-1'});
 const oid=state.orders[0].id;
 act('addItem',{orderId:oid,productId:'test',quantity});
 return {act,oid,get state(){return state},get order(){return state.orders[0]},get lid(){return state.orders[0].lines[0].id}};
}
test('integer tetri and cumulative discount reconciliation for many odd amounts',()=>{
 const f=fixture(101,1);
 for(let i=0;i<12;i++) f.act('addItem',{orderId:f.oid,productId:'test',quantity:1});
 f.act('discount',{orderId:f.oid,percent:17,reason:'Test'},true);
 const t=orderTotals(f.order), b=lineBalances(f.order);
 assert.equal(t.subtotal,1313); assert.equal(t.discount,223);assert.equal(t.total,1090);
 assert.equal(b.reduce((s,x)=>s+x.total,0),t.total);
 assert.ok(b.every(x=>Number.isSafeInteger(x.total)));
});
test('three department tickets incur one sale, duplicate send adds none, only new deltas send',()=>{
 const f=fixture(1200,2,['kitchen','bar','pastry']);
 f.act('sendOrder',{orderId:f.oid});assert.equal(f.state.tickets.length,3);assert.equal(orderTotals(f.order).total,2400);
 f.act('sendOrder',{orderId:f.oid});assert.equal(f.state.tickets.length,3);
 f.act('addItem',{orderId:f.oid,productId:'test',quantity:1});f.act('sendOrder',{orderId:f.oid});
 assert.equal(f.state.tickets.length,6);assert.ok(f.state.tickets.slice(3).every(t=>t.lines.length===1&&t.lines[0].quantity===1));
});
test('price and routing snapshot survive menu edits and sent cancellation uses original routes',()=>{
 const f=fixture(1200,3,['kitchen','bar']); f.act('sendOrder',{orderId:f.oid});
 f.act('saveProduct',{id:'test',name:'Changed',category:'Test',price:9000,departmentIds:['pastry'],active:true});
 assert.equal(orderTotals(f.order).total,3600);assert.equal(f.order.lines[0].name,'Test');
 f.act('voidItem',{orderId:f.oid,lineId:f.lid,quantity:1,reason:'mistake'},true);
 assert.equal(orderTotals(f.order).total,2400);
 assert.deepEqual(f.state.tickets.filter(t=>t.type==='cancel').map(t=>t.departmentId).sort(),['bar','kitchen']);
 f.act('sendOrder',{orderId:f.oid});assert.equal(f.state.tickets.length,4);
});
test('unsent cancellation produces no station ticket; all-void order closes at zero',()=>{
 const f=fixture(500,2);f.act('voidItem',{orderId:f.oid,lineId:f.lid,quantity:2,reason:'mistake'},true);
 assert.equal(f.state.tickets.length,0);f.act('pay',{orderId:f.oid,method:'cash',amount:0});assert.equal(f.order.status,'closed');
});
test('mixed item and amount tenders reconcile every allocation and close exact balance',()=>{
 const f=fixture(1000,2);f.act('addItem',{orderId:f.oid,productId:'test',quantity:1});
 f.act('discount',{orderId:f.oid,percent:10,reason:'Test'},true);f.act('sendOrder',{orderId:f.oid});
 f.act('pay',{orderId:f.oid,method:'cash',items:[{lineId:f.lid,quantity:1}]});
 f.act('pay',{orderId:f.oid,method:'card',amount:500});f.act('pay',{orderId:f.oid,method:'other',amount:1300});
 assert.equal(f.order.status,'closed');assert.equal(orderTotals(f.order).paid,2700);assert.equal(orderTotals(f.order).due,0);
 assert.ok(f.order.payments.every(p=>p.allocations.reduce((s,a)=>s+a.amount,0)===p.amount));assert.ok(lineBalances(f.order).every(b=>b.due===0));
});
test('PIN authorization and financial mutation guards reject without changing original state',()=>{
 const f=fixture(1000,2); const snapshot=JSON.stringify(f.state);
 assert.throws(()=>f.act('discount',{orderId:f.oid,percent:10,reason:'Test'}));
 assert.throws(()=>f.act('voidItem',{orderId:f.oid,lineId:f.lid,quantity:1,reason:'test'}));
 assert.throws(()=>f.act('pay',{orderId:f.oid,method:'cash',amount:1}));assert.equal(JSON.stringify(f.state),snapshot);
 f.act('sendOrder',{orderId:f.oid});f.act('pay',{orderId:f.oid,method:'cash',amount:1});
 assert.throws(()=>f.act('discount',{orderId:f.oid,percent:10,reason:'Test'},true));
 assert.throws(()=>f.act('addItem',{orderId:f.oid,productId:'test',quantity:1}));
 assert.throws(()=>f.act('transfer',{orderId:f.oid,tableId:'table-2'}));
 assert.throws(()=>f.act('pay',{orderId:f.oid,method:'card',amount:2000}));
 f.act('pay',{orderId:f.oid,method:'card',amount:1999});
 for(const action of ['sendOrder','addItem','transfer','discount','pay'])assert.throws(()=>f.act(action,{orderId:f.oid},true));
});
test('item splitting absorbs odd-tetri rounding on last unit',()=>{
 const f=fixture(50,3);f.act('discount',{orderId:f.oid,percent:33.333333,reason:'Test'},true);f.act('sendOrder',{orderId:f.oid});
 for(let i=0;i<3;i++)f.act('pay',{orderId:f.oid,method:'cash',items:[{lineId:f.lid,quantity:1}]});
 assert.equal(orderTotals(f.order).due,0);assert.equal(f.order.status,'closed');
});
test('invalid monetary inputs, duplicate items and occupied transfers reject',()=>{
 const f=fixture(500,1);for(const quantity of [0,-1,1.5,Infinity,NaN])assert.throws(()=>f.act('addItem',{orderId:f.oid,productId:'test',quantity}));
 f.act('openOrder',{tableId:'table-2'});assert.throws(()=>f.act('transfer',{orderId:f.oid,tableId:'table-2'}));
 f.act('sendOrder',{orderId:f.oid});
 assert.throws(()=>f.act('pay',{orderId:f.oid,method:'cash',items:[{lineId:f.lid,quantity:1},{lineId:f.lid,quantity:1}]}));
 assert.throws(()=>f.act('pay',{orderId:f.oid,method:'cash',amount:1.5}));
});
test('unsafe integer order amount is rejected',()=>{
 const f=fixture(100000000,1);
 assert.throws(()=>f.act('addItem',{orderId:f.oid,productId:'test',quantity:100000000}));
});
test('report-source sales, discounts and tender reconcile across paid and open orders',()=>{
 const f=fixture(1200,2); f.act('discount',{orderId:f.oid,percent:25,reason:'Test'},true);f.act('sendOrder',{orderId:f.oid});
 f.act('pay',{orderId:f.oid,method:'cash',amount:800});f.act('pay',{orderId:f.oid,method:'card',amount:1000});
 f.act('openOrder',{tableId:'table-2'});const next=f.state.orders[1].id;
 f.act('addItem',{orderId:next,productId:'test',quantity:1});f.act('sendOrder',{orderId:next});f.act('pay',{orderId:next,method:'other',amount:200});
 const totals=f.state.orders.map(orderTotals), payments=f.state.orders.flatMap(o=>o.payments);
 assert.equal(totals.reduce((s,t)=>s+t.subtotal-t.discount,0),3000);
 assert.equal(payments.reduce((s,p)=>s+p.amount,0),2000);
 assert.equal(totals.reduce((s,t)=>s+t.due,0),1000);
 assert.equal(f.state.orders.filter(o=>o.status==='closed').length,1);
});
test('fixed discount and cancellation never produce negative balance',()=>{
 const f=fixture(100,2);f.act('discount',{orderId:f.oid,amount:150,reason:'Promotion'},true);
 assert.equal(orderTotals(f.order).total,50);
 f.act('voidItem',{orderId:f.oid,lineId:f.lid,quantity:1,reason:'Wrong count'},true);
 assert.equal(orderTotals(f.order).total,0);assert.equal(orderTotals(f.order).discount,100);
 f.act('sendOrder',{orderId:f.oid});f.act('pay',{orderId:f.oid,method:'cash',amount:0});assert.equal(f.order.status,'closed');
});
test('amount-first partial payment followed by item payments preserves exact total',()=>{
 const f=fixture(50,3);f.act('discount',{orderId:f.oid,amount:50,reason:'Promotion'},true);f.act('sendOrder',{orderId:f.oid});
 f.act('pay',{orderId:f.oid,method:'cash',amount:10});
 for(let i=0;i<3;i++)f.act('pay',{orderId:f.oid,method:'card',items:[{lineId:f.lid,quantity:1}]});
 assert.equal(orderTotals(f.order).paid,100);assert.equal(f.order.status,'closed');
});

test('empty table can be released but active order cannot be silently closed', () => {
 const s = applyAction(seedState(), 'openOrder', {tableId:'table-1'});
 const orderId=s.orders[0].id;
 const closed=applyAction(s,'closeEmptyOrder',{orderId});
 assert.equal(closed.orders[0].status,'closed');
 const filled=applyAction(s,'addItem',{orderId,productId:'product-1',quantity:1});
 assert.throws(()=>applyAction(filled,'closeEmptyOrder',{orderId}));
});
