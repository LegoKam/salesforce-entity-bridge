function createLogger(name, level = 'info') {
  const levels = {
    error: 0, warn: 1, info: 2, debug: 3,
  };
  const current = levels[String(level).toLowerCase()] ?? 2;
  const log = (lvl, message) => {
    if ((levels[lvl] ?? 2) > current) return;
    const line = `${new Date().toISOString()} [${name}] ${lvl}: ${message}`;
    // eslint-disable-next-line no-console
    console.log(line);
  };
  return {
    error: (m) => log('error', m),
    warn: (m) => log('warn', m),
    info: (m) => log('info', m),
    debug: (m) => log('debug', m),
  };
}

module.exports = { createLogger };
