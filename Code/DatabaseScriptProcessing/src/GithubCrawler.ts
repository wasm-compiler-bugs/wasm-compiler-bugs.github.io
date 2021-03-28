import { FileDownloader } from "./FileDownloader";
import { GitHubAPIManager } from "./GitHubAPIManager";
import { MySQLConnector } from "./MySQLConnector";
import { EventData, CommitListResponse, CommitResponse, FileVersionResponse, CommitFile, DBRawCommit, SearchResults, Item } from "./types";
import ChangeDetails from "./Utils/ChangeDetails";
import { WasmInstructionCounter } from "./Utils/WasmInstructionCounter";

function strMapToObj(strMap: Map<any,any>) {
    let obj: any = {};
    for (let [k,v] of strMap) {
        obj[k] = v;
    }
    return obj;
}

export class GitHubCrawler {
    DB = new MySQLConnector();
    static valueList: any[] = [];
    githubManager: GitHubAPIManager;
    argv: any;
    
    constructor(args:any, githubAPItokens?:string[]){
        this.argv = args;
        this.githubManager = new GitHubAPIManager(githubAPItokens)
    }
    async getRepoList() {
        const repoList = []
        const sqlQuery = `
        SELECT * FROM webassembly_bugs.github_bug_repos
        WHERE Repo LIKE '%wabt%'
        ORDER BY Owner,Repo;`

        const dbResults: any[] = await this.DB.query(sqlQuery);

        for (const row of dbResults) {
            repoList.push({
                owner: row.Owner,
                repo: row.Repo,
                repoID: row.ID
            });
        }

        return repoList;
    }

    async searchRepo(owner: string, repo: string){
        console.log(`Searching repo info for https://github.com/${owner}/${repo}`);
        try {
            const repoInfo = await this.githubManager.makeGitHubCall(`/repos/${owner}/${repo}`);
            await this.DB.insertRepoIntoDB(owner, repo, repoInfo);

        } catch (searchError) {
            console.error('Issue Search Error', searchError);
        }
    }

    async searchRepoIssues(owner: string, repo: string, repoID: number) {
        const currentRepos = [];
        console.log(`Searching issues for: https://github.com/${owner}/${repo}`);
        let items = [];


        try {
            items = await this.githubManager.makePaginatedCall(`/repos/${owner}/${repo}/issues?state=all`);
            // await this.DB.insertIssueResponseInfoIntoDB(owner, repo, items)


        } catch (searchError) {
            console.error('Issue Search Error', searchError);
        }
        console.log(`\nFound ${items.length} for ${owner}/${repo}\n----------------------------\n`);
        for (const item of items) {
            try {
                const {
                    html_url,
                    id,
                    title,
                    state,
                    body,
                    comments
                } = item;
                await this.DB.insertBugIntoDB(repoID, item, id, title, state, body, html_url, comments);
                currentRepos.push({
                    owner,
                    repo,
                    repoID,
                    item,
                    id,
                    title,
                    state,
                    body,
                    html_url,
                    comments
                });
            } catch (insertBugError) {
                console.error('Insert Bug Error', insertBugError)
            }
        }

        return currentRepos;
    }

    async searchTopGitHubRepos(query:string) {
        const currentRepos = [];
        const createdStart = '2000-01-01'
        const endpoint = `/search/repositories?q=topic:${query}%20created:${createdStart}..*&sort=stars&order=desc`

        try {
            const items = await this.githubManager.makePaginatedCall(endpoint);
            for (const item of items) {
                let ownerRepo = item.full_name.split('/');
                const owner = ownerRepo[0];
                const repo = ownerRepo[1];
                const default_branch = item.default_branch;
                await this.DB.insertRepoIntoDB(owner, repo, item);
                currentRepos.push({
                    owner,
                    repo,
                    default_branch
                });
            }
        } catch (searchError) {
            console.error(searchError);
        }
        return currentRepos;
    }

