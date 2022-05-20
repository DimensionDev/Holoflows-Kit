import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'

const config = {
    input: './es/index.js',
    output: [
        { file: './umd/index.cjs', format: 'umd', name: 'HoloflowsKit' },
        { file: './test-extension/kit.js', format: 'umd', name: 'HoloflowsKit' },
    ],
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            mainFields: ['module', 'main'],
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
