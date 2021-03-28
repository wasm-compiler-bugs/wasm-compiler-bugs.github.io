import { MySQLConnector } from "./MySQLConnector";
import {GitHubCrawler} from './GithubCrawler';
import {CodeSnippet} from './Utils/CodeSnippet';
import {FileDownloader} from './FileDownloader';
import GitPatch from './Utils/GitPatch';
import { writeFile, readFile as _readfile, fstat } from "fs";
import {promisify} from 'util';
import { LinkFound } from "./Utils/LinkFound";
import getUrls from 'get-urls';
import path from 'path';
import { FunctionDeclaration } from "./Utils/FunctionDeclaration";
import { EventData, DBCommit, DBIssue, CommitResponse, CommitFile, FileVersionResponse, GitHubCommit, DBRawCommit } from "./types";
import ChangeDetails from "./Utils/ChangeDetails";
import { WasmInstructionCounter } from "./Utils/WasmInstructionCounter";

enum Language{
    C = 'C',
    TS = 'TS',
    RUST ='RUST',
    PYTHON = 'PYTHON',
    GO = 'GO',
    HASKELL = 'HASKELL'
}

function strMapToObj(strMap: Map<any,any>) {
    let obj: any = {};
    for (let [k,v] of strMap) {
        obj[k] = v;
    }
    return obj;
}

const writeFileAsync = promisify(writeFile);
const readFile = promisify(_readfile);
const MAX_RECURSION_DEPTH: number = 4;
const AUTO_CLOSED_GITHUB_MESSAGE = `This issue has been automatically marked as stale because there has been no activity in the past year.`;
export class GitHubInfoProcessor{
    DB = new MySQLConnector();
    argv: any;
    crawler: GitHubCrawler;
    issuesAutomaticallyClosed: number[] = [];
    unacceptedExtensions: Set<string> = new Set();
    constructor(args:any){
        this.argv = args;
        this.crawler = new GitHubCrawler(this.argv);
    }

    close(){
        this.DB.close();
        this.crawler.close();
    }

    private async fetchCommitForSHA(owner:string,repo:string,issueId:number,commitSHA:string ,timelineEvent:EventData, commitURL?: string): Promise<DBCommit | null>{
        let lastCommit: DBCommit | null = null;
        lastCommit = await this.DB.getCommitBySHA(commitSHA);

        if(lastCommit == null){
            let commitDetails;
            if(commitURL){
                commitDetails = await this.crawler.getCommitInfoFromCommitURL(commitURL);
            } else {
                commitDetails = await this.crawler.getCommitInfo(owner,repo,commitSHA);
            }
            if(commitDetails == null ){
                return null
            }
            const commitMessage = commitDetails.commit.message;
            const eventStatus = timelineEvent.event;
            await this.DB.insertCommitIntoDB(commitSHA,issueId,commitMessage,commitDetails,timelineEvent, eventStatus);
            lastCommit = await this.DB.getCommitBySHA(commitSHA);
        }

        return lastCommit;
    }

    private async findLastCommitBeforeClosing(issue: DBIssue, recursionDepth :number = 0): Promise<DBCommit | null>{
        if(recursionDepth > MAX_RECURSION_DEPTH){
            return null;
        }
        const {ID,Owner,Repo, TimelineResponse} = issue;
        let parsedEvents: EventData[] = TimelineResponse;
        let lastCommit: DBCommit | null = null;
        let seenClosedEvent = false;
        if(parsedEvents != null){
            parsedEvents = parsedEvents.reverse();
            for(const eventDetail of parsedEvents){
                const eventStatus = eventDetail.event;
                if(['closed'].includes(eventStatus)){
                    seenClosedEvent = true;
                }
                if(seenClosedEvent){
                    if(eventStatus == 'commented'){
                        if(eventDetail.body?.includes(AUTO_CLOSED_GITHUB_MESSAGE)){
                            this.issuesAutomaticallyClosed.push(ID);
                        }
                    }

                    if(eventStatus === 'committed'){
                        const commitSHA = eventDetail.sha;
                        if(commitSHA !== undefined){
                            lastCommit = await this.fetchCommitForSHA(Owner,Repo, ID, commitSHA, eventDetail);
                        }
                        break;
                    }
                    else if(eventStatus === 'merged' || eventStatus === 'referenced' || eventStatus == 'reviewed'){
                        const commitSHA = eventDetail.commit_id;
                        const commitURL = eventDetail.commit_url;
                        if(commitSHA !== undefined){
                            lastCommit = await this.fetchCommitForSHA(Owner,Repo, ID, commitSHA, eventDetail, commitURL);
                        }
                        if(lastCommit != null){
                            break;
                        }
                    }
                    else if(eventStatus == 'cross-referenced'){
                        if(eventDetail.source){
                            const lastIssue = eventDetail.source.issue;
                            if(lastIssue != null){
                                const dbIssueForlastIssue = await this.DB.getIssueFromBugID(lastIssue.id);
                                if(dbIssueForlastIssue !== null){
                                    lastCommit = await this.findLastCommitBeforeClosing(dbIssueForlastIssue, recursionDepth + 1);
                                }
                            }
                        }
                        if(lastCommit != null){
                            break;
                        }
                    }
                    else if(eventDetail.commit_id && eventDetail.commit_url){
                        const commitSHA = eventDetail.commit_id;
                        const commitURL = eventDetail.commit_url;
                        lastCommit = await this.fetchCommitForSHA(Owner,Repo, ID, commitSHA, eventDetail, commitURL);
                    }

                }
            }
        }

        return lastCommit;
    }

    private getEventChain(issue: DBIssue): string[] {
        const {ID, TimelineResponse} = issue;
        const parsedEvents: EventData[] = TimelineResponse;
        let chainedEvents:string[] = [];
        if(parsedEvents != null){
            for(const eventDetail of parsedEvents){
                const eventStatus = eventDetail.event;
                chainedEvents.push(eventStatus);
            }
        }
        return chainedEvents;
    }

