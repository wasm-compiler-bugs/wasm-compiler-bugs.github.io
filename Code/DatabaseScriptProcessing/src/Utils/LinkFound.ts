import sloc from 'sloc';
import fetch, { Response } from 'node-fetch';
import cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import {gzip, ungzip} from 'node-gzip';
import tar from 'tar-stream';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import {promisify } from 'util';
import { TestCaseCodeSnippet } from '../types';

const writeFile = promisify(fs.writeFile);
const SAVE_PATH = path.resolve(__dirname, '..', 'DownloadedFiles')


export class LinkFound implements TestCaseCodeSnippet {
    URL: string;
    FileExtension?: string;
    LinesOfCode: number = 0;
    NumberOfFilesUsed: number = 0;
    Name?: string;
    CodeText: string = '';
    wabt: any;
    Owner: string = '';
    Repo: string = '';

    toJSON() {
        return Object.getOwnPropertyNames(this).reduce((a, b) => {
            //@ts-ignore
            a[b] = this[b];
            return a;
        }, {});
    }

    constructor(url: string, extension: string, owner: string, repo: string, filename?: string){
        this.URL = url;
        this.FileExtension = extension;
        this.Name = filename;
        try{
            this.wabt = require("wabt")()
        }
        catch(wabtErr){
            console.log('WAbt Error')
        }
        this.Owner = owner;
        this.Repo = repo;
    }

    async handleZip(zipBuffer: Buffer){
        try{
            const zip = new AdmZip(zipBuffer);
            const zipEntries = zip.getEntries();
            for(const zipEntry of zipEntries){
                if(!zipEntry.isDirectory){
                    const acceptableExtensions =  ['js','html','wat','c','h','cpp','cc','hpp', 'go', 'mod',
                    'rs', 'wast', 'hs', 'mjs', 'py', 'ts'];
                    const fileExtension = this.getFileExtension(zipEntry.name);
                    if(acceptableExtensions.includes(fileExtension)){
                        const unzippedFileBuffer = zipEntry.getData();
                        await this.handleTextFiles(unzippedFileBuffer, fileExtension)
                    }
                }
            }
        } catch(zipError){
            console.error('Zip Error',zipError);
        }
        
    }

    async handleGZ(gzipBuffer: Buffer){
        try{
            const decompressed = await ungzip(gzipBuffer);
            const acceptableExtensions =  ['js','html','wat','c','h','cpp','cc','hpp', 'go', 'mod',
                    'rs', 'wast', 'hs', 'mjs', 'py', 'ts'];
            if(this.Name){
                const filenameWithoutGZ = this.Name.substring(0, this.Name.lastIndexOf('.'));
                const uncompressedFileExtension = this.getFileExtension(filenameWithoutGZ);
                if(acceptableExtensions.includes(uncompressedFileExtension)){
                    await this.handleTextFiles(decompressed, uncompressedFileExtension);
                }
            }
        } catch(gzipError){
            console.error('Gzip Error', gzipError)
        }
    }

    async handleGist(){
        //https://gist.github.com/vird/a467005edc2f54204785f76e4e2f23a8 -> document.querySelector("div.file-header > div.file-actions > a")
        try{
            const response = await fetch(this.URL);
            const responseString = await response.text()
            const $ = cheerio.load(responseString);
            const interestedCodeSnippetLink = $("div.file-header > div.file-actions > a").attr('href')
            const gistContentBaseURL = 'https://gist.githubusercontent.com';
            const gistURL = `${gistContentBaseURL}${interestedCodeSnippetLink}`;
            const filename = this.getFileNameInURL(gistURL);
            const fileExtension = this.getFileExtension(filename);
            this.URL = gistURL;
            this.FileExtension = fileExtension;
            this.Name = filename;
            await this.scanLink();
        } catch(gistError){
            console.error('Handle Gist Error', gistError)
        }
    }
    getFileNameInURL(url: string){
        let filenameInURL = url.substring(url.lastIndexOf('/') + 1)
        return filenameInURL;
    }

    getFileExtension(filename: string): string{
        let fileExtension = '';
        if(filename.includes('.') ){
            const filenameSplit = filename.split(".")
            fileExtension = filenameSplit[filenameSplit.length - 1];
        }
        return fileExtension
    }
    // ['js','html','wasm','wat','c','h','cpp','hpp', 'go', 
    // 'rs', 'wast', 'txt', 'log', 'hs', 'mjs', 'py', 'ts',
    // 'zip','gz'];

    countNewlines(fileString: string){
        let lineCount = 0;
        let idx = -1;
        lineCount--; // Because the loop will run once for idx=-1
        do {
            idx = fileString.indexOf('\n', idx+1);
            lineCount++;
        } while (idx !== -1);
        return lineCount;
    }

