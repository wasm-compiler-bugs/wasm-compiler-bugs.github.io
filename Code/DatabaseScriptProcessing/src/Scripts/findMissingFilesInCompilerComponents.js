const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

(async () => {
    const oldComponentFile = JSON.parse(await readFile('./compilerComponents.json', {encoding: 'utf8'}));
    const compilerFiles = {
        "emscripten": new Set(),
        "binaryen": new Set(),
        "tinygo": new Set(),
        "asterius": new Set(),
        "wasm-bindgen": new Set(),
        "AssemblyScript": new Set()
    }

    for(const compiler in oldComponentFile){
        const compilerComponents = oldComponentFile[compiler];
        for(const component in compilerComponents){
            const componentFiles = compilerComponents[component];
            for(const file of componentFiles){
                compilerFiles[compiler].add(file);
            }
        }
    }

    const allFiles = JSON.parse(await readFile('../../repoFilesChanges.json', {encoding: 'utf8'}));

    const missingFiles = {
        "emscripten": new Set(),
        "binaryen": new Set(),
        "tinygo": new Set(),
        "asterius": new Set(),
        "wasm-bindgen": new Set(),
        "AssemblyScript": new Set()
    }
    for(const compiler in allFiles){
        const filesInCompiler = allFiles[compiler];
        for(const file of filesInCompiler){
            
            if(!compilerFiles[compiler].has(file)){
                missingFiles[compiler].add(file)
            }
        }
    }
    const outputJSON = {}
    for(const compiler in missingFiles){
        outputJSON[compiler] = [...missingFiles[compiler].values()].sort()
                                // .filter( (file) => 
                                //             !file.includes('test/') 
                                //             && !file.includes('tests/') 
                                //             && !file.includes('examples/')
                                //             && !file.endsWith('.md')
                                //             && !file.endsWith('.txt')
                                //             && !file.endsWith('.map')
                                //             && !file.endsWith('.yaml')
                                //         )
    }

    await writeFile('../../missingCompilerComponents.json', JSON.stringify(outputJSON));

})()