    async searchGitHubReposForWebAssembly() {
        const endpoint1 = `/search/repositories?q=language%3AWebAssembly&type=Repositories&sort=stars&order=desc`
        const endpoint2 = `/search/repositories?q=language%3AWebAssembly&type=Repositories&sort=stars&order=asc`
        try {
            const descItems: SearchResults = await this.githubManager.makeGitHubCall(endpoint1);
            const ascItems: SearchResults = await this.githubManager.makeGitHubCall(endpoint2);
            const handleItems = async (items:Item[]) => {
                for (const item of items) {
                    let ownerRepo = item.full_name.split('/');
                    const owner = ownerRepo[0];
                    const repo = ownerRepo[1];
                    await this.DB.insertRepoIntoDB(owner, repo, item);
                }
            }
            await handleItems(descItems.items);
            await handleItems(ascItems.items);

        } catch (searchError) {
            console.error(searchError);
        }
    }

    async getTimelineAPI(owner: string,repo: string,issueNumber: number){
        const timelineAPI = `/repos/${owner}/${repo}/issues/${issueNumber}/timeline`;
        let response;
        try{
            response = await this.githubManager.makePaginatedCall(timelineAPI);
        } catch(timelineFetchError){
            console.error(`Timeline fetch error`, timelineFetchError);
        }
        return response;
    }

    async getCommitInfo(owner: string,repo: string,commitSHA: string){
        const commitEndpoint = `/repos/${owner}/${repo}/commits/${commitSHA}`;
        let response;
        try {
            response = await this.githubManager.makeGitHubCall(commitEndpoint);
        } catch(getCommitError){
            console.error(`Get commit error`, getCommitError);
        }
        return response as CommitResponse;
    }

    async getCommitInfoFromCommitURL(commitURL: string){
        const commitEndpoint = commitURL.replace('https://api.github.com', '');
        let response = null;
        try{
            response = await this.githubManager.makeGitHubCall(commitEndpoint);
        }catch(commitFetchByURLError){
            console.error(`Error fetching commit by URL`, commitFetchByURLError)
        }
        return response;
    }

    async processTimelineEvents(owner: string,repo: string, issueID: number, timelineEventList: EventData[]){
        for(const timelineEvent of timelineEventList){
            try{
                const { sha } = timelineEvent;
                const eventStatus = timelineEvent.event;
                if(sha != null){
                    console.log('Commit SHA:', sha)
                    const commitDetails = await this.getCommitInfo(owner,repo,sha);
                    if(commitDetails == null){
                        continue
                    }
                    const commitMessage = commitDetails.commit.message;
                    await this.DB.insertCommitIntoDB(sha,issueID,commitMessage,commitDetails,timelineEvent, eventStatus);
                }
            } catch(eventErr){
                console.error('Timeline event processing error', eventErr);
                throw eventErr
            }
        }
    }

    async getIssuesTimelineInfo(){
        const issueList = await this.DB.getIssueList(true,true);
        console.log(issueList.length);
        for(const issueInfo of issueList){
            const {Owner, Repo, IssueNumber, ID} = issueInfo;
            const timelineResponse = await this.getTimelineAPI(Owner, Repo, IssueNumber);
            if(timelineResponse !== undefined){
                await this.DB.updateBugWithTimelineInfo(ID, timelineResponse);
                await this.processTimelineEvents(Owner, Repo, ID, timelineResponse);
            }
        }
        this.close();
    }

    async getAllCommitsForSingleRepo(owner: string, repo: string){
        const endpoint= `/repos/${owner}/${repo}/commits`;

        const commitList: CommitListResponse[] = await this.githubManager.makePaginatedCall(endpoint);
        for(const commit of commitList){ 
            const commitSha = commit.sha;
            const commitMessage = commit.commit.message;
            await this.DB.insertRawCommit(owner, repo, commitSha, commitMessage, commit);
        }
        console.log(`Fetched all ${commitList.length} for ${owner}/${repo}`); 
        return commitList;
    }

