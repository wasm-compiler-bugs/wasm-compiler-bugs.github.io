import fs from 'fs';
import {promisify} from 'util';
import axios from 'axios';
import {resolve, basename, dirname} from 'path';
import { MySQLConnector } from "./MySQLConnector";
import { CommitFile, CommitResponse } from './types';

const mkdir = promisify(fs.mkdir);

export class FileDownloader {
    private DOWNLOAD_PATH = resolve(__dirname, 'DownloadedFiles');
    private DB = new MySQLConnector();
    argv: any;

    constructor(args:any, downloadPath?:string){
        this.argv = args;
        this.DOWNLOAD_PATH = downloadPath ?? this.DOWNLOAD_PATH;
    }

    private async makeFilePath(filePath: string): Promise<void>{
        try{
            const basedir = dirname(filePath);
            await mkdir(basedir, {recursive: true});
        } catch(mkdirError){
            console.log('Mkdir error', mkdir);
        }
    }

    generateFilePath(commitSHA:string, commitFileDetails: CommitFile): string{
        const {filename} = commitFileDetails;
        const pathname = resolve(this.DOWNLOAD_PATH, commitSHA, filename);
        return pathname;
    }

    private downloadFile(fileURL: string, destination: string): Promise<void>{
        return axios({
            method: "get",
            url: fileURL,
            responseType: "stream"
        })
        .then(function (response) {
            response.data.pipe(fs.createWriteStream(destination));
        });
    }

    static async downloadFileAsBuffer(fileURL: string){
        const result = await axios({
            method: "get",
            url: fileURL,
            responseType: "arraybuffer"
        });
        return result.data as Buffer;
            
    }

    static async downloadFileAsText(fileURL: string){
        const result = await axios({
            method: "get",
            url: fileURL,
            responseType: "text"
        });
        return result.data as string;
            
    }

    async handleCommitFileReference(commitSHA:string, commitFileDetails: CommitFile): Promise<string>{
        let filePath = this.generateFilePath(commitSHA, commitFileDetails);
        
        try{
            //try to see if file is already downloaded
            await fs.promises.access(filePath); 
            return filePath
        } catch(err){
            console.log(`File ${commitFileDetails.filename} is not saved. Downloading...`);
        }

        try{
            await this.makeFilePath(filePath);
            const fileURL = commitFileDetails.raw_url;
            if(fileURL !== null){
                await this.downloadFile(fileURL, filePath);
            }
            return filePath;
        } catch(sqlError){
            console.log('Error Downloading: ', commitSHA,commitFileDetails.raw_url);
            console.error('Handle Commit Error', sqlError)
            return '';
        }
    }

    async downloadCommitFiles(){
        const commits = await this.DB.getBugCommits();
        let seenLast = false;
        for(const commit of commits){
            const {ID,SHA,IssueID, RawResponse} = commit;
            if(ID == 181){
                seenLast = true;
            }
            if(!seenLast){
                continue;
            }
            const parsedResponse : CommitResponse = JSON.parse(RawResponse);
            const commitFiles = parsedResponse.files;
            console.log(`On Commit ID ${ID} From IssueID ${IssueID}`);
            for(const commitFile of commitFiles){
                await this.handleCommitFileReference(SHA,commitFile);
            }
        }

        this.DB.close();
    } 
    
}