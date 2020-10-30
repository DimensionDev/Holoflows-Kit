import typescript from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'

function parseMaybe(s) {
    return typeof s === 'string' ? JSON.parse(s) : {}
}

const config = {
    input: './src/index.ts',
    output: {
        file: './umd/index.cjs',
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
            },
        }),
        typescript({
            tsconfigOverride: {
                compilerOptions: { target: 'ES2018', ...parseMaybe(process.env.TS_OPTS) },
            },
        }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        }),
        commonjs({
            extensions: ['.js', '.ts', '.tsx'],
            exclude: ['node_modules/lodash-es/'],
        }),
    ],
}

export default config