    async getAllCommitsForAllRepos(){
        const targetRepoList = await this.DB.getRepoList();
        console.log(targetRepoList.length);
        for(const ownerRepo of targetRepoList){
            const {owner,repo} = ownerRepo;
            const commitList = await this.getAllCommitsForSingleRepo(owner, repo);
            console.log(`Fetched all ${commitList.length} for ${owner}/${repo}`); 
        }
    }

        
    async getReleaseDates(){
        const targetRepoList = await this.DB.getRepoList();
        for(const ownerRepo of targetRepoList){
            const {owner,repo, repoID} = ownerRepo;
            const timelineAPI = `/repos/${owner}/${repo}/releases`;
            // const targetRepoList = await this.DB.getRepoList();
            try{
                let response = await this.githubManager.makePaginatedCall(timelineAPI);
                for(const result of response){
                    const createdDate= result.created_at
                    const publishedDate= result.published_at
                    const releaseID = result.id
                    await this.DB.insertRepoRelease(parseInt(repoID), repo, result, createdDate, publishedDate,releaseID);
                }
            } catch(timelineFetchError){
                console.error(`Timeline fetch error`, timelineFetchError);
            }
        }
        ;
    }

    async getFileContentInfoFromURL(contentURL: string){
        const contentEndpoint = contentURL.replace('https://api.github.com', '');
        let response = null;
        try{
            response = await this.githubManager.makeGitHubCall(contentEndpoint);
        }catch(contentFetchByURLError){
            console.error(`Error fetching content by URL`, contentFetchByURLError)
        }
        return response;
    }

    async getSingleRawCommitFileDetails(rawCommitID: number, owner: string, repo: string, sha: string){
            const commitDetails = await this.getCommitInfo(owner, repo, sha);
            await this.DB.updateRawCommitWithFullCommitDetails(rawCommitID, commitDetails);
            const {files} = commitDetails;
            for(const commitFile of files){
                const {filename, raw_url, contents_url,blob_url} = commitFile;
                await this.DB.insertRawCommitFileIntoDB(rawCommitID, owner,repo,filename,commitFile,raw_url, contents_url,blob_url);
            }
    }

    async getSingleRawCommit(owner: string, repo: string, sha: string){
        const commitDetails = await this.getCommitInfo(owner, repo, sha);
        await this.DB.insertRawCommit(owner, repo, sha, commitDetails.commit.message, undefined, commitDetails);
        let dbCommitDetails = await this.DB.getRawCommitBySHA(owner, repo, sha);
        const rawCommitID = dbCommitDetails?.ID;
        if( rawCommitID != null){
            const {files} = commitDetails;
            for(const commitFile of files){
                const {filename, raw_url, contents_url,blob_url} = commitFile;
                await this.DB.insertRawCommitFileIntoDB(rawCommitID, owner,repo,filename,commitFile,raw_url, contents_url,blob_url);
            }
        }

        return dbCommitDetails;
    }

    async getRawCommitFileDetails(){
        const rawCommitList = await this.DB.getAllRawCommits();
        for(const rawCommit of rawCommitList){
            const {ID, Owner,Repo, SHA} = rawCommit;
            const commitDetails = await this.getCommitInfo(Owner, Repo, SHA);
            await this.DB.updateRawCommitWithFullCommitDetails(ID, commitDetails);
            const {files} = commitDetails;
            for(const commitFile of files){
                const {filename, raw_url, contents_url,blob_url} = commitFile;
                await this.DB.insertRawCommitFileIntoDB(ID, Owner,Repo,filename,commitFile,raw_url, contents_url,blob_url);
            }
        }

        this.close()
    }

