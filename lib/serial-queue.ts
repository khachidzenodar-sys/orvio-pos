/** Serialize writes so rapid taps always use the latest saved version. */
export function createSerialQueue() {
    let tail: Promise<unknown> = Promise.resolve();
    return function enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = tail.then(task);
        tail = result.catch(() => undefined);
        return result;
    };
}