    async handleTextFiles(fileBuffer: Buffer | string, fileExtension: string){
        let fileAsString: string;
        if(typeof(fileBuffer) != 'string'){
            fileAsString = fileBuffer.toString('utf8');
        } else {
            fileAsString = fileBuffer;
        }

        let linesInFile = 0;
        try{
            const slocObject = sloc(fileAsString, fileExtension);
            linesInFile = slocObject.total;
            this.NumberOfFilesUsed += 1;
            this.CodeText += ('\n' + fileAsString + '\n' )

        } catch(textError){
            if(textError.name == 'TypeError'){
                //SLoc can't handle, just count newlines
                linesInFile = this.countNewlines(fileAsString);
                this.NumberOfFilesUsed += 1;
                this.CodeText +=  ('\n' + fileAsString + '\n' )
        } else{
                console.error('Handle Text error', textError)
            }
        }
        this.LinesOfCode += linesInFile;
        return linesInFile;
    }    



    getFilesFromTar(tarBuffer: Buffer): Promise<{filename: string, buffer: Buffer}[]> {
        return new Promise( (resolve, reject) => {
            const filesToCheck : {filename: string, buffer: Buffer}[] = [];
            try{
                const extract = tar.extract()
                const newStream = new Readable({
                    read() {
                        this.push(tarBuffer);
                    },
                });
        
                extract.on('entry', function(header, stream, next) {
                    let fileBuffer: any[] = []
                    stream.on('data', function(d){ fileBuffer.push(d); });
                    stream.on('end', function() {
                        var buf = Buffer.concat(fileBuffer);
                        const filesData = {filename: header.name, buffer: buf};
                        filesToCheck.push(filesData);
                        next(); 
                    })
                  stream.resume() 
                });
                extract.on('finish', function() {
                  // all entries read
                    resolve(filesToCheck);
                });
        
                newStream.pipe(extract);
            } catch(tarFileError){
                reject(filesToCheck)
            }
        })

    }
    
    async handleTar(tarBuffer: Buffer){
        const files = await this.getFilesFromTar(tarBuffer);
        for(const tarredFile of files){
            const filename = this.getFileNameInURL(tarredFile.filename);
            const fileExtension = this.getFileExtension(filename);
            await this.handleTextFiles(tarredFile.buffer, fileExtension);
        }
        return files;
    }
    
    async handleWasmBuffer(wasmBuffer: Buffer){
        try{
            const myModule = this.wabt.readWasm(wasmBuffer, { readDebugNames: true });
            myModule.applyNames();
            const wast = myModule.toText({ foldExprs: false, inlineExport: false });
            this.handleTextFiles(wast, '.wat')
        }catch(wasmError){
            console.error('Handle Wasm Error', wasmError)
        }
        
    }

    async saveFileToDisk(response: Response): Promise<Buffer>{
        const fileBuffer = await response.buffer()
        const responseURL = response.url;
        try{
            const responseName = responseURL.substr(responseURL.lastIndexOf('/') + 1);
            const targetDir = path.resolve(SAVE_PATH, responseName);
            await writeFile(targetDir, fileBuffer);
        }
        catch(saveError){
            console.error(responseURL, saveError);
        }
        return fileBuffer;
    }

    convertGitHubBlobURLToRawURL(githubBlobURL: string): string {
        const blobPattern = '/blob/'
        if(!githubBlobURL.includes(blobPattern)){
            return githubBlobURL;
        }

        const rawURL = githubBlobURL.replace(blobPattern, '/')
                        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        
        this.URL = rawURL;
        return rawURL;
    }

    async scanLink(): Promise<void>{
        try{
            const urlToScan = this.convertGitHubBlobURLToRawURL(this.URL)
            const fetchResult = await fetch(urlToScan, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.92 Safari/537.36 Edg/81.0.416.53'
                    }
                });
            const result = await this.saveFileToDisk(fetchResult);
            if(this.FileExtension){
                switch(this.FileExtension){
                    case 'wasm': {
                        await this.handleWasmBuffer(result);
                    }
                    break;
                    case 'zip': {
                        await this.handleZip(result)
                    }
                    break;
                    case 'gz': {
                        await this.handleGZ(result);
                    }
                    break;
                    case 'tar': {
                        console.log('Found tar file');
                        await this.handleTar(result);
                    }
                    break;
                    default: {
                        await this.handleTextFiles(result, this.FileExtension)
                    }
                    break;
                }
            }
        } catch(scanError){
            console.error('Scanning error', this.URL, scanError);
        }
    }

}