    waitFor(seconds: number): Promise<void>{
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, seconds * 1000)
        })
    }
    
    async getRawCommitFileDetailsInSwarm(crawlerIndex:number){
        
        await this.waitFor(2 * crawlerIndex);
        let rawCommit = await this.DB.getNextRawCommit();
        while(rawCommit != null){
            const {ID, Owner,Repo, SHA} = rawCommit;
            const commitDetails = await this.getCommitInfo(Owner, Repo, SHA);
            await this.DB.updateRawCommitWithFullCommitDetails(ID, commitDetails);
            const {files} = commitDetails;
            for(const commitFile of files){
                const {filename, raw_url, contents_url,blob_url} = commitFile;
                await this.DB.insertRawCommitFileIntoDB(ID, Owner,Repo,filename,commitFile,raw_url, contents_url,blob_url);
            }
            await this.waitFor(2 * crawlerIndex);
            rawCommit = await this.DB.getNextRawCommit()
        }
    }

    async getRawCommitFileDetailsForSingleCommit(rawCommit: DBRawCommit){
        if(rawCommit == null){
            this.close()
            return;
        }
        const randomSeconds = Math.floor(Math.random() * 4);
        await this.waitFor(randomSeconds);
        const {ID, Owner,Repo, SHA} = rawCommit;
        const commitDetails = await this.getCommitInfo(Owner, Repo, SHA);
        await this.DB.updateRawCommitWithFullCommitDetails(ID, commitDetails);
        const {files} = commitDetails;
        for(const commitFile of files){
            const {filename, raw_url, contents_url,blob_url} = commitFile;
            await this.DB.insertRawCommitFileIntoDB(ID, Owner,Repo,filename,commitFile,raw_url, contents_url,blob_url);
        }
    }

    async getAllFilesInRepo(){
        const targetRepoList = await this.DB.getRepoList();
        for(const repoDetails of targetRepoList){
            const {repoID, owner, repo} = repoDetails;
            try{
                const fileResults = await this.githubManager.getFilesThroughTreesAPI(owner,repo);
                await this.DB.updateRepoWithFileList(repoID, fileResults);
            } catch(getFilesError){
                console.error(':Get files Error:',getFilesError);
            }
        }
    }

    async getFileVersions(owner: string, repo: string, path: string){
        const endpoint = `/repos/${owner}/${repo}/commits?path=${path}`;
        let response: FileVersionResponse[] = [];
        try{
            response = await this.githubManager.makeGitHubCall(endpoint);
        } catch(fileVersionError){
            console.error(`Get File Versions Error`, fileVersionError);
        }
        return response;
    }

    async getRelevantFileVersionsMap(){
        const reposOfCommits = new Map<string,ChangeDetails[]>();
        const commitList = await this.DB.getTestCaseRawCommits();
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
            const rawResponse = com.CommitInfo as CommitResponse;
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

                const sourceExtensions = ['.c','.cpp','.h','.hpp','.ts','.rs', '.hs','.py','.go','.java','.js'];
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

        const changesTargetingTestWasmAndTestCase: Map<string, ChangeDetails[]> = new Map<string, ChangeDetails[]>();

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
                if(commit.changesTestWasmOrHandwritten()){
                    addCommit(changesTargetingTestWasmAndTestCase,commit)
                }
            }
        }
        // const results = {
        //     'Total changes': totalChanges,
        //     'Changes Test Case WebAssembly and Test Case Code': {
        //             'Length':  changesTargetingTestWasmAndTestCase.size,
        //             'Commits': changesTargetingTestWasmAndTestCase
        //         },
        // };

        // await writeFileAsync('./MyFileRaw.json', JSON.stringify(results));    
        return changesTargetingTestWasmAndTestCase
    }
    async handleGettingFileVersions(fileList: {filename:string}[], owner: string, repo: string){
        for(const fileDetails of fileList){
            const {filename} = fileDetails;
            //These files cause the program to hang when decoding
            if( ([
                'unittests/contracts/locals-s.wasm',
                'unittests/contracts/locals-yc.wasm',
                'unittests/contracts/slowwasm_localsets.wasm',
                'unittests/test_contracts/fuzz/locals-s.wasm',
                'unittests/test_contracts/fuzz/locals-yc.wasm',
                'unittests/test_contracts/fuzz/slowwasm_localsets.wasm',
                ].includes(filename)
            ) ){
                continue;
            }
            const alreadyFoundDetails = await this.DB.checkIfFileVersionExists(filename, owner, repo);
            if(alreadyFoundDetails != null){
                console.log(`Already found ${filename} on ${owner}/${repo}`)
                continue;
            }
            const fileVersions: FileVersionResponse[] = await this.getFileVersions(owner, repo,filename);
            let versionNumber = fileVersions.length;
            for(const version of fileVersions){
                try{
                    const date = version.commit.author.date;
                    const versionCommitSHA = version.sha;
                    let relevantCommitDetails = await this.DB.getRawCommitBySHA(owner, repo, versionCommitSHA);

                    if(relevantCommitDetails == null){
                        relevantCommitDetails = await this.getSingleRawCommit(owner, repo, versionCommitSHA);
                    }

                    if(relevantCommitDetails !== null){
                        let commitDetails = relevantCommitDetails.CommitInfo as CommitResponse;
                        if(commitDetails === null){
                            await this.getSingleRawCommitFileDetails(relevantCommitDetails.ID, relevantCommitDetails.Owner, relevantCommitDetails.Repo, relevantCommitDetails.SHA)
                            const newResponse = await this.DB.getRawCommitBySHA(owner, repo, versionCommitSHA);
                            if(newResponse != null){
                                commitDetails = newResponse.CommitInfo as CommitResponse;
                            }
                        } 
                        let commitFileDetails = commitDetails.files;
                        let targetFile = null;
                        for(const file of commitFileDetails){
                            if(file.filename === filename){
                                targetFile = file;
                                break;
                            }
                        }
                        let instructionCounts: any = null;
                        let raw_url = targetFile?.raw_url;
                        let contents_url = targetFile?.contents_url;
                        let contentDetails: any =null;
                        let linesOfCode = 0;

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
                        if(contents_url){
                            const contentResults = await this.getFileContentInfoFromURL(contents_url);
                            contentDetails = contentResults
                        }
                        await this.DB.insertRawCommitFileVersionIntoDB(versionCommitSHA, relevantCommitDetails.ID, filename, versionNumber, 
                                        date, version,targetFile, targetFile?.raw_url ?? null, owner, repo, instructionCounts, contentDetails, contents_url?? null, linesOfCode)
                    }
                } catch(getVersionsErr){
                    console.error(getVersionsErr)
                }
                versionNumber--;
            }
        }
    }
    async getAllFileVersionsWithRawCommits(){
        
        const changesTargetingTestWasmAndTestCase = await this.getRelevantFileVersionsMap();
        for(const [repo, changeList] of changesTargetingTestWasmAndTestCase.entries()){
            console.log(repo, changeList.length);
            for(const change of changeList){
                const commitDetails = change.Commit as DBRawCommit;
                const sha = commitDetails.SHA;
                const rawCommitID = commitDetails.ID;
                const repo = change.Repo;
                const owner = change.Owner;
                const fileList = change.Files;
                await this.handleGettingFileVersions(fileList, owner ,repo);
            }
        }

        this.close();
    }

