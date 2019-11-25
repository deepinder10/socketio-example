"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const crypto_1 = require("crypto");
const fs = require("fs");
const path = require("path");
const source_map_1 = require("source-map");
const terser_1 = require("terser");
const typescript_1 = require("typescript");
const webpack_sources_1 = require("webpack-sources");
const mangle_options_1 = require("./mangle-options");
const cacache = require('cacache');
let cachePath;
function setup(options) {
    cachePath = options.cachePath;
}
exports.setup = setup;
async function cachePut(content, key, integrity) {
    if (cachePath && key) {
        await cacache.put(cachePath, key, content, {
            metadata: { integrity },
        });
    }
}
async function process(options) {
    if (!options.cacheKeys) {
        options.cacheKeys = [];
    }
    const result = { name: options.name };
    if (options.integrityAlgorithm) {
        // Store unmodified code integrity value -- used for SRI value replacement
        result.integrity = generateIntegrityValue(options.integrityAlgorithm, options.code);
    }
    // Runtime chunk requires specialized handling
    if (options.runtime) {
        return { ...result, ...(await processRuntime(options)) };
    }
    const basePath = path.dirname(options.filename);
    const filename = path.basename(options.filename);
    const downlevelFilename = filename.replace('es2015', 'es5');
    const downlevel = !options.optimizeOnly;
    // if code size is larger than 1 MB, manually handle sourcemaps with newer source-map package.
    const codeSize = Buffer.byteLength(options.code);
    const mapSize = options.map ? Buffer.byteLength(options.map) : 0;
    const manualSourceMaps = codeSize >= 1024 * 1024 || mapSize >= 1024 * 1024;
    const sourceCode = options.code;
    const sourceMap = options.map ? JSON.parse(options.map) : undefined;
    let downlevelCode;
    let downlevelMap;
    if (downlevel) {
        // Downlevel the bundle
        const transformResult = typescript_1.transpileModule(sourceCode, {
            fileName: downlevelFilename,
            compilerOptions: {
                sourceMap: !!sourceMap,
                target: typescript_1.ScriptTarget.ES5,
            },
        });
        downlevelCode = transformResult.outputText;
        if (sourceMap && transformResult.sourceMapText) {
            if (manualSourceMaps) {
                downlevelMap = await mergeSourcemaps(sourceMap, JSON.parse(transformResult.sourceMapText));
            }
            else {
                // More accurate but significantly more costly
                const tempSource = new webpack_sources_1.SourceMapSource(transformResult.outputText, downlevelFilename, JSON.parse(transformResult.sourceMapText), sourceCode, sourceMap);
                downlevelMap = tempSource.map();
            }
        }
    }
    if (options.optimize) {
        if (downlevelCode) {
            const minifyResult = terserMangle(downlevelCode, {
                filename: downlevelFilename,
                map: downlevelMap,
                compress: true,
            });
            downlevelCode = minifyResult.code;
            downlevelMap = minifyResult.map;
        }
        if (!options.ignoreOriginal) {
            result.original = await mangleOriginal(options);
        }
    }
    if (downlevelCode) {
        const downlevelPath = path.join(basePath, downlevelFilename);
        let mapContent;
        if (downlevelMap) {
            if (!options.hiddenSourceMaps) {
                downlevelCode += `\n//# sourceMappingURL=${downlevelFilename}.map`;
            }
            mapContent = JSON.stringify(downlevelMap);
            await cachePut(mapContent, options.cacheKeys[3 /* DownlevelMap */]);
            fs.writeFileSync(downlevelPath + '.map', mapContent);
        }
        result.downlevel = createFileEntry(downlevelFilename, downlevelCode, mapContent, options.integrityAlgorithm);
        await cachePut(downlevelCode, options.cacheKeys[2 /* DownlevelCode */], result.downlevel.integrity);
        fs.writeFileSync(downlevelPath, downlevelCode);
    }
    // If original was not processed, add info
    if (!result.original && !options.ignoreOriginal) {
        result.original = createFileEntry(options.filename, options.code, options.map, options.integrityAlgorithm);
    }
    return result;
}
exports.process = process;
async function mergeSourcemaps(first, second) {
    const sourceRoot = first.sourceRoot;
    const generator = new source_map_1.SourceMapGenerator();
    // sourcemap package adds the sourceRoot to all position source paths if not removed
    delete first.sourceRoot;
    await source_map_1.SourceMapConsumer.with(first, null, originalConsumer => {
        return source_map_1.SourceMapConsumer.with(second, null, newConsumer => {
            newConsumer.eachMapping(mapping => {
                if (mapping.originalLine === null) {
                    return;
                }
                const originalPosition = originalConsumer.originalPositionFor({
                    line: mapping.originalLine,
                    column: mapping.originalColumn,
                });
                if (originalPosition.line === null ||
                    originalPosition.column === null ||
                    originalPosition.source === null) {
                    return;
                }
                generator.addMapping({
                    generated: {
                        line: mapping.generatedLine,
                        column: mapping.generatedColumn,
                    },
                    name: originalPosition.name || undefined,
                    original: {
                        line: originalPosition.line,
                        column: originalPosition.column,
                    },
                    source: originalPosition.source,
                });
            });
        });
    });
    const map = generator.toJSON();
    map.file = second.file;
    map.sourceRoot = sourceRoot;
    // Put the sourceRoot back
    if (sourceRoot) {
        first.sourceRoot = sourceRoot;
    }
    return map;
}
async function mangleOriginal(options) {
    const result = terserMangle(options.code, {
        filename: path.basename(options.filename),
        map: options.map ? JSON.parse(options.map) : undefined,
        ecma: 6,
    });
    let mapContent;
    if (result.map) {
        if (!options.hiddenSourceMaps) {
            result.code += `\n//# sourceMappingURL=${path.basename(options.filename)}.map`;
        }
        mapContent = JSON.stringify(result.map);
        await cachePut(mapContent, (options.cacheKeys && options.cacheKeys[1 /* OriginalMap */]) || null);
        fs.writeFileSync(options.filename + '.map', mapContent);
    }
    const fileResult = createFileEntry(options.filename, result.code, mapContent, options.integrityAlgorithm);
    await cachePut(result.code, (options.cacheKeys && options.cacheKeys[0 /* OriginalCode */]) || null, fileResult.integrity);
    fs.writeFileSync(options.filename, result.code);
    return fileResult;
}
function terserMangle(code, options = {}) {
    // Note: Investigate converting the AST instead of re-parsing
    // estree -> terser is already supported; need babel -> estree/terser
    // Mangle downlevel code
    const minifyOutput = terser_1.minify(code, {
        compress: options.compress || false,
        ecma: options.ecma || 5,
        mangle: !mangle_options_1.manglingDisabled,
        safari10: true,
        output: {
            ascii_only: true,
            webkit: true,
        },
        sourceMap: !!options.map &&
            {
                filename: options.filename,
                // terser uses an old version of the sourcemap typings
                // tslint:disable-next-line: no-any
                content: options.map,
                asObject: true,
            },
    });
    if (minifyOutput.error) {
        throw minifyOutput.error;
    }
    // tslint:disable-next-line: no-non-null-assertion
    return { code: minifyOutput.code, map: minifyOutput.map };
}
function createFileEntry(filename, code, map, integrityAlgorithm) {
    return {
        filename: filename,
        size: Buffer.byteLength(code),
        integrity: integrityAlgorithm && generateIntegrityValue(integrityAlgorithm, code),
        map: !map
            ? undefined
            : {
                filename: filename + '.map',
                size: Buffer.byteLength(map),
            },
    };
}
function generateIntegrityValue(hashAlgorithm, code) {
    return (hashAlgorithm +
        '-' +
        crypto_1.createHash(hashAlgorithm)
            .update(code)
            .digest('base64'));
}
// The webpack runtime chunk is already ES5.
// However, two variants are still needed due to lazy routing and SRI differences
// NOTE: This should eventually be a babel plugin
async function processRuntime(options) {
    let originalCode = options.code;
    let downlevelCode = options.code;
    // Replace integrity hashes with updated values
    if (options.integrityAlgorithm && options.runtimeData) {
        for (const data of options.runtimeData) {
            if (!data.integrity) {
                continue;
            }
            if (data.original && data.original.integrity) {
                originalCode = originalCode.replace(data.integrity, data.original.integrity);
            }
            if (data.downlevel && data.downlevel.integrity) {
                downlevelCode = downlevelCode.replace(data.integrity, data.downlevel.integrity);
            }
        }
    }
    // Adjust lazy loaded scripts to point to the proper variant
    // Extra spacing is intentional to align source line positions
    downlevelCode = downlevelCode.replace('"-es2015.', '   "-es5.');
    const downlevelFilePath = options.filename.replace('es2015', 'es5');
    let downlevelMap;
    let result;
    if (options.optimize) {
        const minifiyResults = terserMangle(downlevelCode, {
            filename: path.basename(downlevelFilePath),
            map: options.map === undefined ? undefined : JSON.parse(options.map),
        });
        downlevelCode = minifiyResults.code;
        downlevelMap = JSON.stringify(minifiyResults.map);
        result = {
            original: await mangleOriginal({ ...options, code: originalCode }),
            downlevel: createFileEntry(downlevelFilePath, downlevelCode, downlevelMap, options.integrityAlgorithm),
        };
    }
    else {
        if (options.map) {
            const rawMap = JSON.parse(options.map);
            rawMap.file = path.basename(downlevelFilePath);
            downlevelMap = JSON.stringify(rawMap);
        }
        result = {
            original: createFileEntry(options.filename, originalCode, options.map, options.integrityAlgorithm),
            downlevel: createFileEntry(downlevelFilePath, downlevelCode, downlevelMap, options.integrityAlgorithm),
        };
    }
    if (downlevelMap) {
        await cachePut(downlevelMap, (options.cacheKeys && options.cacheKeys[3 /* DownlevelMap */]) || null);
        fs.writeFileSync(downlevelFilePath + '.map', downlevelMap);
        downlevelCode += `\n//# sourceMappingURL=${path.basename(downlevelFilePath)}.map`;
    }
    await cachePut(downlevelCode, (options.cacheKeys && options.cacheKeys[2 /* DownlevelCode */]) || null);
    fs.writeFileSync(downlevelFilePath, downlevelCode);
    return result;
}
