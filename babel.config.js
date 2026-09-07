// Automatic JSX runtime everywhere (background/offscreen/widget/options/popup all go
// through this single webpack+babel pipeline, so — unlike task-management's split-brain
// rollup/webpack setup — there is only ONE transform to keep in sync).
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { chrome: '110' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
