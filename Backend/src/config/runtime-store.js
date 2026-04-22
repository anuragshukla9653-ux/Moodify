const mongoose = require("mongoose");

const runtime = globalThis.__MOODIFY_RUNTIME__ || (globalThis.__MOODIFY_RUNTIME__ = {});

const MEMORY_SONG_SEEDS = [
    {
        title: "Sunrise Drift",
        mood: "happy",
        url: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/songs/_Paro_Ow5oNKdWI",
        posterUrl: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/posters/_Paro_MZxMHKvVI.jpeg",
        artistName: "MoodWave",
        albumName: "Starter Sessions",
    },
    {
        title: "Soft Rain",
        mood: "sad",
        url: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/songs/_Paro_Ow5oNKdWI",
        posterUrl: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/posters/_Paro_MZxMHKvVI.jpeg",
        artistName: "MoodWave",
        albumName: "Starter Sessions",
    },
    {
        title: "Electric Flicker",
        mood: "surprised",
        url: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/songs/_Paro_Ow5oNKdWI",
        posterUrl: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/posters/_Paro_MZxMHKvVI.jpeg",
        artistName: "MoodWave",
        albumName: "Starter Sessions",
    },
];

if (!runtime.memoryStore) {
    runtime.memoryStore = {
        blacklists: [],
        moods: [],
        songs: [],
        users: [],
    };
}

const memoryStore = runtime.memoryStore;

function useMemoryDb() {
    return Boolean(runtime.useMemoryDb);
}

function enableMemoryDb(reason) {
    runtime.useMemoryDb = true;
    if (reason) {
        runtime.memoryDbReason = reason;
    }

    seedMemorySongs();
}

function createId() {
    return new mongoose.Types.ObjectId().toString();
}

function normalizeId(value) {
    if (value == null) {
        return null;
    }

    if (typeof value === "object" && value._id != null) {
        return normalizeId(value._id);
    }

    return String(value);
}

function cloneDoc(value) {
    if (value == null) {
        return value;
    }

    return JSON.parse(JSON.stringify(value));
}

function toComparable(value) {
    if (value == null) {
        return null;
    }

    if (typeof value === "object" && value._id != null) {
        return normalizeId(value._id);
    }

    const parsedDate = Date.parse(value);
    if (!Number.isNaN(parsedDate) && (typeof value === "string" || value instanceof Date)) {
        return parsedDate;
    }

    return value;
}

function compareValues(left, right) {
    const a = toComparable(left);
    const b = toComparable(right);

    if (a === b) {
        return 0;
    }

    if (a == null) {
        return -1;
    }

    if (b == null) {
        return 1;
    }

    return a < b ? -1 : 1;
}

function matchesFilter(doc, filter = {}) {
    const entries = Object.entries(filter || {});
    if (entries.length === 0) {
        return true;
    }

    return entries.every(([key, value]) => {
        if (key === "$or" && Array.isArray(value)) {
            return value.some((condition) => matchesFilter(doc, condition));
        }

        if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
            return true;
        }

        return compareValues(doc[key], value) === 0;
    });
}

function sortDocs(docs, sortSpec = {}) {
    const sortEntries = Object.entries(sortSpec || {});
    if (sortEntries.length === 0) {
        return docs;
    }

    const [field, directionRaw] = sortEntries[0];
    const direction = Number(directionRaw) >= 0 ? 1 : -1;

    return [...docs].sort((left, right) => direction * compareValues(left[field], right[field]));
}

function pickFields(doc, fields) {
    if (!fields) {
        return cloneDoc(doc);
    }

    const allowedFields = new Set(String(fields).split(/\s+/).filter(Boolean));
    const result = {};

    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(doc, field)) {
            result[field] = cloneDoc(doc[field]);
        }
    }

    if (doc._id != null) {
        result._id = doc._id;
    }

    return result;
}