static async initCrawlerForSwarm(mode: string){
    const tempDb =  new MySQLConnector();
    if(mode === 'file-versions-by-list-in-swarm'){
        if(GitHubCrawler.valueList.length == 0){
            GitHubCrawler.valueList = await tempDb.getRepoFileResponse();
        }
    } else if(mode === 'crawl-raw-files-in-group'){
        if(GitHubCrawler.valueList.length == 0){
            GitHubCrawler.valueList = await tempDb.getAllRawCommits()
        }
    }
    tempDb.close();

}

    async getFileVersionsByRepoFileListForSingleRepo(repo: any){
        const {ID,Owner,Repo, FileListResponse} = repo;
        if(typeof FileListResponse != 'string'){
            const filenames = FileListResponse
                .filter((fileDetails:any) => {
                    const extensions = ['.wasm', '.wat', '.wast','.c','.cc','.cpp','.h','.hpp','.ts','.rs', '.hs','.py','.go','.java','.js']
                    for(const ext of extensions){
                        if(fileDetails.path.includes('test') && fileDetails.path.endsWith(ext)){
                            return true
                        }
                    }
                })
                .map( (fileDetails: any) => { return {filename: fileDetails.path} } )

            await this.handleGettingFileVersions(filenames, Owner , Repo);
        }
    }

    async getFileVersionsByRepoFileList(){
        const repoDetailsList = await this.DB.getRepoFileResponse();
        for(const repo of repoDetailsList){
            await this.getFileVersionsByRepoFileListForSingleRepo(repo);

        }

        this.close()
    }
    close(){
        this.DB.close();
    }
}
