// Key/value persistence. Browser localStorage satisfies it synchronously;
// the desktop file adapter satisfies it asynchronously.
export type KeyValueStore = {
 getItem(key:string):string|null|Promise<string|null>;
 setItem(key:string,value:string):void|Promise<void>;
};
