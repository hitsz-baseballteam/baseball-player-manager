// CSS module mock loader for Node.js test environment
// Returns a Proxy that maps any class name access to "mock-{className}"

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return {
      url: new URL(specifier, context.parentURL).href,
      format: "module",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) {
    return {
      format: "module",
      source: "export default new Proxy({}, { get: (_, prop) => prop === '__esModule' ? true : `mock-${String(prop)}` });",
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
