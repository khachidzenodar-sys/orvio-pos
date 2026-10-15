# POS API contract
GET /api/pos => { state: PosState, version: number, configured: boolean }. POST same response. Errors {error}.
POST JSON {action,payload,requestId: crypto.randomUUID(),version:lastVersion}. 409 reload state (do not auto repeat). All money INTEGER TETRI. Client imports types and orderTotals from @/lib/pos.
State: departments:{id,name}[], zones:{id,name}[], tables:{id,name,zoneId}[], products:{id,name,category,price,departmentIds:string[],active:boolean}[], orders:Order[], tickets:Ticket[], audit:Audit[].
Order {id,tableId,status:'open'|'closed',createdAt,closedAt?,lines:Line[],discountPercent:number,payments:Payment[]}
Line {id,productId,name,price,quantity,departmentIds,note,sentQuantity,voidQuantity}. quantity includes voidQuantity; active = quantity-voidQuantity. Price and routes snapshot on add.
Payment {id,method:'cash'|'card'|'other',amount,createdAt,allocations:{lineId,amount}[]}. Ticket {id,orderId,tableId,tableName,departmentId,type:'order'|'cancel',createdAt,lines:{lineId,name,quantity,note}[],printCount}. Audit {id,at,action,detail}.
orderTotals(order) => {subtotal,discount,total,paid,due}. All in tetri. lineBalances(order) => {lineId,total,paid,due}[] with exact discounted allocation.
Actions payloads:
- openOrder {tableId} (reuse current open order)
- addItem {orderId,productId,quantity:number,note?:string} (merges into an active line with matching product, name, price, note and department set; otherwise creates a line)
- sendOrder {orderId} creates only unsent delta department tickets
- voidItem {orderId,lineId,quantity,reason,pin} (cancel ticket for sent qty)
- discount {orderId,percent:number,pin}
- pay {orderId,method:'cash'|'card'|'other',amount?:number,items?:{lineId,quantity:number}[]} amount OR items. Items allocate proportionate discounted line price; already partially paid items reject if balance insufficient. Zero due order can close via pay amount:0.
- transfer {orderId,tableId} destination must be empty
- saveProduct {id?:string,name,category,price,departmentIds:string[],active:boolean}
- saveTable {id?:string,name,zoneId}
- saveZone {id?:string,name}
- saveDepartment {id?:string,name}
- printTicket {ticketId} increments printCount
- setupPin {pin} first configuration only; 4-12 digits
- changePin {oldPin,newPin}
No changes to closed orders. After any payment, items/discount/transfers locked. Payments require all active items sent. Tables/menu unlimited records, positive qty integers. Reports derive from state. Secret PIN never in state. configured means manager PIN configured.

Amendment: discount {percent?:number,amount?:number,reason:string,pin}; exactly one of percent or amount (integer tetri). Order.discountAmount?:number used for fixed amount; receiptPrintCount?:number. printReceipt {orderId} records cashier receipt print intent (also closed orders). Fixed discount capped to subtotal if void reduces subtotal. Items payment selects next unpaid unit boundaries; a partially paid unit counts as first next unit and only its remaining value is charged. Integer rounding remainder is assigned deterministically to unit boundaries, so last unit closes exact balance.

- closeEmptyOrder {orderId}: closes an empty/all-void order with no payments; rejects active positions. Used to release mistakenly opened tables.

Management: saveTable, saveZone, saveDepartment require payload.pin (manager PIN).
deleteTable {id,pin} archives only a table without an open order.
deleteDepartment {id,pin} archives only a department without assigned products or active open-order lines.
Archived records remain for historical names and receipts; they cannot be used for new orders or product routing.

Vercel authentication: every snapshot includes verified userId. POST requires ownerId matching that identity; mismatches reject before storage access. Session is verified via Supabase Auth.

Public demo: `/` renders browser-local state via `lib/demo-store.ts`; it does not call `/api/pos` or expose Supabase data. Demo PIN starts at 1234 and is only a local workflow simulation. `/workspace` preserves the authenticated API mode above. Both modes use the same `lib/pos.ts` business rules. Local state does not automatically import into an account.
