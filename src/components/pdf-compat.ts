// PDF.js still uses this API in both its main module and worker.
// Older mobile browsers may lack it even when module workers are available.
type Resolvers<T> = { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void };
const compatiblePromise = Promise as PromiseConstructor & { withResolvers?: <T>() => Resolvers<T> };
if (typeof compatiblePromise.withResolvers !== 'function') {
  compatiblePromise.withResolvers = function<T>(this: PromiseConstructor): Resolvers<T> {
    let resolve!: Resolvers<T>['resolve'];
    let reject!: Resolvers<T>['reject'];
    const promise = new this<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
  };
}
