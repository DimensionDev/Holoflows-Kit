import typescript from 'rollup-plugin-typescript2'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'
import replace from 'rollup-plugin-replace'

const config = {
    input: './src/index.ts',
    output: {
        file: './dist/out.js',
        format: 'umd',
        name: 'HoloflowsKit',
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            module: true,
        }),
        typescript({ tsconfigOverride: { compilerOptions: { target: 'es6' } } }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        }),
        commonjs({
            extensions: ['.js', '.ts', '.tsx'],
            exclude: ['node_modules/lodash-es/'],
            namedExports: {
                events: ['EventEmitter'],
            },
        }),
    ],
}

export default config