    async findAllLastCommits(){
        const issues:DBIssue[] = await this.DB.getIssueList(false,false);
        console.log(`Number of issues: ${issues.length}`);
        const lastCommitInIssues: Map<number, DBCommit | null> =new Map<number,  DBCommit | null>(); 
        const issueFileMapping: Map<string, Set<string>> = new Map();
        const issueDirMapping: Map<string, Set<string>> = new Map();
        //Get last commts for Issues
        const issueRepoMapping: Map<number,string> = new Map();
        for(const issue of issues){
            const {ID, Repo} = issue;
            if(!issueRepoMapping.get(ID)){
                issueRepoMapping.set(ID, Repo);
            }
            const lastCommit:  DBCommit | null = await this.findLastCommitBeforeClosing(issue);
                lastCommitInIssues.set(ID, lastCommit);
        }
        // Get net Lines of Code for last Commits of Issues (Bug Fix)
        const netLOCChangesInIssues: Map<number, number> = new Map<number,number>();
        const filesCountChangesInIssues: Map<number, string[]> = new Map<number,string[]>();
        const lastCommitSHAForIssue = new Map<number,string>();
        const lastCommitIDForIssue = new Map<number,number>();
        
        for(const [issueID, commitData] of lastCommitInIssues.entries()){
            if(commitData !== null){
                let commitNetLOCChange = 0;
                const parsedCommitResponse: CommitResponse = JSON.parse(commitData.RawResponse)
                const commitFiles = parsedCommitResponse.files;
                const commitSHA: string = parsedCommitResponse.sha;
                const commitID: number = commitData.ID;
                const issueRepo = issueRepoMapping.get(issueID);
                if(issueRepo != null){
                    if(!issueFileMapping.get(issueRepo)){
                        issueFileMapping.set(issueRepo, new Set())
                    }
                    if(!issueDirMapping.get(issueRepo)){
                        issueDirMapping.set(issueRepo, new Set())
                    }
                }
                let filesInBugFix = [];
                for(const committedFile of commitFiles){
                    const {additions,deletions,filename } = committedFile;
                    const filenameExtension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : ''
                    if(['js','c','h','cpp','cc','hpp', 'go', 'mod','cmm', 'hsc','idl',
                    'rs', 'hs', 'mjs', 'py', 'ts', 'json'].includes(filenameExtension)
                    && !filename.includes('bin/') && !filename.includes('build/')  && !filename.includes('dist/') //exclude binary build results
                    && !filename.includes('test/') && !filename.includes('tests/') //exclude tests
                    && !filename.includes('examples/') && !filename.includes('example/') && !filename.includes('samples/')&& !filename.includes('sample/') //exclude examples
                    ){
                        const locChangedInFile = (additions + deletions);
                        commitNetLOCChange += locChangedInFile;
                        if(issueRepo != null){
                            issueFileMapping.get(issueRepo)?.add(filename);
                            const dirname = path.dirname(filename);
                            issueDirMapping.get(issueRepo)?.add(dirname);
                        }
                        filesInBugFix.push(filename);
                    }
                }
                // await this.DB.insertFilesChangedForIssue(issueID, commitData.ID, commitFiles)
                filesCountChangesInIssues.set(issueID, filesInBugFix);
                netLOCChangesInIssues.set(issueID, commitNetLOCChange);
                lastCommitSHAForIssue.set(issueID,commitSHA);
                lastCommitIDForIssue.set(issueID,commitID);
            }
        }

        const labelObj: any = {}
        for(const [label, values ] of issueFileMapping.entries()){
            labelObj[label] = [...values.values()];
        }
        await writeFileAsync('./repoFilesChanges.json', JSON.stringify(labelObj))

        const dirObj: any = {}
        for(const [label, values ] of issueDirMapping.entries()){
            dirObj[label] = [...values.values()];
        }
        await writeFileAsync('./repoDirsOfFileChanges.json', JSON.stringify(dirObj))

        //Print Lines of Code for Issues
        for(const [issueID,locChanged] of netLOCChangesInIssues.entries()){
            console.log(`Issue ${issueID} had a net LOC change of ${locChanged}`);
            const commitFileNames = filesCountChangesInIssues.get(issueID);
            const commitSHA = lastCommitSHAForIssue.get(issueID);
            const commitID = lastCommitIDForIssue.get(issueID);
            await this.DB.updateLinesOfCodeChanged(issueID,locChanged, commitSHA ?? '',commitFileNames ?? [],commitID ?? 0);
        }
        let nullIDs = [];
        for(const [key, val] of lastCommitInIssues.entries()){
            if(val === null){
                nullIDs.push(key);
            }
        }
        console.log(`Number of nulls: ${nullIDs.length}`);
        for(const issue of issues){
            const {ID} = issue;
            if(nullIDs.includes(ID)){
                const eventChain = this.getEventChain(issue);
                console.log(`Issue ${ID}: ${eventChain.join(' -> ')}`);
            }
        }
        console.log('\n\n');
        for(const nullid of nullIDs){
            console.log(`${nullid},`)
        }
        console.log(`Issues Automatically closed: ${this.issuesAutomaticallyClosed.length}`);

        this.close();
    }

    async getAllIssueEventChains(){
        const issues:DBIssue[] = await this.DB.getIssueList(false,true);
        const differentTypesOfTagsBeforeClosed: Set<string> = new Set();
        const differentTypesCount:any = {};
        for(const issue of issues){
            const {ID} = issue;
            const eventChain = this.getEventChain(issue);
            if(eventChain.includes('closed')){
                const committedIndex = eventChain.lastIndexOf('closed');
                differentTypesOfTagsBeforeClosed.add(eventChain[committedIndex - 1]);
                if(eventChain[committedIndex - 1] === undefined){
                    console.log(`Issue ${ID}: ${eventChain.join(' -> ')}`);
                }

                if(!differentTypesCount[eventChain[committedIndex - 1]]){
                    differentTypesCount[eventChain[committedIndex - 1]] = [];
                }
                differentTypesCount[eventChain[committedIndex - 1]].push(ID);
            }

        }
        
        
        for(const eventStatus of differentTypesOfTagsBeforeClosed){
            const numberOfTimes = differentTypesCount[eventStatus].length;
            console.log(`${eventStatus}: ${numberOfTimes}: ${differentTypesCount[eventStatus].join(',')}`);
        }
        
        this.close();
    }

