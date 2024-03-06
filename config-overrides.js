module.exports = function override(config, env) {
  config.module = config.module ?? {};
  config.module.rules = config.module.rules ?? [];
  config.module.rules.push({
    test: /\.py/,
    type: 'asset/source',
  });
  return config;
};