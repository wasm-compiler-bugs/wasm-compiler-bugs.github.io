import { TestCaseCodeSnippet } from '../types';
const currentWabt = require("wabt");
const legacyWabt = require("wabt-legacy");

export class WasmInstructionCounter {
    Filename: string;
    CodeString?: string;
    Binary?: Buffer;
    LatestWabt?: any;
    LegacyWabt?: any;
    static WABT_FEATURES = {
        exceptions: true,
        mutable_globals: true,
        sat_float_to_int: true,
        sign_extension: true,
        simd: true,
        threads: true,
        multi_value: true,
        tail_call: true,
        bulk_memory: true,
        reference_types: true,
        annotations: true
    };
    private LinesOfCode: number = 0;

    constructor(filename:string, wasmBuffer?: Buffer, codeText?: string){
        this.Filename = filename;
        this.Binary = wasmBuffer;
        this.CodeString = codeText;
    }

    initializeWabt(){
        if(!this.LatestWabt){
            try{
                currentWabt().then((wabt: any) => {
                    this.LatestWabt = wabt;
                })
            }
            catch(wabtErr){
                console.log('WAbt Error')
            }
        }
        
        if(!this.LegacyWabt){
            this.LegacyWabt = legacyWabt();
        }
    }

    getLinesOfCode(){
        return this.LinesOfCode;
    }
    async convertToText(){
        this.initializeWabt();
        if(this.Binary != undefined){
            const uint8Array = Uint8Array.from(this.Binary)
            try{
                const wabtModule =  this.LatestWabt.readWasm(uint8Array, {
                    ...WasmInstructionCounter.WABT_FEATURES,
                    readDebugNames: true
                });
                wabtModule.generateNames();
                wabtModule.resolveNames();
                wabtModule.applyNames();
                let wast: string | number = wabtModule.toText({ foldExprs: false, inlineExport: false });
                if(typeof wast === 'number'){
                    wast = wast.toString()
                } 
                this.CodeString = wast;
                wabtModule.destroy();
                return this.CodeString
            }catch(wasmError){
                try {
                    const wabtModule =  this.LegacyWabt.readWasm(uint8Array, {
                        ...WasmInstructionCounter.WABT_FEATURES,
                        readDebugNames: true
                    });
                    wabtModule.generateNames();
                    wabtModule.resolveNames();
                    wabtModule.applyNames();
                    let wast: string | number = wabtModule.toText({ foldExprs: false, inlineExport: false });
                    if(typeof wast === 'number'){
                        wast = wast.toString()
                    } 
                    wabtModule.destroy();
                    return this.CodeString;
                } catch(legacyWabtError){
                    console.error('Convert to Text: ', legacyWabtError)
                }
                return null
            }
        }
    }

    async readInstructions(){

        if(this.Binary){
            const resultString = await this.convertToText();
            if(resultString == null){
                return null;
            }
        }
        const instructionCounts = new Map<string, number>();
        if(this.CodeString == null ){
            return null;
        }

        const functionsTextLines = this.CodeString.split('\n');
        this.LinesOfCode = functionsTextLines.length;
        const functionsText = functionsTextLines
                                        .map(line => line.trim())
                                        .filter(line => !(line.startsWith('(import')
                                                        || line.startsWith('(export')
                                                        || line.startsWith('(type')
                                                        || line.startsWith('(global')
                                                        || line.startsWith('(data')
                                                        || line.startsWith('(elem')
                                                        || line.startsWith('(table')
                                                        || line.startsWith('(table')
                                                        || line.startsWith('(memory')
                                                        || line.startsWith('(start')
                                                        || line.startsWith('(module')
                                                        || line.startsWith(';;')
                                                        
                                                        )
                                        )
                                        .join('\n');
        const functionSplits = functionsText.split('(func')
                                            .filter(splitPiece => splitPiece !== '' )
                                            .map(functionPiece => '(func' + functionPiece);

        for(const functionSplit of functionSplits){
            const functionLines = functionSplit.split('\n');
            for(const line of functionLines){
                if(line.startsWith('(func') || line.startsWith('(local') || line.startsWith('"')  || line == ''){
                    continue 
                }
                const instructionPieces = line.split(' ');
                const instruction = instructionPieces[0].replace('(', '').replace(')', '');
                if(instruction == ''){
                    continue;
                }
                const instructionCount = instructionCounts.get(instruction)
                if(instructionCount){
                    instructionCounts.set(instruction, instructionCount + 1)
                } else {
                    instructionCounts.set(instruction, 1)
                }
            }
        }
        return instructionCounts
    }
}