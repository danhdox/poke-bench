import * as Utils from '../lib/utils';
import { Condition, DexConditions } from './dex-conditions';
import { DataMove, DexMoves } from './dex-moves';
import { Item, DexItems } from './dex-items';
import { Ability, DexAbilities } from './dex-abilities';
import { Species, DexSpecies, DexLearnsets } from './dex-species';
import { Format, FormatList, DexFormats, RuleTable } from './dex-formats';
import { AbilityText, ActiveMove, AnyObject, ID, IDEntry, ItemText, ModdedBattleScriptsData, Move, MoveText, StatsTable } from './exported-global-types';
import * as Data from './dex-data';
type DataType = 'Abilities' | 'Rulesets' | 'FormatsData' | 'Items' | 'Learnsets' | 'Moves' | 'Natures' | 'Pokedex' | 'Scripts' | 'Conditions' | 'TypeChart' | 'PokemonGoData';
/** Unfortunately we do for..in too much to want to deal with the casts */
export interface DexTable<T> {
    [id: string]: T;
}
export interface AliasesTable {
    [id: IDEntry]: string;
}
interface DexTableData {
    Abilities: DexTable<import('./dex-abilities').AbilityData>;
    Rulesets: DexTable<import('./dex-formats').FormatData>;
    Items: DexTable<import('./dex-items').ItemData>;
    Learnsets: DexTable<import('./dex-species').LearnsetData>;
    Moves: DexTable<import('./dex-moves').MoveData>;
    Natures: DexTable<import('./dex-data').NatureData>;
    Pokedex: DexTable<import('./dex-species').SpeciesData>;
    FormatsData: DexTable<import('./dex-species').SpeciesFormatsData>;
    PokemonGoData: DexTable<import('./dex-species').PokemonGoData>;
    Conditions: DexTable<import('./dex-conditions').ConditionData>;
    TypeChart: DexTable<import('./dex-data').TypeData>;
    Scripts: ModdedBattleScriptsData;
    Species: DexTable<import('./dex-species').SpeciesData>;
    Types: DexTable<import('./dex-data').TypeData>;
}
declare const TEXT: {
    Abilities: DexTable<AbilityText>;
    Items: DexTable<ItemText>;
    Moves: DexTable<MoveText>;
    Default: DexTable<AnyObject>;
};
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Array<infer U> ? Array<DeepPartial<U>> : T[P] extends ReadonlyArray<infer V> ? ReadonlyArray<DeepPartial<V>> : DeepPartial<T[P]>;
};
export type ModData = DeepPartial<ModdedDex['data']>;
export declare const toID: typeof Data.toID;
export declare class ModdedDex {
    readonly Data: typeof Data;
    readonly Condition: typeof Condition;
    readonly Ability: typeof Ability;
    readonly Item: typeof Item;
    readonly Move: typeof DataMove;
    readonly Species: typeof Species;
    readonly Format: typeof Format;
    readonly ModdedDex: typeof ModdedDex;
    readonly name = "[ModdedDex]";
    readonly isBase: boolean;
    readonly currentMod: string;
    readonly toID: typeof Data.toID;
    readonly formats: DexFormats;
    readonly abilities: DexAbilities;
    readonly items: DexItems;
    readonly moves: DexMoves;
    readonly species: DexSpecies;
    readonly learnsets: DexLearnsets;
    readonly conditions: DexConditions;
    readonly natures: Data.DexNatures;
    readonly types: Data.DexTypes;
    readonly stats: Data.DexStats;
    readonly aliases: Map<ID, ID> | null;
    gen: number;
    parentMod: string;
    modsLoaded: boolean;
    dataCache: DexTableData | null;
    deepClone: typeof Utils.deepClone;
    deepFreeze: typeof Utils.deepFreeze;
    Multiset: typeof Utils.Multiset;
    constructor(mod?: string);
    get modid(): ID;
    get data(): DexTableData;
    get dexes(): {
        [mod: string]: ModdedDex;
    };
    mod(mod: string | undefined, modData?: DeepPartial<ModdedDex['data']> & {
        Formats?: FormatList;
    }): ModdedDex;
    forGen(gen: number): ModdedDex;
    forFormat(format: Format | string): ModdedDex;
    modData(dataType: DataType, id: string): any;
    effectToString(): string;
    /**
     * Sanitizes a username or Pokemon nickname
     *
     * Returns the passed name, sanitized for safe use as a name in the PS
     * protocol.
     *
     * Such a string must uphold these guarantees:
     * - must not contain any ASCII whitespace character other than a space
     * - must not start or end with a space character
     * - must not contain any of: | , [ ]
     * - must not be the empty string
     * - must not contain Unicode RTL control characters
     *
     * If no such string can be found, returns the empty string. Calling
     * functions are expected to check for that condition and deal with it
     * accordingly.
     *
     * getName also enforces that there are not multiple consecutive space
     * characters in the name, although this is not strictly necessary for
     * safety.
     */
    getName(name: any): string;
    /**
     * Returns false if the target is immune; true otherwise.
     * Also checks immunity to some statuses.
     */
    getImmunity(source: {
        type: string;
    } | string, target: {
        getTypes: () => string[];
    } | {
        types: string[];
    } | string[] | string): boolean;
    getEffectiveness(source: {
        type: string;
    } | string, target: {
        getTypes: () => string[];
    } | {
        types: string[];
    } | string[] | string): number;
    getDescs(table: keyof typeof TEXT, id: ID, dataEntry: AnyObject): {
        desc: any;
        shortDesc: any;
    } | null;
    /**
     * Ensure we're working on a copy of a move (and make a copy if we aren't)
     *
     * Remember: "ensure" - by default, it won't make a copy of a copy:
     *     moveCopy === Dex.getActiveMove(moveCopy)
     *
     * If you really want to, use:
     *     moveCopyCopy = Dex.getActiveMove(moveCopy.id)
     */
    getActiveMove(move: Move | string): ActiveMove;
    getHiddenPower(ivs: StatsTable): {
        type: string;
        power: number;
    };
    /**
     * Truncate a number into an unsigned 32-bit integer, for
     * compatibility with the cartridge games' math systems.
     */
    trunc(num: number, bits?: number): number;
    loadDataFile(mod: string, dataType: DataType, modData?: DeepPartial<ModdedDex['data']>): AnyObject | void;
    getAlias(id: ID): ID | undefined;
    loadAliases(): NonNullable<ModdedDex['aliases']>;
    includeMods(): this;
    includeModData(): this;
    includeData(): this;
    loadData(modData?: DeepPartial<ModdedDex['data']>): DexTableData;
    includeFormats(): this;
}
export declare const Dex: ModdedDex;
export declare namespace Dex {
    type Species = import('./dex-species').Species;
    type Item = import('./dex-items').Item;
    type Move = import('./dex-moves').Move;
    type Ability = import('./dex-abilities').Ability;
    type HitEffect = import('./dex-moves').HitEffect;
    type SecondaryEffect = import('./dex-moves').SecondaryEffect;
    type RuleTable = import('./dex-formats').RuleTable;
}
export { RuleTable };
