const tokenCache = globalThis.__MOODIFY_TOKEN_CACHE__ || (globalThis.__MOODIFY_TOKEN_CACHE__ = new Map());

async function get(key) {
    return tokenCache.has(key) ? tokenCache.get(key) : null;
}

async function set(key, value) {
    tokenCache.set(key, value);
    return "OK";
}

async function del(key) {
    return tokenCache.delete(key) ? 1 : 0;
}

function on() {
    return undefined;
}

async function quit() {
    return undefined;
}

module.exports = {
    del,
    get,
    on,
    quit,
    set,
};
