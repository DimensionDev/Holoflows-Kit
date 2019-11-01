import typescript from 'rollup-plugin-typescript2'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'
import replace from 'rollup-plugin-replace'

const config = {
    input: './src/index.ts',
    output: {
        file: './umd/index.js',
        format: 'umd',
        name: 'HoloflowsKit',
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            mainFields: ['module', 'main'],
            customResolveOptions: {
                moduleDirectory: process.env.MODULE_DIR || 'node_modules',
            }
        }),
        typescript({ tsconfigOverride: { compilerOptions: { target: 'es6', ...JSON.parse(process.env.TS_OPTS) } } }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        }),
        commonjs({
            extensions: ['.js', '.ts', '.tsx'],
            exclude: ['node_modules/lodash-es/'],
            namedExports: {},
        }),
    ],
}

export default config
