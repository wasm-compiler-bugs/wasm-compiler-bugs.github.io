import path from 'path';
import fs from 'fs';
import {promisify } from 'util';
import { raw } from 'mysql';
import { TestCaseCodeSnippet } from '../types';
const SAVE_PATH = path.resolve(__dirname, '..', 'DownloadedFiles');

export class CodeSnippet implements TestCaseCodeSnippet {
    Type?: string;
    CodeText: string;
    LinesOfCode: number;
    Owner: string;
    Repo:string;


    toJSON() {
        return Object.getOwnPropertyNames(this).reduce((a, b) => {
            //@ts-ignore
            a[b] = this[b];
            return a;
        }, {});
    }

    constructor(codeText: string, codeType: string | undefined, owner: string, repo: string){
        this.Type = codeType;
        this.CodeText = codeText;
        this.LinesOfCode = this.getLinesOfCodeCountFromSnippet(codeText);
        this.Owner = owner;
        this.Repo = repo;
        try{
            this.saveSnippetToDisk();
        } catch(e) {
        }
    }

    saveSnippetToDisk(){
        const randomString= [...Array(8)].map(i=>(~~(Math.random()*36)).toString(36)).join('');
        const outputName = `${this.Owner}_${this.Repo}_${randomString}.${this.Type}`;
        const targetDir = path.resolve(SAVE_PATH, outputName);
        try{
            fs.writeFileSync(targetDir, this.CodeText, {encoding: 'utf8'});
        }
        catch(e){
            console.error(e)
        }
    }

    getLinesOfCodeCountFromSnippet(codeSnippetText: string): number{
        let linesOfCodeCount = 0;
        const linesOfCode = codeSnippetText.trim().split('\n');
        linesOfCodeCount = linesOfCode.length;
        return linesOfCodeCount;
    }

}