    async scanCommitsForIssueNumbers(){
        const issueIDsWithoutCommits: number[] = []
        let countOfMissingFound = 0;
        const rawCommitList = await this.DB.getAllRawCommits();
        const commitIssueMapping = new Map<string, number[]>();
        let nullIDs= [];
        for(const commit of rawCommitList){
            const {Owner, Repo, SHA} = commit;
            const issuesReferredTo:number[] = [];
            const commitMessage = commit.Title.toLowerCase();
            const fixesPattern1 = /fixes \#(?<num>[0-9]+)/;
            const fixesPattern2 = /fixed \#(?<num>[0-9]+)/;
            const fixesPattern3 = /fix \#(?<num>[0-9]+)/;
            const fixesPattern4 = /fixes issue \#(?<num>[0-9]+)/;
            const fixesPattern5 = /fix (?<num>[0-9]+)/;
            const closesPattern1 = /closes \#(?<num>[0-9]+)/;
            const closesPattern2 = /close \#(?<num>[0-9]+)/;
            const closesPattern3 = /closed \#(?<num>[0-9]+)/;
            const resolvesPattern1 = /resolve \#(?<num>[0-9]+)/;
            const resolvesPattern2 = /resolves \#(?<num>[0-9]+)/;
            const resolvesPattern3 = /resolved \#(?<num>[0-9]+)/;
            const mergePullRequestPattern1 = /merge pull request \#(?<num>[0-9]+)/;
            const genericPattern1 = /\#(?<num>[0-9]+)/;
            const patterns: RegExp[] = [fixesPattern1,fixesPattern2,fixesPattern3,fixesPattern4, fixesPattern5,
                                        closesPattern1, closesPattern2, closesPattern3,
                                        resolvesPattern1, resolvesPattern2, resolvesPattern3,
                                        mergePullRequestPattern1, genericPattern1 ];
            for(const pattern of patterns){
                if(commitMessage == null){
                    continue
                }
                let patternMatch = commitMessage.match(pattern)
                if(patternMatch !== null){
                    const issueNumber:string | undefined = patternMatch.groups?.num;
                    if(issueNumber !== undefined ){
                        const parsedIssueNumber: number = parseInt(issueNumber); 
                        if(!isNaN(parsedIssueNumber)){
                            const issueFetched: DBIssue | null = await this.DB.getIssueFromIssueNumber(parsedIssueNumber, Owner, Repo);

                            if(issueFetched != null && issueIDsWithoutCommits.includes(issueFetched.ID)){
                                countOfMissingFound +=1;
                            }
                            issuesReferredTo.push(parsedIssueNumber);
                        } 
                    }
                }
            }
            if(issuesReferredTo.length > 0){
                commitIssueMapping.set(SHA, issuesReferredTo);
            } else {
                // const messagehighlightedColors = commitMessage.replace(/ \#?([0-9]+)/g, (str: string) => chalk.yellow(str));
                // console.log(messagehighlightedColors)
                nullIDs.push(SHA);
            }
        }
        console.log(`IDs Now Found: ${countOfMissingFound}/${issueIDsWithoutCommits.length}`);
    }

    async extractLinksFromIssueBody(issue:DBIssue): Promise<LinkFound[]>{
        const issueBody = issue.Body;

        const countCharacters = (str: string, characterToSearch: string) => {
            let count,index;
            for(count=-1,index=-2; index != -1; count++,index=str.indexOf(characterToSearch,index+1) );
            return count;

        }
        const acceptableExtensions =  ['js','wasm','wat','c','h','cpp','cc','hpp', 'go', 'mod',
                                        'rs', 'wast','hs', 'mjs', 'py', 'ts',
                                        'zip','gz'];

        const linksFound:LinkFound[] = [];
        const urlsFound = getUrls(issueBody, {stripHash: true});
        //special case #1 zip, gz: https://github.com/AssemblyScript/assemblyscript/files/3694603/wasm-project201910070050.zip
        // gz:https://github.com/WebAssembly/binaryen/files/3976219/a.wasm.tar.gz
        for(const urlFound of urlsFound){   
            let linkToUse = urlFound.split("?")[0].replace(/\)/g, '').replace(/,$/,'').replace(/\)$/, '')
                            .replace(/\%(.*)*$/, '').replace(/\'$/, '');
            const countOfSlashes = countCharacters(linkToUse, '/');

            if(!linkToUse.includes('localhost') && !linkToUse.includes('127.0.0.1') && !linkToUse.includes('0.0.0.0') && !linkToUse.includes('192.168') && countOfSlashes >= 3 ){
                if(linkToUse.includes('gist.github.com')){
                //special case #2 gist.github.com: https://gist.github.com/vird/a467005edc2f54204785f76e4e2f23a8 -> document.querySelector("div.file-header > div.file-actions > a")
                    const linkFound = new LinkFound(linkToUse, 'gist', issue.Owner, issue.Repo);
                    await linkFound.handleGist();
                    linksFound.push(linkFound);
                    continue;
                }
                let filenameInURL = linkToUse.substring(linkToUse.lastIndexOf('/') + 1)
                if(filenameInURL.includes(":")){
                    filenameInURL = filenameInURL.split(":")[0];
                    linkToUse = linkToUse.substring(0,linkToUse.lastIndexOf('/')) + filenameInURL; 
                }
                if(filenameInURL.includes('.')  ){
                    const filenameSplit = filenameInURL.split(".")
                    const fileExtension = filenameSplit[filenameSplit.length - 1];
                    if(acceptableExtensions.includes(fileExtension)){
                        const linkFound = new LinkFound(linkToUse, fileExtension, issue.Owner, issue.Repo, filenameInURL);
                        await linkFound.scanLink()
                        linksFound.push(linkFound);
                    } else {
                        this.unacceptedExtensions.add(fileExtension)
                    }
                }
            }
        }
        
