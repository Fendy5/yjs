import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

const customModules = new Set([
  'y-websocket',
  'y-codemirror',
  'y-ace',
  'y-textarea',
  'y-quill',
  'y-dom',
  'y-prosemirror'
])
/**
 * @type {Set<any>}
 */
const customLibModules = new Set([
  'lib0',
  'y-protocols'
])
const debugResolve = {
  resolveId (importee) {
    if (importee === 'yjs') {
      return `${process.cwd()}/src/index.js`
    }
    if (customModules.has(importee.split('/')[0])) {
      return `${process.cwd()}/../${importee}/src/${importee}.js`
    }
    if (customLibModules.has(importee.split('/')[0])) {
      return `${process.cwd()}/../${importee}`
    }
    return null
  }
}

const minificationPlugins = process.env.PRODUCTION ? [terser({
  module: true,
  compress: {
    hoist_vars: true,
    module: true,
    passes: 5,
    pure_getters: true,
    unsafe_comps: true,
    unsafe_undefined: true
  },
  mangle: {
    toplevel: true
  }
})] : []

export default [{
  input: './src/index.js',
  output: [{
    name: 'Y',
    file: 'dist/yjs.js',
    format: 'cjs',
    sourcemap: true,
    paths: path => {
      if (/^funlib\//.test(path)) {
        return `lib0/dist${path.slice(6)}`
      }
      return path
    }
  }, {
    name: 'Y',
    file: 'dist/yjs.mjs',
    format: 'es',
    sourcemap: true
  }],
  external: id => /^lib0\//.test(id)
}, {
  input: './tests/index.js',
  output: {
    name: 'test',
    file: 'dist/tests.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    debugResolve,
    nodeResolve({
      sourcemap: true,
      module: true,
      browser: true
    }),
    commonjs()
  ]
}, {
  input: ['./examples/codemirror.js', './examples/textarea.js', './examples/quill.js', './examples/dom.js', './examples/prosemirror.js'], // fs.readdirSync('./examples').filter(file => /(?<!\.(test|config))\.js$/.test(file)).map(file => './examples/' + file),
  output: {
    dir: 'examples/build',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    debugResolve,
    nodeResolve({
      sourcemap: true,
      module: true,
      browser: true
    }),
    commonjs(),
    ...minificationPlugins
  ]
}]