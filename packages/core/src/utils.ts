/**
 * Extract python error from an exception and alert the user.
 * @param e The exception to extract the error from.
 */
export const extractPythonError = (e: any) => {
  console.error(e);
  if (e instanceof py.ffi.PythonError) {
    const type = e.type;
    const message = e.message.split(type).pop()?.slice(2, -1);
    alert(message);
  }
};

/**
 * Wraps a function with a catch block that alerts the user of any Python errors.
 * @param fn The function to wrap.
 * @param returnFalseOnError Whether to return false instead of throwing an error on error.
 * @returns The wrapped function.
 */
export const catchAlertPythonErrors = <T extends any[], U>(
  fn: (...args: T) => U,
  returnFalseOnError = false,
) => {
  return (...args: T): U => {
    try {
      return fn(...args);
    } catch (e) {
      extractPythonError(e);
      if (returnFalseOnError) return false as any;
      throw e;
    }
  };
};

/**
 * Wraps a proxy object with a catch block that alerts the user of any Python errors.
 * @param proxy The proxy object to wrap.
 * @returns The wrapped proxy object.
 */
export function wrapCatchProxyErrors<T extends object>(proxy: T): T {
  return new Proxy(proxy, {
    get(target, prop, receiver) {
      const output = Reflect.get(target, prop, receiver);
      if (typeof output === "function") {
        return catchAlertPythonErrors(output as any, true);
      }
      return output;
    },
  });
}