        return linksFound;
    }    

    extractCodeSnippetsFromIssueBody(issue: DBIssue, onlyErrors: boolean = false): CodeSnippet[]{
        const issueBody = issue.Body;
        const codeSnippets: CodeSnippet[] = [];
        if(issueBody == null){
            return codeSnippets
        }
        const codePattern = /```(?<codeType>\S*)\s?\n(?<codeSnippet>(?:[^`\\]|\\.)*)```/gus;

        // const CODE_DELIM = "```";
        // let currentStringIndex = issueBody.indexOf(CODE_DELIM);
        // while(currentStringIndex != -1 && currentStringIndex < issueBody.length){
        //     const nextDelimIndex = issueBody.indexOf(CODE_DELIM, currentStringIndex + CODE_DELIM.length);
        //     const codeText = issueBody.substring(currentStringIndex, nextDelimIndex + CODE_DELIM.length+1);
        //     currentStringIndex = issueBody.indexOf(CODE_DELIM, nextDelimIndex + CODE_DELIM.length);
        //     // const codeMatch = codeText.match(codePattern);
        //     let codeType: string | undefined;
        //     // if(codeMatch != null){
        //     //     codeType = codeMatch.groups?.codeType
        //     // }

        //     const codeContainsErrorKeyword = codeText?.includes('Error') 
        //     || codeText?.includes('ERROR' || codeText.includes('error:'));
        //     if(codeText !== undefined &&  !codeContainsErrorKeyword){
        //         const codeSnippet = new CodeSnippet(codeText, codeType);
        //         codeSnippets.push(codeSnippet);
        //     }
        // }

        const patternMatches = issueBody.matchAll(codePattern);
        for(const match of patternMatches){
            const codeType =  match.groups?.codeType;
            const codeText =  match.groups?.codeSnippet;
            const codeContainsErrorKeyword = issueBody?.includes('Error') 
            || issueBody?.includes('ERROR' || issueBody?.includes('error:')
            ||issueBody?.includes('errors')
            );

            const errorConditionToFilter = onlyErrors? codeContainsErrorKeyword : !codeContainsErrorKeyword
            if(codeText !== undefined &&  errorConditionToFilter){
                const snippetFound =  new CodeSnippet(codeText, codeType, issue.Owner, issue.Repo)
                codeSnippets.push(snippetFound);
            }
        }
        return codeSnippets;
    }

    async scanIssuesForTestCase(){
        const issues:DBIssue[] = await this.DB.getIssueList(false,true);
        const issuesWithCodeSnippets: number[] = [];
        const issuesWithLinks: number[] = [];
        const issueSnippetsMapping= new Map<number, CodeSnippet[]>();
        const issueLinksMapping= new Map<number, string[]>();
        const issueTestCaseLOC= new Map<number, number>();
        const totalIssues = issues.length;
        let currentIssue=1;
        let lastSeen = 1;
        let seenLast = false
        for(const issue of issues){
            try{
                console.log(`Inspecting issue ${currentIssue} of ${totalIssues}`)
                const issueID = issue.ID;
                if(currentIssue == lastSeen){
                    seenLast = true;
                }

                if(!seenLast){
                    currentIssue += 1;
                    continue
                }

                currentIssue += 1;
                const codeSnippetsInIssue = this.extractCodeSnippetsFromIssueBody(issue);
                const linksInIssue = await this.extractLinksFromIssueBody(issue);
    
                let issueTotalLOC = 0;
                if( codeSnippetsInIssue.length > 0 || linksInIssue.length > 0){
                    issuesWithCodeSnippets.push(issueID);
                    issueSnippetsMapping.set(issueID, codeSnippetsInIssue);
                    const codeSnippetsLOCCount = codeSnippetsInIssue.map(snippet => snippet.LinesOfCode).reduce((x,y) => x+y, 0);
                    issueTotalLOC += codeSnippetsLOCCount;
                    console.log(`Issue ${issueID} has ${codeSnippetsInIssue.length} test case(s)`);
                    issuesWithLinks.push(issueID);
                    const linkLOCCount = linksInIssue.map(link => link.LinesOfCode).reduce((x,y) => x+y, 0);
                    issueTotalLOC += linkLOCCount;
                    issueLinksMapping.set(issueID, linksInIssue.map(lk => lk.URL));
                    await this.DB.insertTestCasesForBugs(issueID, codeSnippetsInIssue, linksInIssue);
                }
    
                if(issueTotalLOC > 0){
                    issueTestCaseLOC.set(issueID, issueTotalLOC);
                }
            } catch(issueError){
                console.error('Issue Test Case Error', issueError)
            }
        }
        const entriesToWrite = [];
        for(const [id, itemList] of issueSnippetsMapping.entries()){
            for(const item of itemList){
                entriesToWrite.push(item.CodeText);
            }
        }
        // await writeFileAsync('./issueCodeSnippets.log', entriesToWrite.join('\n--------------\n--------------\n'));
        // await writeFileAsync('./issueLinks.json', JSON.stringify([...issueLinksMapping.values()]))
        // await writeFileAsync('./issueTestCaseCounts.json', JSON.stringify({total: issueTestCaseLOC.size, entries: [...issueTestCaseLOC.entries()]}))
        // console.log(`${issuesWithCodeSnippets.length} have code snippets out of ${issues.length} (${issuesWithCodeSnippets.length / issues.length * 100}%)`)
        // console.log(`${issuesWithLinks.length} have links out of ${issues.length} (${issuesWithLinks.length / issues.length * 100}%)`)
    
    }

    async scanIssuesForPriorityLabels(){
        const uniqueLabels : Map<string, Set<string>>= new Map();

        let issues:DBIssue[] = await this.DB.getIssueList(false,true);
        for(const issue of issues){
            const { ID, Repo, RawResponse } = issue;
            if(uniqueLabels.get(Repo) == null){
                uniqueLabels.set(Repo, new Set());
            }
            const labelsForIssue = RawResponse.labels.map(lbl => lbl.name);
            for(const label of labelsForIssue){
                uniqueLabels.get(Repo)?.add(label);
            }
            await this.DB.insertLabelsForIssue(ID, labelsForIssue);
        }

        const labelObj: any = {}
        for(const [label, values ] of uniqueLabels.entries()){
            labelObj[label] = [...values.values()];
        }
        await writeFileAsync('./issueLabels.json', JSON.stringify(labelObj))
    }

    async getIssueCount(): Promise<number>{
        const issues = await this.DB.getIssueList(false, true);
        const issueCount = issues.length;
        console.log(`Issue count ${issueCount}`)
        return issueCount
    }

    private async readJSON(filename: string): Promise<any | null> {
        try{
            const jsonString= await readFile(filename, 'utf8');
            return JSON.parse(jsonString)
        } catch(jsonParseError) {
            console.error('JSON parse error', jsonParseError)
            return null;
        }
    }
    async handleComponents(){
        const commitFilesChanged = await this.DB.getFilesChangedInCommit();
        const componentsJSON  = await this.readJSON('./compilerComponents.json')
        const fileComponentMapping = new Map<string,string>();
        // for(const compiler in componentsJSON){
        for(const compiler of ['rust']){
            const compilerComponents = componentsJSON[compiler];
            for(const compilerComponent in compilerComponents){
                const compilerComponentFiles:string[] = compilerComponents[compilerComponent]
                        .filter( (file:any) => 
                                            !file.includes('test/') 
                                            && !file.includes('tests/') 
                                            && !file.includes('testdata/') 
                                            && !file.includes('examples/')
                                            && !file.endsWith('.md')
                                            && !file.endsWith('.txt')
                                            && !file.endsWith('.map')
                                            && !file.endsWith('.yaml')
                                            && !file.endsWith('.yml')
                                            && !file.endsWith('.toml')
                        )
                        for(const componentFile of compilerComponentFiles){
                            fileComponentMapping.set(`${compiler}::${componentFile}`, compilerComponent);
                        }
            }
        }

        for(const commitFile of commitFilesChanged){
            const {Repo,RepoID, Filename, IssueID, ID} = commitFile;
            const keyToSearchInMap = `${Repo}::${Filename}`;
            const mappedComponent = fileComponentMapping.get(keyToSearchInMap);
            if(mappedComponent != null){
                await this.DB.insertIssueComponent(IssueID, RepoID, mappedComponent, ID);
                // await this.DB.updateComponentForFile(ID, mappedComponent)
            }
        }
        
    }

    async scanIssuesForErrorSnippets(){
        const issues:DBIssue[] = await this.DB.getIssueList(false,true);
        const issuesWithCodeSnippets: number[] = [];
        const issueSnippetsMapping= new Map<number, CodeSnippet[]>();

        const totalIssues = issues.length;
        let currentIssue=1;
        // let lastSeen = 1;
        // let seenLast = false
        for(const issue of issues){
            try{
                console.log(`Inspecting issue ${currentIssue} of ${totalIssues}`)
                const issueBody = issue.Body;
                const issueID = issue.ID;
    
    
                // if(currentIssue == lastSeen){
                //     seenLast = true;
                // }

                // if(!seenLast){
                //     currentIssue += 1;
                //     continue
                // }

                currentIssue += 1;

                const codeSnippetsInIssue = this.extractCodeSnippetsFromIssueBody(issue, true);
                // const linksInIssue = await this.extractLinksFromIssueBody(issueBody);
    
                let issueTotalLOC = 0;
                if( codeSnippetsInIssue.length > 0){
                    issuesWithCodeSnippets.push(issueID);
                    issueSnippetsMapping.set(issueID, codeSnippetsInIssue);
                    // const codeSnippetsLOCCount = codeSnippetsInIssue.map(snippet => snippet.LinesOfCode).reduce((x,y) => x+y, 0);
                    
                }
    
            } catch(issueError){
                console.error('Issue Test Case Error', issueError)
            }

        }
        const entriesToWrite = [];
        for(const [id, itemList] of issueSnippetsMapping.entries()){
            for(const item of itemList){
                entriesToWrite.push(item.CodeText);
            }
        }
        await writeFileAsync('./issueErrorCodeSnippets.log', entriesToWrite.join('\n--------------\n--------------\n'));
        console.log(`${issuesWithCodeSnippets.length} have code snippets out of ${issues.length} (${issuesWithCodeSnippets.length / issues.length * 100}%)`)
        // await writeFileAsync('./issueLinks.json', JSON.stringify([...issueLinksMapping.values()]))
    
    }

    async scanCodeSnippetsPerComponent(){
        const codeSnippetsForComponent = await this.DB.getCodeSnippetForEmscriptenComponents();
        for(const snippet of codeSnippetsForComponent){
            const { Component, CodeSnippets } = snippet;
            for(const {CodeText,Type} of CodeSnippets){
                if(['c',,'c++','C','C++', 'CPP','cpp'].includes(Type)){
                    // const codeTextTokens = CodeText.match(/\S+/g);
                    const codeTextTokens = CodeText.split('\n');
                    const nonCommentLines = codeTextTokens.filter(line => {
                        const trimmedLine =  line.trim();
                        return  !(trimmedLine.charAt(0) == '/' && trimmedLine.charAt(1) == '/');
                    })
                    // console.log(codeTextTokens)
                    console.log(nonCommentLines.join('\n'))
                }
            }
        }
    }

    async scanExistingInfrastructure(){
        const issues = await this.DB.getIssueComponentCounts();
        const existingComponentDetails = await this.readJSON('./existingInfrastructureComponents.json');
        
        const getCountsForCompilerOfInfrastructure = (infrastrureObj: any) => {
            const compilers = ["AssemblyScript", "tinygo", "emscripten", "asterius", "binaryen"];
            const countsOfInfraInCompilers: any = {};
            for(const compiler of compilers){
                if(!infrastrureObj[compiler]){
                    continue;
                }
                const existingInfraBackend = Object.keys(infrastrureObj[compiler]);
                for(const targetExistinginfra of existingInfraBackend){
                    const interestingCompilerComponents = infrastrureObj[compiler][targetExistinginfra];
                    for(const targetComponent of interestingCompilerComponents){
                        for(const issue of issues){
                            if(issue.Component === targetComponent){
                                if(!countsOfInfraInCompilers[compiler]){
                                    countsOfInfraInCompilers[compiler] = {}
                                }
                                if(!countsOfInfraInCompilers[compiler][targetExistinginfra]){
                                    countsOfInfraInCompilers[compiler][targetExistinginfra] = 0
                                }
                                countsOfInfraInCompilers[compiler][targetExistinginfra] += issue.Total;
                                
                            }
                        }
                    }
                }
            }
            return countsOfInfraInCompilers;
        }
        
        const {Backend, Frontend} = existingComponentDetails;

        const backendExistingInfra = getCountsForCompilerOfInfrastructure(Backend);
        const frontendExistingInfra = getCountsForCompilerOfInfrastructure(Frontend);

        console.log('Frontend')
        console.log(frontendExistingInfra)
        console.log('Backend')
        console.log(backendExistingInfra);
    }

    parseGitPatch(patch: string){
        const codePatches: GitPatch[] = [];
        // console.log(filePath)
        let regex = /@@/gi, result, indices = [];
        while ( (result = regex.exec(patch)) ) {
            indices.push(result.index);
        }
        indices.push(patch.length - 1);
        let previousIndex = 0;
        let lineNumbers = '';
        let codeText = '';
        for(const currentIndex of indices){
            if(currentIndex == 0){
                continue;
            }
            if(lineNumbers === ''){
                lineNumbers = patch.substring(previousIndex + 2, currentIndex).trim();
                previousIndex = currentIndex;
                continue;
            }
            codeText = patch.substring(previousIndex + 2, currentIndex);
            const codePatch = new GitPatch(lineNumbers, codeText);
            codePatch.parseNumbers();
            codePatches.push(codePatch);
            previousIndex = currentIndex;
            lineNumbers = '';
            codeText='';
        }

        return codePatches;
    }
    
    private getAllIndices(substring:string,string:string){
        var a=[],i=-1;
        while((i=string.indexOf(substring,i+1)) >= 0) a.push(i);
        return a;
    }
    checkLineForFunctionDeclaration(line: string): FunctionDeclaration | null {
        let containsFunctionDeclaration = false;
        const pythonFunctionDelimiter = ['def ',];
        const cFunctionDelimiter = [
            'char ','char*', 'float64x2 ','int32x4 ', 'bool32x4 ', 'float32x4 ',
            'uint32x4 ', 'int16x8 ', 'bool16x8 ', 'uint16x8 ', 'bool8x16 ', 'int8x16 ',
            'uint8x16 ', 'cJSON ', 'BufferWithRandomAccess& ', 'Pass* ', 'uint64_t ', 'v128_t ',
            'void ', 'EM_BOOL ', 'int ', 'float ',  'double ', 'off_t ', 'std::string ', 'GLenum ', 'void* ','bool ',
            'uint32_t ','S32LEB ', 'int32_t ','Expression* ', 'Function* ', 'WasmType ',
            'ReturnType ','BinaryenType ','BinaryenExpressionId ', 'Nop* ',' BinaryOp ', 'UnaryOp',
            'IString ','BinaryenLiteral ', 'Literal ', 'BinaryenFunctionTypeRef ', 'Flow ', 'Type ','ASTNodes ',
            'BinaryenOp ', 'BinaryenExpressionRef ', 'BinaryenFunctionTypeRef ', 'BinaryenModuleRef ',
            'Pass ', 'Index ', 'ostream& ', 'emscripten_fetch_t ', 'EMSCRIPTEN_RESULT ',
            '__m128 '
        ];
        const tsFunctionDelimiter = [
            'function ', 
            ' function(', 
        ]

        const rustFunctionDelimiter = [
            'fn ', 
        ];
        const goFuncDelimiter = [
            'func '
        ]

        //Check if there are functions within the patch
        //For C/C++, Rust, Go, TypeScript
        if(line.includes('(') &&
            line.includes(')') 
            && line.includes('{') 
            && !line.includes(' for ')
            && !line.includes(' if ')
            && !line.includes(' while ')
            ){
                // let hasDelim = false;
                //4 langauge standard function declaration
                for(const funcDelim of goFuncDelimiter){
                    if(line.includes(funcDelim)){
                        return new FunctionDeclaration(Language.GO, line);
                    }
                }

                for(const funcDelim of cFunctionDelimiter){
                    if(line.includes(funcDelim)){
                        return new FunctionDeclaration(Language.C, line);
                    }
                }

                for(const funcDelim of tsFunctionDelimiter){
                    if(line.includes(funcDelim)){
                        return new FunctionDeclaration(Language.TS, line);
                    }
                }

                for(const funcDelim of rustFunctionDelimiter){
                    if(line.includes(funcDelim)){
                        return new FunctionDeclaration(Language.RUST, line);
                    }
                }

            //TypeScript specific

            const indicesOfColon = this.getAllIndices(': ', line);
            const hasAS_TypeSignature =  indicesOfColon.some(idx => idx == line.indexOf(')') + 1);
            if(hasAS_TypeSignature){
                return new FunctionDeclaration(Language.TS, line);
            }

        } 
        else if(line.includes('(') && line.includes(')') &&
                line.includes(':')){
            for(const funcDelim of pythonFunctionDelimiter){
                if(line.includes(funcDelim)){
                    return new FunctionDeclaration(Language.PYTHON, line);
                }
            }
        } else if(line.includes(' :: ') && line.includes(' -> ')){
            return new FunctionDeclaration(Language.HASKELL, line);
        }
        return null;
    }

    async handlePatchesWithFiles(gitPatches: GitPatch[], filePath: string): Promise<FunctionDeclaration[]>{
        let data = await readFile(filePath, 'utf8');
        const lines = data.split(/\r?\n/);

        const functionDecls: FunctionDeclaration[] = [];
        for(const patch of gitPatches){
            const {LineNumbers, CodeText} = patch;
            const firstLineInCodeText = CodeText.substring(0, CodeText.indexOf('\n'));
            
            const firstLineFuncDecl = this.checkLineForFunctionDeclaration(firstLineInCodeText);
            if(firstLineFuncDecl != null){
                firstLineFuncDecl.wasFoundInFirstLine();
                functionDecls.push(firstLineFuncDecl);
            } else {
                const codeTextLines = CodeText.substring(CodeText.indexOf('\n') + 1).split('\n');
                for(const line of codeTextLines){
                    const trimmedLine = line.replace(/^\+/, '').replace(/^\-/, '')
                    const lineFunctionDecl = this.checkLineForFunctionDeclaration(trimmedLine);
                    if(lineFunctionDecl != null){
                        functionDecls.push(lineFunctionDecl);
                    }
                }
            }

            if(functionDecls.length == 0){
                const lineNumberToStart = LineNumbers[0];
                for(let currentLineNumber = lineNumberToStart; currentLineNumber >= 0; currentLineNumber--){
                    const realLineOfCode = lines[currentLineNumber];
                    if(realLineOfCode == null){
                        continue;
                    }
                    const lineFunctionDecl = this.checkLineForFunctionDeclaration(realLineOfCode);
                    if(lineFunctionDecl != null){
                        functionDecls.push(lineFunctionDecl);
                        break;
                    }
                }
            }
        }


        functionDecls.forEach(funcDecl => {
            funcDecl.parseLineForName()

            // if(funcDecl.Name == ''){
            //     // console.log(`Worked?: ${funcDecl.Code}`)
            // }
        })
        return functionDecls;
    }

    async scanIssuesForBugFixFunctionNames(){
        const issues = await this.DB.getIssuesWithBugs();
        const downloadPath = path.resolve(__dirname, 'BugFixFiles');
        const downloader = new FileDownloader(this.argv, downloadPath);
        let issuesWithoutFuncDecl = 0
        for(const issue of issues){
            const patchesInIssue = [];
            let seenFuncDecl = false;
            const {RawResponse,BugFIxCommitSHA, BugFixCommitID, ID } = issue;
            const {files } = RawResponse as CommitResponse;
            for( const file of files){
                const {filename ,raw_url} = file;
                if(filename.includes('.')){
                    const fileExtension = filename.substring(filename.lastIndexOf('.') + 1)
                    if(['js','c','h','cpp','cc','hpp', 'go', 'mod','cmm', 'hsc','idl',
                    'rs', 'hs', 'mjs', 'py', 'ts', 'json'].includes(fileExtension)){
                        const {patch, status} = file;
                        patchesInIssue.push(patch);
                        if(status === 'modified'){
                            if(patch){
                                const functionNamesSeenInPatch = new Set<string>();
                                const filePath = await downloader.handleCommitFileReference(BugFIxCommitSHA, file);
                                const codePatches = this.parseGitPatch(patch);
                                const functionNamesInPatch = await this.handlePatchesWithFiles(codePatches, filePath)
                                for(const functionNameDeclaration of functionNamesInPatch){
                                    if(functionNameDeclaration.Name !== ''){
                                        const {Name, Language, FoundInFirstLine} = functionNameDeclaration;
                                        if(functionNamesSeenInPatch.has(Name)){
                                            continue;
                                        } else {
                                            seenFuncDecl = true;
                                            functionNamesSeenInPatch.add(Name);
                                            await this.DB.insertBugFixFunctionName(ID, BugFixCommitID, filename, Name, FoundInFirstLine, Language, raw_url);
                                        }
                                    }
                                }
                            }
                        }

                    }
                }
            }

            if(!seenFuncDecl){
                issuesWithoutFuncDecl +=1;
                console.log(`No Func Decls in ${issue.ID}`, patchesInIssue)
                console.log('-----------------------------------------------')
            }
        }
        console.log(`No Func Decl Found: ${issuesWithoutFuncDecl}`);

    }

    private convertRawURLToContentURL(rawURL: string){
        const rawURLSections = rawURL.replace('https://', '').replace('http://', '').split('/');
        const contentURL = `https://api.github.com/repos/${rawURLSections[1]}/${rawURLSections[2]}/contents/${rawURLSections.slice(5).join('/')}?ref=${rawURLSections[4]}` 
        return contentURL;
    }   

    async handleFileChangedContent(){
        const commitFilesChanged = await this.DB.getFilesChangedInCommit();
        for(const commitFile of commitFilesChanged){
            const {Repo,RepoID, Filename, IssueID, ID, RawURL} = commitFile;
            if(Filename.endsWith('.wasm') || Filename.endsWith('.wast') || Filename.endsWith('.wat')){
                const contentURL = this.convertRawURLToContentURL(RawURL);
                console.log(contentURL)
                try{
                    const content = await this.crawler.getFileContentInfoFromURL(contentURL);
                    await this.DB.updateContentDetailsForFile(ID, content);
                } catch(contentErr){
                    console.error(contentErr)
                }
                
            }
        }
        
    }

    async getAllFileVersions(){
        const reposOfCommits = new Map<string,ChangeDetails[]>();
        const commitList = await this.DB.getGitHubCommits();
        const getWasmNameFromFilename = (filename: string) => {
            let basename = filename;
            if(filename.includes('/')){
                const filenameSplits = filename.split('/');
                basename = filenameSplits[filenameSplits.length - 1];
            }
            const indexOfFirstDot = basename.indexOf('.');
            return basename.slice(0, indexOfFirstDot + 1);
        };
        const getDirFromFilename = (filename: string) => {
            let dirname = filename;
            if(filename.includes('/')){
                const filenameSplits = filename.split('/');
                dirname = filenameSplits.slice(0, filenameSplits.length - 1).join('/');
            } else {
                dirname = '';
            }
            return dirname;
        };
        for(const com of commitList){
            const {Repo, ID} = com;
            const rawResponse = com.RawResponse as CommitResponse;
            if(rawResponse != null){
                const commitFiles = rawResponse.files;
                const changedWasmNames = new Set<string>();
                const files: CommitFile[] = [];
                let changedWasm = false;
                let changedTestWasm = false;
                let changedHandwritten = false;
                let changedSource = false;
                let changedTest = false;

                for(const commitFile of commitFiles){
                    const {filename} = commitFile;
                    if(filename.endsWith('.wasm')){
                        files.push(commitFile);
                        changedWasmNames.add(getWasmNameFromFilename(filename));
                        const dirname = getDirFromFilename(filename);
                        if(dirname !== ''){
                            changedWasmNames.add(dirname);
                        }
                        if(filename.includes('test')){
                            changedTestWasm = true;
                        } else {
                            changedWasm = true;
                        }
                    }
                }

                const sourceExtensions = ['.c','.cpp','.cc','.h','.hpp','.ts','.rs', '.hs','.py','.go','.java','.js'];
                for(const commitFile of commitFiles){
                    const filename = commitFile.filename;
                    for(const wasmName of changedWasmNames.values()){
                        if(filename.includes(wasmName)){
                            const extensionEnds = ['.wat', '.wast'];
                            for(const ext of extensionEnds){
                                if(filename.endsWith(ext)){
                                    files.push(commitFile);
                                    changedHandwritten = true;
                                }
                            }
                            for(const sourceExt of sourceExtensions){
                                if(filename.endsWith(sourceExt)){
                                    files.push(commitFile);
                                    if(filename.includes('test')){
                                        changedTest = true;
                                    } else {
                                        changedSource = true;
                                    }
                                }
                            }
                        }
                    }
                }
                if(changedWasm || changedTest || changedHandwritten){
                    if(!reposOfCommits.has(Repo)){
                        reposOfCommits.set(Repo,[]);
                    }
                    const collectedDetails = new ChangeDetails(changedWasm, changedTestWasm, changedHandwritten, changedSource, changedTest, files, rawResponse.html_url, com.Owner, com.Repo, com);
                    reposOfCommits.get(Repo)?.push(collectedDetails);
                }
            }
        }

        const changesTargetingWasmAndSource: Map<string, ChangeDetails[]> = new Map<string, ChangeDetails[]>();
        const changesTargetingTestWasmAndTestCase: Map<string, ChangeDetails[]> = new Map<string, ChangeDetails[]>();
        const changesTargetingWasmAndTestCase: Map<string, ChangeDetails[]> = new Map<string, ChangeDetails[]>();
        const changesTargetingWasmAndHandwritten: Map<string, ChangeDetails[]> = new Map<string, ChangeDetails[]>();

        const addCommit = (dict: Map<string, ChangeDetails[]>, commit: ChangeDetails) => {
            const {Repo} = commit;
            if(!dict.has(Repo)){
                dict.set(Repo, [commit]);
            } else {
                dict.get(Repo)?.push(commit);
            }
        }

        let totalChanges = 0;
        for(const [rc, repoCommitList] of reposOfCommits.entries()){
            totalChanges += repoCommitList.length;
            for(const commit of repoCommitList){
                if(commit.changesWasmAndSourceCode()){
                    addCommit(changesTargetingWasmAndSource,commit)
                }
                if(commit.changesTestCaseWasmAndTestCase()){
                    addCommit(changesTargetingTestWasmAndTestCase,commit)
                }
                if(commit.changesWasmAndTestCase()){
                    addCommit(changesTargetingWasmAndTestCase,commit)
                }
                if(commit.changesTestWasmOrHandwritten()){
                    addCommit(changesTargetingWasmAndHandwritten,commit)
                }
            }
        }

        const results = {
            'Total changes': totalChanges,
            'Changes WebAssembly module and Source Code': {
                    'Length':  Object.keys(changesTargetingWasmAndSource).length,
                    'Commits': changesTargetingWasmAndSource
                },
            'Changes Test Case WebAssembly and Test Case Code': {
                    'Length':  Object.keys(changesTargetingTestWasmAndTestCase).length,
                    'Commits': changesTargetingTestWasmAndTestCase
                },
            'Changes WebAssembly module and Test Case': {
                    'Length':  Object.keys(changesTargetingWasmAndTestCase).length,
                    'Commits': changesTargetingWasmAndTestCase
                },
            'Changes WebAssembly module and WebAssembly text': {
                    'Length':  Object.keys(changesTargetingWasmAndHandwritten).length,
                    'Commits': changesTargetingWasmAndHandwritten
                }
        };

        for(const [repo, changeList] of changesTargetingTestWasmAndTestCase.entries()){
            console.log(repo, changeList.length);
            for(const change of changeList){
                const rawResponse = change.Commit?.RawResponse as CommitResponse; 
                const sha = rawResponse.sha;
                const repo = change.Repo;
                const owner = change.Owner;

                for(const fileDetails of change.Files){
                    const {filename} = fileDetails;

                    const fileVersions: FileVersionResponse[] = await this.crawler.getFileVersions(owner, repo,filename);
                    let versionNumber = 1;
                    for(const version of fileVersions){
                        const date = version.commit.author.date;

                        versionNumber++;
                    }

                }
            }
        }
        await writeFileAsync('./MyFile.json', JSON.stringify(results));    

        
        this.close();
    }

    async updateAllInstructionsCountsWithTotals(){
        const versionLists = await this.DB.getVersionInstructionCounts();
        for(const versionRecord of versionLists){
            let {ID, InstructionCounts} = versionRecord;
            if(InstructionCounts == null){
                continue;
            }

            const instructions: string[] = Object.keys(InstructionCounts);
            if(instructions.includes('Total')){
                continue;
            }
            let totalCount = 0;
            for(const instructionKey of instructions){
                let count: number = InstructionCounts[instructionKey];
                totalCount += count;
            }
            const newCount = {...InstructionCounts};
            newCount['Total'] = totalCount;

            await this.DB.updateInstructionCounts(ID, newCount);
        }
    }

    async updateAllNullInstructionCounts(){
        const fileVersionLists = await this.DB.getFileVersionLists();
        console.log(fileVersionLists?.length)
        if( fileVersionLists != null){
            for(const fileVersionDetails of fileVersionLists){
                const {ID, RawURL, ContentURL, Filename} = fileVersionDetails;
                let instructionCounts: any = null;
                let raw_url = RawURL;
                let linesOfCode = 0;
                let filename = Filename;
                if(raw_url){
                    if(filename.endsWith('.wasm')){
                        const wasmBuffer: Buffer = await FileDownloader.downloadFileAsBuffer(raw_url);
                        const wasmIntructionCounter = new WasmInstructionCounter(filename, wasmBuffer);
                        const instructionCountMap = await wasmIntructionCounter.readInstructions();
                        if(instructionCountMap != null){
                            instructionCounts = strMapToObj(instructionCountMap);
                        } else {
                            console.log(raw_url)
                        }
                        linesOfCode = wasmIntructionCounter.getLinesOfCode();
                    } else if(filename.endsWith('.wat') || filename.endsWith('.wast')){
                        const wasmString: string = await FileDownloader.downloadFileAsText(raw_url);
                        const wasmIntructionCounter = new WasmInstructionCounter(filename, undefined, wasmString);
                        const instructionCountMap = await wasmIntructionCounter.readInstructions();
                        if(instructionCountMap != null){
                            instructionCounts = strMapToObj(instructionCountMap);
                        }else {
                            console.log(raw_url)
                        }
                        linesOfCode = wasmIntructionCounter.getLinesOfCode();
                    }
                }
                await this.DB.updateFileVersionInstructionCount(ID, instructionCounts, linesOfCode);
            }
        }
    }

    async testReadWasm(){
        const url = 'https://github.com/AssemblyScript/examples/blob/master/mandelbrot/build/optimized.wasm?raw=true';
        const wasmBuffer: Buffer = await FileDownloader.downloadFileAsBuffer(url);
        const wasmIntructionCounter = new WasmInstructionCounter('array.wasm', wasmBuffer);
        const instructionCounts = await wasmIntructionCounter.readInstructions();
        if(instructionCounts != null){
            console.log(strMapToObj(instructionCounts))
        }
    }
    async testReadWat(){
        const url = 'https://raw.githubusercontent.com/WebAssembly/testsuite/master/local_get.wast';
        const wasmString: string = await FileDownloader.downloadFileAsText(url);
        const wasmIntructionCounter = new WasmInstructionCounter('array.wasm', undefined, wasmString);
        const instructionCounts = await wasmIntructionCounter.readInstructions();
        if(instructionCounts != null){
            console.log(strMapToObj(instructionCounts))
        }
    }
}