function applyPopulate(doc, populateSpecs, populateResolver) {
    if (!populateSpecs.length || typeof populateResolver !== "function") {
        return doc;
    }

    const nextDoc = cloneDoc(doc);
    for (const spec of populateSpecs) {
        const populatedValue = populateResolver(nextDoc, spec.path, spec.fields);
        if (populatedValue !== undefined) {
            nextDoc[spec.path] = populatedValue;
        }
    }

    return nextDoc;
}

class MemoryQuery {
    constructor({ collection, filter = {}, single = false, populateResolver = null }) {
        this.collection = collection;
        this.filter = filter;
        this.single = single;
        this.populateResolver = populateResolver;
        this.sortSpec = null;
        this.limitValue = null;
        this.populateSpecs = [];
    }

    sort(sortSpec) {
        this.sortSpec = sortSpec;
        return this;
    }

    limit(value) {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue)) {
            this.limitValue = parsedValue;
        }
        return this;
    }

    select() {
        return this;
    }

    populate(path, fields) {
        this.populateSpecs.push({ path, fields });
        return this;
    }

    async exec() {
        const collection = typeof this.collection === "function" ? this.collection() : this.collection;
        let docs = collection.filter((doc) => matchesFilter(doc, this.filter)).map(cloneDoc);

        if (this.sortSpec) {
            docs = sortDocs(docs, this.sortSpec);
        }

        if (this.limitValue != null) {
            docs = docs.slice(0, this.limitValue);
        }

        if (this.populateSpecs.length) {
            docs = docs.map((doc) => applyPopulate(doc, this.populateSpecs, this.populateResolver));
        }

        return this.single ? (docs[0] ?? null) : docs;
    }

    then(resolve, reject) {
        return this.exec().then(resolve, reject);
    }

    catch(reject) {
        return this.exec().catch(reject);
    }
}

function createMemoryRecord(collectionName, data, { populateResolver = null } = {}) {
    const now = new Date().toISOString();
    const record = cloneDoc(data) || {};

    if (record._id == null) {
        record._id = createId();
    } else {
        record._id = normalizeId(record._id);
    }

    if (record.createdAt == null) {
        record.createdAt = now;
    }

    if (record.updatedAt == null) {
        record.updatedAt = now;
    }

    runtime.memoryStore[collectionName].push(record);

    const document = cloneDoc(record);

    Object.defineProperty(document, "populate", {
        enumerable: false,
        value: async (path, fields) => cloneDoc(applyPopulate(document, [{ path, fields }], populateResolver)),
    });

    Object.defineProperty(document, "toObject", {
        enumerable: false,
        value: () => cloneDoc(document),
    });

    return document;
}

function createHybridModel(mongooseModel, adapter) {
    return new Proxy(mongooseModel, {
        get(target, prop, receiver) {
            if (useMemoryDb() && Object.prototype.hasOwnProperty.call(adapter, prop)) {
                const value = adapter[prop];
                return typeof value === "function" ? value.bind(adapter) : value;
            }

            const value = Reflect.get(target, prop, receiver);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}

function seedMemorySongs() {
    if (runtime.memoryStore.songs.length > 0) {
        return;
    }

    const now = new Date().toISOString();

    for (const seed of MEMORY_SONG_SEEDS) {
        runtime.memoryStore.songs.push({
            _id: createId(),
            title: seed.title,
            mood: seed.mood,
            url: seed.url,
            posterUrl: seed.posterUrl,
            artistName: seed.artistName,
            albumName: seed.albumName,
            source: "local",
            createdAt: now,
            updatedAt: now,
        });
    }
}

module.exports = {
    applyPopulate,
    cloneDoc,
    compareValues,
    createHybridModel,
    createId,
    createMemoryRecord,
    enableMemoryDb,
    matchesFilter,
    MemoryQuery,
    normalizeId,
    pickFields,
    memoryStore,
    runtime,
    seedMemorySongs,
    sortDocs,
    useMemoryDb,
};
