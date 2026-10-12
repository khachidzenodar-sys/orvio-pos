import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const posStore = sqliteTable('pos_store', { id:text('id').primaryKey(), version:integer('version').notNull().default(0), document:text('document').notNull() });
