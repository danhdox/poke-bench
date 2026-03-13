"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DexStats = exports.DexTypes = exports.TypeInfo = exports.DexNatures = exports.Nature = exports.BasicEffect = void 0;
exports.toID = toID;
exports.assignMissingFields = assignMissingFields;
/**
 * Dex Data
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
const utils_1 = require("../lib/utils");
/**
* Converts anything to an ID. An ID must have only lowercase alphanumeric
* characters.
*
* If a string is passed, it will be converted to lowercase and
* non-alphanumeric characters will be stripped.
*
* If an object with an ID is passed, its ID will be returned.
* Otherwise, an empty string will be returned.
*
* Generally assigned to the global toID, because of how
* commonly it's used.
*/
function toID(text) {
    if (typeof text !== 'string') {
        if (text)
            text = text.id || text.userid || text.roomid || text;
        if (typeof text === 'number')
            text = `${text}`;
        else if (typeof text !== 'string')
            return '';
    }
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
/**
 * Like Object.assign but only assigns fields missing from self.
 * Facilitates consistent field ordering in constructors.
 * Modifies self in-place.
 */
function assignMissingFields(self, data) {
    for (const k in data) {
        if (k in self)
            continue;
        self[k] = data[k];
    }
}
class BasicEffect {
    constructor(data) {
        this.name = utils_1.Utils.getString(data.name).trim();
        this.id = data.realMove ? toID(data.realMove) : toID(this.name); // Hidden Power hack
        this.fullname = utils_1.Utils.getString(data.fullname) || this.name;
        this.effectType = utils_1.Utils.getString(data.effectType) || 'Condition';
        this.exists = data.exists ?? !!this.id;
        this.num = data.num || 0;
        this.gen = data.gen || 0;
        this.shortDesc = data.shortDesc || '';
        this.desc = data.desc || '';
        this.isNonstandard = data.isNonstandard || null;
        this.duration = data.duration;
        this.noCopy = !!data.noCopy;
        this.affectsFainted = !!data.affectsFainted;
        this.status = data.status || undefined;
        this.weather = data.weather || undefined;
        this.sourceEffect = data.sourceEffect || '';
    }
    toString() {
        return this.name;
    }
}
exports.BasicEffect = BasicEffect;
class Nature extends BasicEffect {
    constructor(data) {
        super(data);
        this.fullname = `nature: ${this.name}`;
        this.effectType = 'Nature';
        this.gen = 3;
        this.plus = data.plus || undefined;
        this.minus = data.minus || undefined;
        assignMissingFields(this, data);
    }
}
exports.Nature = Nature;
const EMPTY_NATURE = utils_1.Utils.deepFreeze(new Nature({ name: '', exists: false }));
class DexNatures {
    constructor(dex) {
        this.natureCache = new Map();
        this.allCache = null;
        this.dex = dex;
    }
    get(name) {
        if (name && typeof name !== 'string')
            return name;
        return this.getByID(toID(name));
    }
    getByID(id) {
        if (id === '' || id === 'constructor')
            return EMPTY_NATURE;
        let nature = this.natureCache.get(id);
        if (nature)
            return nature;
        const alias = this.dex.getAlias(id);
        if (alias) {
            nature = this.get(alias);
            if (nature.exists) {
                this.natureCache.set(id, nature);
            }
            return nature;
        }
        if (id && this.dex.data.Natures.hasOwnProperty(id)) {
            const natureData = this.dex.data.Natures[id];
            nature = new Nature(natureData);
            if (nature.gen > this.dex.gen)
                nature.isNonstandard = 'Future';
        }
        else {
            nature = new Nature({ name: id, exists: false });
        }
        nature.kind = 'Nature';
        if (nature.exists)
            this.natureCache.set(id, nature);
        return nature;
    }
    all() {
        if (this.allCache)
            return this.allCache;
        const natures = [];
        for (const id in this.dex.data.Natures) {
            natures.push(this.getByID(id));
        }
        this.allCache = natures;
        return this.allCache;
    }
}
exports.DexNatures = DexNatures;
class TypeInfo {
    constructor(data) {
        this.name = data.name;
        this.id = data.id;
        this.effectType = utils_1.Utils.getString(data.effectType) || 'Type';
        this.exists = data.exists ?? !!this.id;
        this.gen = data.gen || 0;
        this.isNonstandard = data.isNonstandard || null;
        this.damageTaken = data.damageTaken || {};
        this.HPivs = data.HPivs || {};
        this.HPdvs = data.HPdvs || {};
        assignMissingFields(this, data);
    }
    toString() {
        return this.name;
    }
}
exports.TypeInfo = TypeInfo;
const EMPTY_TYPE_INFO = utils_1.Utils.deepFreeze(new TypeInfo({ name: '', id: '', exists: false, effectType: 'EffectType' }));
class DexTypes {
    constructor(dex) {
        this.typeCache = new Map();
        this.allCache = null;
        this.namesCache = null;
        this.dex = dex;
    }
    get(name) {
        if (name && typeof name !== 'string')
            return name;
        return this.getByID(toID(name));
    }
    getByID(id) {
        if (id === '' || id === 'constructor')
            return EMPTY_TYPE_INFO;
        let type = this.typeCache.get(id);
        if (type)
            return type;
        const typeName = id.charAt(0).toUpperCase() + id.substr(1);
        if (typeName && this.dex.data.TypeChart.hasOwnProperty(id)) {
            type = new TypeInfo({ name: typeName, id, ...this.dex.data.TypeChart[id] });
        }
        else {
            type = new TypeInfo({ name: typeName, id, exists: false, effectType: 'EffectType' });
        }
        type.kind = 'Type';
        if (type.exists)
            this.typeCache.set(id, type);
        return type;
    }
    names() {
        if (this.namesCache)
            return this.namesCache;
        this.namesCache = this.all().filter(type => !type.isNonstandard).map(type => type.name);
        return this.namesCache;
    }
    isName(name) {
        if (!name)
            return false;
        const id = name.toLowerCase();
        const typeName = id.charAt(0).toUpperCase() + id.substr(1);
        return name === typeName && this.dex.data.TypeChart.hasOwnProperty(id);
    }
    all() {
        if (this.allCache)
            return this.allCache;
        const types = [];
        for (const id in this.dex.data.TypeChart) {
            types.push(this.getByID(id));
        }
        this.allCache = types;
        return this.allCache;
    }
}
exports.DexTypes = DexTypes;
const idsCache = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const reverseCache = {
    __proto: null,
    "hitpoints": 'hp',
    "attack": 'atk',
    "defense": 'def',
    "specialattack": 'spa', "spatk": 'spa', "spattack": 'spa', "specialatk": 'spa',
    "special": 'spa', "spc": 'spa',
    "specialdefense": 'spd', "spdef": 'spd', "spdefense": 'spd', "specialdef": 'spd',
    "speed": 'spe',
};
class DexStats {
    constructor(dex) {
        if (dex.gen !== 1) {
            this.shortNames = {
                __proto__: null, hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe",
            };
            this.mediumNames = {
                __proto__: null, hp: "HP", atk: "Attack", def: "Defense", spa: "Sp. Atk", spd: "Sp. Def", spe: "Speed",
            };
            this.names = {
                __proto__: null, hp: "HP", atk: "Attack", def: "Defense", spa: "Special Attack", spd: "Special Defense", spe: "Speed",
            };
        }
        else {
            this.shortNames = {
                __proto__: null, hp: "HP", atk: "Atk", def: "Def", spa: "Spc", spd: "[SpD]", spe: "Spe",
            };
            this.mediumNames = {
                __proto__: null, hp: "HP", atk: "Attack", def: "Defense", spa: "Special", spd: "[Sp. Def]", spe: "Speed",
            };
            this.names = {
                __proto__: null, hp: "HP", atk: "Attack", def: "Defense", spa: "Special", spd: "[Special Defense]", spe: "Speed",
            };
        }
    }
    getID(name) {
        if (name === 'Spd')
            return 'spe';
        const id = toID(name);
        if (reverseCache[id])
            return reverseCache[id];
        if (idsCache.includes(id))
            return id;
        return null;
    }
    ids() {
        return idsCache;
    }
}
exports.DexStats = DexStats;
//# sourceMappingURL=dex-data.js.map