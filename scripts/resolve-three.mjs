// Lets node import the browser bundle: `three` and `three/addons/*`.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return {
      url: new URL('../vendor/three.module.min.js', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith('three/addons/')) {
    const rest = specifier.slice('three/addons/'.length);
    return {
      url: new URL('../vendor/' + rest, import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
