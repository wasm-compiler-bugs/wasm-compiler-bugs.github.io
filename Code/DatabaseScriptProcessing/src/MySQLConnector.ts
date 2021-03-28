import mysql, { raw } from 'mysql';
import { LinkFound } from './Utils/LinkFound';
import {CodeSnippet } from './Utils/CodeSnippet';
import { DBIssue, DBIssueWithBugFix, DBCommit, DBRawCommit, CommitFile, DBCommitFile, ComponentCodeSnippets, DBComponentCode, TestCaseCodeSnippet, DBComponentCount, GitHubCommit, DBRawCommitFileVersion, DBRepoFileList } from './types';
import { resolve } from 'path';
import { version } from 'process';
const CONFIG = {
    "mysql_host": "localhost",
    "mysql_user": "root",
    "mysql_password": "password",
    "mysql_database": "webassembly_bugs",
    "mysql_port": "3306",
}

const PROD: boolean = process.env.NODE_ENV ? process.env.NODE_ENV == 'production' : false;

const envConfigs = {
    "mysql_host": PROD ? process.env.PROD_MYSQL_HOST : process.env.DEV_MYSQL_HOST,
    "mysql_user": PROD ? process.env.PROD_MYSQL_USER : process.env.DEV_MYSQL_USER,
    "mysql_password": PROD ? process.env.PROD_MYSQL_PASS : process.env.DEV_MYSQL_PASS,
    "mysql_port": PROD ? process.env.PROD_MYSQL_PORT : process.env.DEV_MYSQL_PORT,
    "mysql_database": "webassembly_bugs",
}

const mysql_host = envConfigs.mysql_host || CONFIG.mysql_host;
const mysql_user = envConfigs.mysql_user || CONFIG.mysql_user;
const mysql_password = envConfigs.mysql_password || CONFIG.mysql_password;
const mysql_database = envConfigs.mysql_database || CONFIG.mysql_database;
const mysql_port = envConfigs.mysql_port || CONFIG.mysql_port;

const nullGuard = (jsObj: any | null) => jsObj === null ? null : JSON.stringify(jsObj);

export class MySQLConnector {
    connection: mysql.Pool;
    close() {
        try{
            this.connection.end();
        }
        finally{
        }
    }
    constructor(host = mysql_host,
        user = mysql_user,
        password = mysql_password,
        database = mysql_database) {

            this.connection = mysql.createPool({
                host,
                user,
                password,
                database,
                multipleStatements: true,
                charset : 'utf8mb4',
                port: parseInt(mysql_port) 
            });


        // this.connection.connect();
    }

    query(queryString: string, escapeValues?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(queryString, escapeValues, function (error, results, fields) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(results)
            })
        })
    }

    async getIssueList(excludeNonEmpty = true, addFilters = true): Promise<DBIssue[]>{
        const excludeCondition = excludeNonEmpty ? ' WHERE a.TimelineResponse IS NULL ' : ' ';
        let wasmFilter = '';
        let bugFilter = '';
        let repoFilter = '';
        
        if(addFilters){
            wasmFilter = ` AND (
                Title LIKE '%wasm%'
                OR BODY LIKE '%wasm%'
                OR Title LIKE '% wat %'
                OR BODY LIKE '% wat %'
                OR Title LIKE '%WebAssembly%'
                OR BODY LIKE '%WebAssembly%' 
            ) `;

            bugFilter = `${excludeNonEmpty? 'AND' : ' WHERE'} YEAR(DATE(RawResponse ->> "$.created_at")) >= 2015
            AND State = 'closed'
            AND (
                Title LIKE '%bug%'
                OR BODY LIKE '%bug%' 
                OR Title LIKE '%error%'
                OR BODY LIKE '%error%' 
                OR Title LIKE '%defect%'
                OR BODY LIKE '%defect%' 
                OR Title LIKE '%fault%'
                OR BODY LIKE '%fault%' 
            )
            AND (
                Title NOT LIKE '%feature%'
                AND Body NOT LIKE '%feature%' 
                AND Title NOT LIKE '%install%'
                AND Body NOT LIKE '%install%' 
            ) `;

            repoFilter = ` AND RepoInfo ->> "$.watchers_count" >= 1000 `
        }
        
        const originalSQLQuery = `
        SELECT * FROM (
            SELECT a.ID, b.Owner, b.Repo, Title, HtmlURL, a.TimelineResponse,
            Body, 
            a.RawResponse,
            a.IssueNumber,
            DATE(a.RawResponse ->> "$.created_at") As CreatedDate,
            a.NumberOfComments,State,BugFixCommitSHA
            FROM webassembly_bugs.github_bugs a
            INNER JOIN webassembly_bugs.github_bug_repos b On a.RepoID = b.ID
            WHERE RepoID IN (
                SELECT ID FROM webassembly_bugs.github_bug_repos
                WHERE Repo IN (
                'rust'
                )
                ${repoFilter}
            )
            ${wasmFilter}

        ) a 
        ${excludeCondition}

        ${bugFilter}
        ORDER BY Owner ASC,Repo ASC, CreatedDate DESC;
        `;
        

        const datasetSQLQuery = `
        SELECT ID, Owner, Repo, Title, HtmlURL, 
            TimelineResponse,
            Body, 
            RawResponse,
            CreatedDate,
            NumberOfComments,
            State,
            BugFixCommitSHA
        FROM studydataset_issta2021;
        `

       
        let sqlQuery =  datasetSQLQuery; //originalSQLQuery
        let results: DBIssue[] = [];
        try{
            console.log(sqlQuery)
            results = await this.query(sqlQuery);
            for(const rawResult of results){
                if(typeof(rawResult.RawResponse) == 'string'){
                    rawResult.RawResponse = JSON.parse(rawResult.RawResponse)
                }

                if(typeof(rawResult.TimelineResponse) == 'string'){
                    rawResult.TimelineResponse = JSON.parse(rawResult.TimelineResponse)
                }
            }

        } catch(err){
            console.error('Get bug list error', err);
        }
        return results;
    }

    async getIssuesWithBugs(){
        const sqlQuery = `
        SELECT si.ID,Repo, si.Title, HTMLURL  AS URL, CreatedDate, si.BugFIxCommitSHA,si.BugFixCommitID , gbc.RawResponse 
        FROM webassembly_bugs.studydataset_issta2021 si
        INNER JOIN webassembly_bugs.github_bug_commits gbc ON si.BugFIxCommitID = gbc.ID
        ORDER BY ImpactCategory 
        `
        let results: DBIssueWithBugFix[] = [];
        try{
            results = await this.query(sqlQuery);
            for(const rawResult of results){
                if(typeof(rawResult.RawResponse) == 'string'){
                    rawResult.RawResponse = JSON.parse(rawResult.RawResponse)
                }
            }

        } catch(err){
            console.error('Get issue list with bug fix  error', err);
        }
        return results;
    }

    async getBugCommits(){
        const sqlQuery = `
            SELECT ID, SHA, IssueID, RawResponse, EventDetails
            FROM github_bug_commits
            ORDER BY ID;
        `
        let commitList: DBCommit[] = [];

        try{
            commitList = await this.query(sqlQuery);
        } catch(sqlErr){
            console.error('Get Commits Error', sqlErr);
        }
        return commitList;
    }

    async getCommitBySHA(commitSHA: string): Promise<DBCommit | null>{
        const sqlQuery = `
            SELECT ID, SHA, IssueID, RawResponse, EventDetails
            FROM github_bug_commits
            WHERE SHA = ?;
        `
        const sqlParams = [commitSHA];
        const commitList: DBCommit[] = await this.query(sqlQuery, sqlParams);
        if(commitList.length>0){
            return commitList[0];
        } else {
            return null;
        }
    }

    async getIssueFromBugID(bugID: number): Promise<DBIssue | null>{
        const sqlQuery = `
        SELECT a.ID,b.Owner, b.Repo,a.RawResponse ->> "$.number" AS IssueNumber,
            a.TimelineResponse, a.Body
        FROM github_bugs a
        INNER JOIN github_bug_repos b On a.RepoID = b.ID
        WHERE BugID = ?`;
        const sqlParams = [bugID];
        try{
            const issuesFound: DBIssue[] = await this.query(sqlQuery, sqlParams);
            if(issuesFound .length > 0){
                const issueToReturn  = issuesFound[0];
                if(typeof(issueToReturn.RawResponse) == 'string'){
                    issueToReturn.RawResponse = JSON.parse(issueToReturn.RawResponse)
                }

                if(typeof(issueToReturn.TimelineResponse) == 'string'){
                    issueToReturn.TimelineResponse = JSON.parse(issueToReturn.TimelineResponse)
                }
                return issueToReturn;
            } else {
                return null;
            }
        } catch(sqlError){
            console.error(`Couldn't find issue with bugID ${bugID}`,sqlError);
            return null;
        }
    }

    async updateLinesOfCodeChanged(issueID: number, locChanged: number, commitSHA: string, filenamesChanged: string[], bugFixCommitID: number): Promise<void>{
        const numberOfFilesChanged = filenamesChanged.length;
        const sqlQuery = `
            Update studydataset_issta2021
            SET TotalLinesOfCodeChanged = ?,
            BugFixCommitSHA=?,
            FilesforBugFix=?,
            BugFixFileNames=?,
            BugFixCommitID=?
            WHERE ID = ?;
        `

        const sqlParams = [locChanged, commitSHA,numberOfFilesChanged,nullGuard(filenamesChanged), bugFixCommitID, issueID];
        await this.query(sqlQuery, sqlParams);
    }

    async insertBugFixFunctionName(issueID: number, bugFixCommitID: number, filename: string, functionName: string, InFirstLineOfPatch: boolean,Language: string,rawURL:string){
        const sqlQuery = `
        INSERT INTO github_bug_fix_function_names_affect
        (IssueID, BugFixCommitID, Filename, FunctionName, InFirstLineOfPatch, \`Language\`, RawURL)
        VALUES(?, ?, ?, ?, ?, ?,?);
        `
        const sqlParams = [issueID, bugFixCommitID, filename, functionName, InFirstLineOfPatch ? 1 : 0,Language,rawURL];
        try{
            await this.query(sqlQuery, sqlParams);

        } catch(sqlErr){
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert bug fix function name error', sqlErr);
            }
        }

    }

    async insertCommitIntoDB(commitSHA: any,bugID: any, title: any, commitJSON: any, eventJSON: any, eventType: any){
        const sqlQuery = `INSERT INTO github_bug_commits(
            SHA,
            IssueID,
            Title,
            RawResponse,
            EventDetails,
            EventType
            ) VALUES (?,?,?,?,?,?);`;
        const sqlParams = [commitSHA,bugID, title, nullGuard(commitJSON), nullGuard(eventJSON), eventType];
        try{
            await this.query(sqlQuery, sqlParams);
        } catch(sqlErr){
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert commit error', sqlErr);
            }
        }
    }

    async updateBugWithTimelineInfo(bugID: number, timelineJSON: string | any[] | null) {
        if(timelineJSON != null && timelineJSON.length > 0){
            const sqlQuery = `UPDATE github_bugs
            SET TimelineResponse = ?
            WHERE ID = ?;`
            const sqlParams = [nullGuard(timelineJSON), bugID];
            try {
                await this.query(sqlQuery, sqlParams);
            } catch (sqlErr) {
                if (sqlErr.code !== 'ER_DUP_ENTRY') {
                    console.error('Update Bug Error', sqlErr);
                }
            }
        }
    }

    async insertRawCommit(owner:string, repo:string,commitSHA: string, commitMessage: string, commitJSON?: any, commitDetailsJSON?: any){
        let sqlQuery;
        let sqlParams;
        if(commitDetailsJSON){
            sqlQuery = `
            INSERT INTO github_raw_commits(SHA, Owner, Repo,Title, CommitInfo)
            VALUES (?,?,?,?,?);
            `;
            sqlParams = [commitSHA, owner, repo,commitMessage, nullGuard(commitDetailsJSON)];
        } else {
            sqlQuery = `
            INSERT INTO github_raw_commits(SHA, Owner, Repo,Title,RawResponse)
            VALUES (?,?,?,?,?);
            `;
            sqlParams = [commitSHA, owner, repo,commitMessage, nullGuard(commitJSON)];
        }


        try{
            await this.query(sqlQuery, sqlParams);
        } catch(sqlErr){
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert commit error', sqlErr);
            }
        } 
    }

    async insertBugIntoDB(repoID: number, rawResponse: any, bugID: number, title: string, state: string, body: string, htmlURL: string, comments: number) {
        const sqlQuery = `INSERT INTO github_bugs(RepoID,RawResponse,BugID,Title,State,Body,HtmlURL,NumberOfComments)
                            VALUES (?,?,?,?,?,?,?,?);`
        const sqlParams = [repoID, nullGuard(rawResponse), bugID, title, state, body, htmlURL, comments];

        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error(sqlErr);
            }
        }
    }

    async insertIssueResponseInfoIntoDB(owner: string, repo: string, response: any) {
        const sqlQuery = `
            UPDATE github_bug_repos
            SET Response = ?
            WHERE Owner = ? AND Repo = ?;
            `
        const sqlParams = [nullGuard(response), owner, repo];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            console.error(sqlErr);
        }
    }

    async insertRepoIntoDB(owner: string, repo: string, repoInfo: any) {
        const sqlQuery = `INSERT INTO github_bug_repos(Owner,Repo, RepoInfo) VALUES (?,?,?);`
        const sqlParams = [owner, repo, nullGuard(repoInfo)];

        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error(sqlErr);
            }
        }
    }

    async insertTopicRepoRelationIntoDB(owner: string, repo: string, topic: string) {
        const sqlQuery = `SET @repoID = NULL;
         SELECT @repoID := ID From github_bug_repos Where Owner = ? AND Repo = ?;
         INSERT INTO topics_giving_repos(Owner,Repo,Topic,RepoID) VALUES (?,?,?,@repoID);`
        const sqlParams = [owner, repo, owner, repo, topic];

        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error(sqlErr);
            }
        }
    }

    async getRepoList() {
        const repoList = []
        const sqlQuery = `
        SELECT ID, Owner,Repo FROM github_bug_repos
        WHERE RepoInfo ->> "$.watchers_count" >= 1000
        AND IsAwesomeWasm = 1 
        AND Repo IN (
            'wasi',
            'wasm3',
            'wac',
            'asmble',
            'wasmachine',
            'olin',
            'wasmer',
            'go-ext-wasm',
            'python-ext-wasm',
            'php-ext-wasm',
            'ruby-ext-wasm',
            'postgres-ext-wasm',
            'warpy',
            'wasmtime',
            'pywasm',
            'wasabi',
            'manticore',
            'emscripten',
            'binaryen',
            'AssemblyScript',
            'tinygo',
            'wasm-bindgen',
            'ilwasm',
            'asterius',
            'ppci-mirror',
            'Bytecoder',
            'ChakraCore',
            'v8'
        )
        ;`
        const allQuery =`
            SELECT ID, Owner,Repo FROM github_bug_repos
            WHERE FileListResponse IS NULL
            OR JSON_Length(FileListResponse) = 0;
        `
        const dbResults = await this.query(allQuery);

        for (const row of dbResults) {
            repoList.push({
                owner: row.Owner,
                repo: row.Repo,
                repoID: row.ID
            });
        }

        return repoList;
    }

    async getRepoFileResponse(): Promise<DBRepoFileList[]>{
        const sqlQuery = `
            SELECT ID, Owner, Repo, FileListResponse 
            FROM github_bug_repos
            WHERE Repo IN (
                "wasm",
                "wasmer",
                "wasmer",
                "eos",
                "eos",
                "bottos",
                "eos-go",
                "wagon",
                "graph-node",
                "TurboScript",
                "pyeos",
                "ChakraCore",
                "binaryen",
                "node-chakracore",
                "WaspVM",
                "wasm-intro",
                "mutator",
                "nearcore",
                "opa",
                "webpack",
                "wasm-examples",
                "AssemblyScript",
                "AssemblyScript",
                "node",
                "v8",
                "twiggy",
                "graaljs",
                "ecmascript-modules",
                "http2",
                "worker",
                "nebulet",
                "wasabi",
                "emscripten",
                "emscripten",
                "js-webassembly-interpreter",
                "webassemblyjs",
                "wasmdec",
                "wasmtime",
                "gxb-core",
                "offline-plugin",
                "wasmint",
                "ayo",
                "enumivo",
                "nodejs-mobile",
                "ApertusVR",
                "node-v8",
                "WebAssembly",
                "isolated-vm",
                "systemjs",
                "jsos",
                "layaair-doc",
                "node-jsc",
                "asmble",
                "parcel",
                "wasm",
                "pywasm",
                "greenwasm",
                "pywebassembly",
                "ab",
                "columbia",
                "tiny-wasm",
                "bnny",
                "matmachjs",
                "vnt-wasm",
                "ultra_script",
                "WebAssembly",
                "webassembly-with-rust",
                "webassembly-with-rust",
                "WebAssembly",
                "web-assembly",
                "wasmcheckers",
                "wat-2-wasm-exercises",
                "Tasks",
                "go-wasmi",
                "webassembly-egghead",
                "webassembly-tests",
                "course-get-started-using-webassembly-wasm",
                "wasm-rust",
                "rust-wasm",
                "rust-wasm",
                "wmvm",
                "icpe2020_spmv",
                "wasm-draughts",
                "emscripten-wasm-bug-shr",
                "Bytecoder",
                "wasm3",
                "olin",
                "go-ext-wasm",
                "python-ext-wasm",
                "php-ext-wasm",
                "ruby-ext-wasm",
                "postgres-ext-wasm",
                "wasmtime",
                "manticore",
                "eufa",
                "parity-wasm"
            )
            AND Owner IN (
                "haskell-wasm",
                "wafoundation",
                "wasmerio",
                "EOS-Mainnet",
                "EOSIO",
                "Bottos-project",
                "eosspark",
                "go-interpreter",
                "graphprotocol",
                "01alchemist",
                "learnforpractice",
                "Microsoft",
                "WebAssembly",
                "nodejs",
                "ElixiumNetwork",
                "guybedford",
                "bloodstalker",
                "nearprotocol",
                "open-policy-agent",
                "webpack",
                "Hanks10100",
                "AssemblyScript",
                "dcodeIO",
                "nodejs",
                "v8",
                "rustwasm",
                "graalvm",
                "nodejs",
                "nodejs",
                "nodejs",
                "Nebulet",
                "danleh",
                "emscripten-core",
                "kripken",
                "xtuc",
                "xtuc",
                "wwwg",
                "bytecodealliance",
                "gxchain",
                "NekR",
                "WebAssembly",
                "ayojs",
                "enumivo",
                "janeasystems",
                "MTASZTAKI",
                "nodejs",
                "dcodeIO",
                "laverdet",
                "systemjs",
                "PROPHESSOR",
                "layabox",
                "mceSystems",
                "cretz",
                "parcel-bundler",
                "sdiehl",
                "mohanson",
                "Kimundi",
                "poemm",
                "ab-vm",
                "evanphx",
                "tinychain",
                "FantasyInternet",
                "Sable",
                "vntchain",
                "DanielMazurkiewicz",
                "frankshin",
                "rajraj",
                "riccardomarotti",
                "Sissi-2017",
                "wf225",
                "zhubaiyuan",
                "data-pup",
                "tareq97",
                "cs3238-tsuzu",
                "cbrevik",
                "dnnagy",
                "realityforge",
                "davelively14",
                "neozenith",
                "matthewjberger",
                "wwwg",
                "Sable",
                "rustiphyde",
                "brion",
                "mirkosertic",
                "wasm3",
                "Xe",
                "wasmerio",
                "wasmerio",
                "wasmerio",
                "wasmerio",
                "wasmerio",
                "CraneStation",
                "trailofbits",
                "becavalier",
                "paritytech"
            )

        `
        let results: DBRepoFileList[] = []
        try{
            results = await this.query(sqlQuery);
            for( const res of results){
                if( typeof res.FileListResponse == 'string'){
                    res.FileListResponse = JSON.parse(res.FileListResponse)
                }
            }
        } catch(sqlError){
            console.error('Get file list:', sqlError)
        }

        return results;
    }
    async checkIfFileVersionExists(filename: string, owner: string, repo: string){
        const sqlQuery = `
            SELECT * FROM github_bug_test_case_file_versions
            WHERE Filename = ? AND Owner = ? AND Repo = ?;
        `
        const sqlParams = [filename, owner, repo];
        
        let rawCommitList: DBRawCommitFileVersion[] = [];
        try{
            rawCommitList = await this.query(sqlQuery,sqlParams);
            for(const row of rawCommitList){
                if(typeof row.VersionDetails === 'string'){
                    row.VersionDetails = JSON.parse(row.VersionDetails);
                }
                if(typeof row.FileDetails === 'string'){
                    row.FileDetails = JSON.parse(row.FileDetails);
                }
            }
            if(rawCommitList.length === 0){
                return null;
            } else { 
                return rawCommitList[0]
            }
        } catch(sqlError){
            return null
        }

    }

    async getFileVersionLists(){
        const sqlQuery = `
            SELECT * FROM webassembly_bugs.github_bug_test_case_file_versions
            WHERE InstructionCounts IS NULL;
        `;
        
        let rawCommitList: DBRawCommitFileVersion[] = [];
        try{
            rawCommitList = await this.query(sqlQuery);
            for(const row of rawCommitList){
                if(typeof row.VersionDetails === 'string'){
                    row.VersionDetails = JSON.parse(row.VersionDetails);
                }
                if(typeof row.FileDetails === 'string'){
                    row.FileDetails = JSON.parse(row.FileDetails);
                }
                if(typeof row.InstructionCounts === 'string'){
                    row.InstructionCounts = JSON.parse(row.InstructionCounts);
                }
                if(typeof row.ContentDetails === 'string'){
                    row.ContentDetails = JSON.parse(row.ContentDetails);
                }
            }
            return rawCommitList;
            
        } catch(sqlError){
            return null
        }
    }
    async insertRawCommitFileVersionIntoDB(rawCommitSha: string, rawCommitID: number, filename:string, version:number, commitDate:string, versionDetails:any,
            fileDetails: any, rawURL: string | null, owner: string, repo: string, instructionCounts: any, contentDetails: any, contentURL: string | null, linesOfCode: number){
        const sqlQuery = `
            INSERT INTO github_bug_test_case_file_versions (RawCommitSHA, RawCommitID, Filename, Version, CommitDate, VersionDetails,
                    FileDetails, RawURL, Owner, Repo, InstructionCounts, ContentDetails, ContentURL,WatLinesOfCode)
            VALUES(?, ? ,? ,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `

        const sqlParams = [rawCommitSha, rawCommitID, filename, version,commitDate, nullGuard(versionDetails), nullGuard(fileDetails), rawURL, 
            owner, repo, nullGuard(instructionCounts), nullGuard(contentDetails), contentURL, linesOfCode];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
            console.error(sqlErr);
            }
        }
    }

    async updateFileVersionInstructionCount(fileVersionID: number, instructionCounts: any, watLinesOfCode: number){
        const sqlQuery = `
            UPDATE github_bug_test_case_file_versions
            SET InstructionCounts = ?,
            WatLinesOfCode = ?
            WHERE ID = ?;
        `
        const sqlParams = [nullGuard(instructionCounts),watLinesOfCode, fileVersionID];
        try{
            await this.query(sqlQuery, sqlParams);
        } catch(sqlError){
            console.error('Update Instructions Counts: ', sqlError);
        }
    }

    async getRawCommitBySHA(owner: string,repo:string, sha: string){
        const sqlQuery = `
            SELECT ID, SHA, Owner,Repo,Title,RawResponse, CommitInfo
            FROM github_raw_commits
            WHERE Owner = ? AND Repo = ? AND SHA = ?;
        `

        const sqlParams = [ owner, repo, sha];
        let rawCommitList: DBRawCommit[] = [];
        try{
            rawCommitList = await this.query(sqlQuery,sqlParams);
            for(const row of rawCommitList){
                if(typeof row.RawResponse === 'string'){
                    row.RawResponse = JSON.parse(row.RawResponse);
                }
                if(typeof row.CommitInfo === 'string'){
                    row.CommitInfo = JSON.parse(row.CommitInfo);
                }
            }
            if(rawCommitList.length == 0){
                return null
            } else {
                return rawCommitList[0]
            }
        } catch(sqlError){
            return null
        }
    }

    async getRawCommitByID(rawCommitID: number){
        const sqlQuery = `
            SELECT ID, SHA, Owner,Repo,Title,RawResponse, CommitInfo
            FROM github_raw_commits
            WHERE ID = ?;
        `

        const sqlParams = [ rawCommitID];
        let rawCommitList: DBRawCommit[] = [];
        try{
            rawCommitList = await this.query(sqlQuery,sqlParams);
            return rawCommitList[0]
        } catch(sqlError){
            return null;
        }
    }

    async getTestCaseRawCommits(): Promise<DBRawCommit[]> {
        const sqlQuery = `
        SELECT ID, SHA, Owner,Repo,Title,RawResponse, CommitInfo
        FROM github_raw_commits
        WHERE Repo IN (
            "wasm",
            "wasmer",
            "wasmer",
            "eos",
            "eos",
            "bottos",
            "eos-go",
            "wagon",
            "graph-node",
            "TurboScript",
            "pyeos",
            "ChakraCore",
            "binaryen",
            "node-chakracore",
            "WaspVM",
            "wasm-intro",
            "mutator",
            "nearcore",
            "opa",
            "webpack",
            "wasm-examples",
            "AssemblyScript",
            "AssemblyScript",
            "node",
            "v8",
            "twiggy",
            "graaljs",
            "ecmascript-modules",
            "http2",
            "worker",
            "nebulet",
            "wasabi",
            "emscripten",
            "emscripten",
            "js-webassembly-interpreter",
            "webassemblyjs",
            "wasmdec",
            "wasmtime",
            "gxb-core",
            "offline-plugin",
            "wasmint",
            "ayo",
            "enumivo",
            "nodejs-mobile",
            "ApertusVR",
            "node-v8",
            "WebAssembly",
            "isolated-vm",
            "systemjs",
            "jsos",
            "layaair-doc",
            "node-jsc",
            "asmble",
            "parcel",
            "wasm",
            "pywasm",
            "greenwasm",
            "pywebassembly",
            "ab",
            "columbia",
            "tiny-wasm",
            "bnny",
            "matmachjs",
            "vnt-wasm",
            "ultra_script",
            "WebAssembly",
            "webassembly-with-rust",
            "webassembly-with-rust",
            "WebAssembly",
            "web-assembly",
            "wasmcheckers",
            "wat-2-wasm-exercises",
            "Tasks",
            "go-wasmi",
            "webassembly-egghead",
            "webassembly-tests",
            "course-get-started-using-webassembly-wasm",
            "wasm-rust",
            "rust-wasm",
            "rust-wasm",
            "wmvm",
            "icpe2020_spmv",
            "wasm-draughts",
            "emscripten-wasm-bug-shr",
            "Bytecoder",
            "wasm3",
            "olin",
            "go-ext-wasm",
            "python-ext-wasm",
            "php-ext-wasm",
            "ruby-ext-wasm",
            "postgres-ext-wasm",
            "wasmtime",
            "manticore",
            "eufa",
            "parity-wasm"
            )
            AND Owner IN (
            "haskell-wasm",
            "wafoundation",
            "wasmerio",
            "EOS-Mainnet",
            "EOSIO",
            "Bottos-project",
            "eosspark",
            "go-interpreter",
            "graphprotocol",
            "01alchemist",
            "learnforpractice",
            "Microsoft",
            "WebAssembly",
            "nodejs",
            "ElixiumNetwork",
            "guybedford",
            "bloodstalker",
            "nearprotocol",
            "open-policy-agent",
            "webpack",
            "Hanks10100",
            "AssemblyScript",
            "dcodeIO",
            "nodejs",
            "v8",
            "rustwasm",
            "graalvm",
            "nodejs",
            "nodejs",
            "nodejs",
            "Nebulet",
            "danleh",
            "emscripten-core",
            "kripken",
            "xtuc",
            "xtuc",
            "wwwg",
            "bytecodealliance",
            "gxchain",
            "NekR",
            "WebAssembly",
            "ayojs",
            "enumivo",
            "janeasystems",
            "MTASZTAKI",
            "nodejs",
            "dcodeIO",
            "laverdet",
            "systemjs",
            "PROPHESSOR",
            "layabox",
            "mceSystems",
            "cretz",
            "parcel-bundler",
            "sdiehl",
            "mohanson",
            "Kimundi",
            "poemm",
            "ab-vm",
            "evanphx",
            "tinychain",
            "FantasyInternet",
            "Sable",
            "vntchain",
            "DanielMazurkiewicz",
            "frankshin",
            "rajraj",
            "riccardomarotti",
            "Sissi-2017",
            "wf225",
            "zhubaiyuan",
            "data-pup",
            "tareq97",
            "cs3238-tsuzu",
            "cbrevik",
            "dnnagy",
            "realityforge",
            "davelively14",
            "neozenith",
            "matthewjberger",
            "wwwg",
            "Sable",
            "rustiphyde",
            "brion",
            "mirkosertic",
            "wasm3",
            "Xe",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "CraneStation",
            "trailofbits",
            "becavalier",
            "paritytech"
            )
            AND ID NOT IN (
                SELECT RawCommitID FROM github_bug_test_case_file_versions
            )
            LIMIT 50000;
        `;

        
        let rawCommitList: DBRawCommit[] = [];
        try{
            rawCommitList = await this.query(sqlQuery);
            for(const row of rawCommitList){
                if(typeof row.RawResponse === 'string'){
                    row.RawResponse = JSON.parse(row.RawResponse);
                }
                if(typeof row.CommitInfo === 'string'){
                    row.CommitInfo = JSON.parse(row.CommitInfo);
                }
            }
        } catch(sqlErr){
            console.error('Error fetching raw commit list', sqlErr);
        }
        return rawCommitList;
    }
    async getAllRawCommits(): Promise<DBRawCommit[]> {
        const sqlQuery = `
        SELECT ID, SHA, Owner,Repo,Title, CommitInfo
        FROM github_raw_commits
        WHERE CommitInfo IS NULL
        AND Repo IN (
            "wasm",
            "wasmer",
            "wasmer",
            "eos",
            "eos",
            "bottos",
            "eos-go",
            "wagon",
            "graph-node",
            "TurboScript",
            "pyeos",
            "ChakraCore",
            "binaryen",
            "node-chakracore",
            "WaspVM",
            "wasm-intro",
            "mutator",
            "nearcore",
            "opa",
            "webpack",
            "wasm-examples",
            "AssemblyScript",
            "AssemblyScript",
            "node",
            "v8",
            "twiggy",
            "graaljs",
            "ecmascript-modules",
            "http2",
            "worker",
            "nebulet",
            "wasabi",
            "emscripten",
            "emscripten",
            "js-webassembly-interpreter",
            "webassemblyjs",
            "wasmdec",
            "wasmtime",
            "gxb-core",
            "offline-plugin",
            "wasmint",
            "ayo",
            "enumivo",
            "nodejs-mobile",
            "ApertusVR",
            "node-v8",
            "WebAssembly",
            "isolated-vm",
            "systemjs",
            "jsos",
            "layaair-doc",
            "node-jsc",
            "asmble",
            "parcel",
            "wasm",
            "pywasm",
            "greenwasm",
            "pywebassembly",
            "ab",
            "columbia",
            "tiny-wasm",
            "bnny",
            "matmachjs",
            "vnt-wasm",
            "ultra_script",
            "WebAssembly",
            "webassembly-with-rust",
            "webassembly-with-rust",
            "WebAssembly",
            "web-assembly",
            "wasmcheckers",
            "wat-2-wasm-exercises",
            "Tasks",
            "go-wasmi",
            "webassembly-egghead",
            "webassembly-tests",
            "course-get-started-using-webassembly-wasm",
            "wasm-rust",
            "rust-wasm",
            "rust-wasm",
            "wmvm",
            "icpe2020_spmv",
            "wasm-draughts",
            "emscripten-wasm-bug-shr",
            "Bytecoder",
            "wasm3",
            "olin",
            "go-ext-wasm",
            "python-ext-wasm",
            "php-ext-wasm",
            "ruby-ext-wasm",
            "postgres-ext-wasm",
            "wasmtime",
            "manticore",
            "eufa",
            "parity-wasm"
            )
            AND Owner IN (
            "haskell-wasm",
            "wafoundation",
            "wasmerio",
            "EOS-Mainnet",
            "EOSIO",
            "Bottos-project",
            "eosspark",
            "go-interpreter",
            "graphprotocol",
            "01alchemist",
            "learnforpractice",
            "Microsoft",
            "WebAssembly",
            "nodejs",
            "ElixiumNetwork",
            "guybedford",
            "bloodstalker",
            "nearprotocol",
            "open-policy-agent",
            "webpack",
            "Hanks10100",
            "AssemblyScript",
            "dcodeIO",
            "nodejs",
            "v8",
            "rustwasm",
            "graalvm",
            "nodejs",
            "nodejs",
            "nodejs",
            "Nebulet",
            "danleh",
            "emscripten-core",
            "kripken",
            "xtuc",
            "xtuc",
            "wwwg",
            "bytecodealliance",
            "gxchain",
            "NekR",
            "WebAssembly",
            "ayojs",
            "enumivo",
            "janeasystems",
            "MTASZTAKI",
            "nodejs",
            "dcodeIO",
            "laverdet",
            "systemjs",
            "PROPHESSOR",
            "layabox",
            "mceSystems",
            "cretz",
            "parcel-bundler",
            "sdiehl",
            "mohanson",
            "Kimundi",
            "poemm",
            "ab-vm",
            "evanphx",
            "tinychain",
            "FantasyInternet",
            "Sable",
            "vntchain",
            "DanielMazurkiewicz",
            "frankshin",
            "rajraj",
            "riccardomarotti",
            "Sissi-2017",
            "wf225",
            "zhubaiyuan",
            "data-pup",
            "tareq97",
            "cs3238-tsuzu",
            "cbrevik",
            "dnnagy",
            "realityforge",
            "davelively14",
            "neozenith",
            "matthewjberger",
            "wwwg",
            "Sable",
            "rustiphyde",
            "brion",
            "mirkosertic",
            "wasm3",
            "Xe",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "CraneStation",
            "trailofbits",
            "becavalier",
            "paritytech"
            )
        `;
        let rawCommitList: DBRawCommit[] = [];
        try{
            rawCommitList = await this.query(sqlQuery);
            for(const row of rawCommitList){
                if(typeof row.CommitInfo === 'string'){
                    row.CommitInfo = JSON.parse(row.CommitInfo);
                }
            }
        } catch(sqlErr){
            console.error('Error fetching raw commit list', sqlErr);
        }
        return rawCommitList;
    }

    getNextRawCommit(): Promise<DBRawCommit|null> {
        const sqlQuery = `
        SELECT @nextRank := ID
        FROM github_raw_commits
        WHERE CheckedOut = 0
        AND  Repo IN (
            "wasm",
            "wasmer",
            "wasmer",
            "eos",
            "eos",
            "bottos",
            "eos-go",
            "wagon",
            "graph-node",
            "TurboScript",
            "pyeos",
            "ChakraCore",
            "binaryen",
            "node-chakracore",
            "WaspVM",
            "wasm-intro",
            "mutator",
            "nearcore",
            "opa",
            "webpack",
            "wasm-examples",
            "AssemblyScript",
            "AssemblyScript",
            "node",
            "v8",
            "twiggy",
            "graaljs",
            "ecmascript-modules",
            "http2",
            "worker",
            "nebulet",
            "wasabi",
            "emscripten",
            "emscripten",
            "js-webassembly-interpreter",
            "webassemblyjs",
            "wasmdec",
            "wasmtime",
            "gxb-core",
            "offline-plugin",
            "wasmint",
            "ayo",
            "enumivo",
            "nodejs-mobile",
            "ApertusVR",
            "node-v8",
            "WebAssembly",
            "isolated-vm",
            "systemjs",
            "jsos",
            "layaair-doc",
            "node-jsc",
            "asmble",
            "parcel",
            "wasm",
            "pywasm",
            "greenwasm",
            "pywebassembly",
            "ab",
            "columbia",
            "tiny-wasm",
            "bnny",
            "matmachjs",
            "vnt-wasm",
            "ultra_script",
            "WebAssembly",
            "webassembly-with-rust",
            "webassembly-with-rust",
            "WebAssembly",
            "web-assembly",
            "wasmcheckers",
            "wat-2-wasm-exercises",
            "Tasks",
            "go-wasmi",
            "webassembly-egghead",
            "webassembly-tests",
            "course-get-started-using-webassembly-wasm",
            "wasm-rust",
            "rust-wasm",
            "rust-wasm",
            "wmvm",
            "icpe2020_spmv",
            "wasm-draughts",
            "emscripten-wasm-bug-shr",
            "Bytecoder",
            "wasm3",
            "olin",
            "go-ext-wasm",
            "python-ext-wasm",
            "php-ext-wasm",
            "ruby-ext-wasm",
            "postgres-ext-wasm",
            "wasmtime",
            "manticore",
            "eufa",
            "parity-wasm"
            )
            AND Owner IN (
            "haskell-wasm",
            "wafoundation",
            "wasmerio",
            "EOS-Mainnet",
            "EOSIO",
            "Bottos-project",
            "eosspark",
            "go-interpreter",
            "graphprotocol",
            "01alchemist",
            "learnforpractice",
            "Microsoft",
            "WebAssembly",
            "nodejs",
            "ElixiumNetwork",
            "guybedford",
            "bloodstalker",
            "nearprotocol",
            "open-policy-agent",
            "webpack",
            "Hanks10100",
            "AssemblyScript",
            "dcodeIO",
            "nodejs",
            "v8",
            "rustwasm",
            "graalvm",
            "nodejs",
            "nodejs",
            "nodejs",
            "Nebulet",
            "danleh",
            "emscripten-core",
            "kripken",
            "xtuc",
            "xtuc",
            "wwwg",
            "bytecodealliance",
            "gxchain",
            "NekR",
            "WebAssembly",
            "ayojs",
            "enumivo",
            "janeasystems",
            "MTASZTAKI",
            "nodejs",
            "dcodeIO",
            "laverdet",
            "systemjs",
            "PROPHESSOR",
            "layabox",
            "mceSystems",
            "cretz",
            "parcel-bundler",
            "sdiehl",
            "mohanson",
            "Kimundi",
            "poemm",
            "ab-vm",
            "evanphx",
            "tinychain",
            "FantasyInternet",
            "Sable",
            "vntchain",
            "DanielMazurkiewicz",
            "frankshin",
            "rajraj",
            "riccardomarotti",
            "Sissi-2017",
            "wf225",
            "zhubaiyuan",
            "data-pup",
            "tareq97",
            "cs3238-tsuzu",
            "cbrevik",
            "dnnagy",
            "realityforge",
            "davelively14",
            "neozenith",
            "matthewjberger",
            "wwwg",
            "Sable",
            "rustiphyde",
            "brion",
            "mirkosertic",
            "wasm3",
            "Xe",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "wasmerio",
            "CraneStation",
            "trailofbits",
            "becavalier",
            "paritytech"
            )
        ORDER BY ID 
        LIMIT 1;
        UPDATE github_raw_commits
        SET CheckedOut = 1
        WHERE ID = @nextRank;
        SELECT ID, SHA, Owner,Repo,Title,RawResponse, CommitInfo
        FROM github_raw_commits
        WHERE ID = @nextRank;
        `;
        
        return new Promise((resolve,reject) => {
            this.connection.getConnection((sqlEr, connection) => {
                if(sqlEr){
                    console.error('Error fetching raw commit list', sqlEr);
                    resolve(null)
                } else {
                    connection.beginTransaction(function(err) {
                    if (err) {                  //Transaction Error (Rollback and release connection)
                        connection.rollback(function() {
                            connection.release();
                            resolve(null);
                        });
                    } else {
                        //Transaction successful
                        connection.query(sqlQuery,function(queryErr, results) {
                            if (queryErr) {          //Query Error (Rollback and release connection)
                                connection.rollback(function() {
                                    connection.release();
                                    resolve(null);
                                });
                            } else {
                                connection.commit(function(commitErr) {
                                    if (commitErr) {
                                        connection.rollback(function() {
                                            connection.release();
                                            resolve(null);
                                        });
                                    } else {
                                        const rawCommitList = results[2][0] as DBRawCommit; //[2] for multiple SQL statements
                                        connection.release();
                                        resolve(rawCommitList);
                                    }
                                });
                            }
                        });
                    }
                })
                }
            })
        });
    }

    async updateRepoWithFileList(repoID: number, response: any){
        const sqlQuery = `
        UPDATE github_bug_repos
        SET FileListResponse = ?
        WHERE ID = ?
        `
        const sqlParams = [nullGuard(response), repoID];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            console.error('Update repo with file list response Error', sqlErr);
        }
    }

    async updateRawCommitWithFullCommitDetails(rawCommitID: number, detailsJson: any){
        const sqlQuery = `
            UPDATE github_raw_commits
            SET CommitInfo = ?
            WHERE ID = ?
        `
        const sqlParams = [nullGuard(detailsJson), rawCommitID];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Update raw commit details Error', sqlErr);
            } 
        }
    }

    async insertRawCommitFileIntoDB(rawCommitID: number, owner:string, repo: string, filename:string, rawResponse: any, rawURL: string, contentURL: string, blobURL:string ){
        const sqlQuery = `
            INSERT INTO webassembly_bugs.github_bugs_raw_commit_files
            (RawCommitID, Owner, Repo, Filename, RawResponse, RawURL, ContentURL, BlobURL)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?);
        `

        const sqlParams = [rawCommitID, owner,repo,filename,nullGuard(rawResponse), rawURL, contentURL, blobURL];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert raw commit file Error', sqlErr);
            } 
        }
    }

    async getIssueFromIssueNumber(issueNumber: number, owner:string,repo:string): Promise<DBIssue | null>{
        const sqlQuery = `
            SELECT a.ID, b.Owner, b.Repo,
                a.IssueNumber,
                a.TimelineResponse, a.Body
            FROM github_bugs a
            INNER JOIN github_bug_repos b On a.RepoID = b.ID
            WHERE a.IssueNumber = ?
            AND b.Owner = ?
            AND b.Repo = ?;
        `;
        const sqlParams = [issueNumber, owner, repo];
        let issue: DBIssue | null = null;
        try {
            issue = await this.query(sqlQuery, sqlParams);
        } catch (sqlError) {
            console.error('Get issue from issue number', sqlError);
        }
        return issue;
    }

    async insertTestCasesForBugs(issueID: number, codeSnippets: CodeSnippet[], linksFound: LinkFound[]){
        let totalLOC = 0;
        let totalFilesTestCaseCount = 0;
        let testCaseFileNames = [];
        // let fullcodeSnippetString = '';
        const fullCodeList = [];

        for(const snippet of codeSnippets){
            totalLOC += snippet.LinesOfCode;
            // fullcodeSnippetString += (`\n----|${snippet.Type}|----\n` + snippet.CodeText + '\n-------------------------\n' );
            fullCodeList.push(snippet)
        }
        for(const linkFound of linksFound){
            totalLOC += linkFound.LinesOfCode;
            totalFilesTestCaseCount += linkFound.NumberOfFilesUsed;
            if(linkFound.Name){
                testCaseFileNames.push(linkFound.Name)
            }
            fullCodeList.push(linkFound)
            // fullcodeSnippetString += ((`\n----|${linkFound.URL}|----\n` + linkFound.CodeText + '\n-------------------------\n' ));
        }
        const sqlQuery = `
            UPDATE github_bugs
            SET TestCaseLOC = ?,
            TestCaseCode = ?,
            FilesForTestCase=?,
            TestCaseFileNames=?
            WHERE ID = ?`;
        const sqlParams = [totalLOC, nullGuard(fullCodeList), totalFilesTestCaseCount, nullGuard(testCaseFileNames), issueID];
        try{
            await this.query(sqlQuery, sqlParams);
        } catch(sqlError){
            console.error('Error inserting code snippet', sqlError);
        }
    }

    async insertLabelsForIssue(issueID: number, labels: string[]){
        const sqlQuery = `
            INSERT INTO github_bug_labels(IssueID, Label)
            VALUES (?,?);
            `
        for(const label of labels){
            const sqlParams = [issueID, label];
            try {
                await this.query(sqlQuery, sqlParams);
            } catch (sqlErr) {
                if (sqlErr.code !== 'ER_DUP_ENTRY') {
                    console.error('Insert label Error', sqlErr);
                } 
            }
        }
    }

    async insertFilesChangedForIssue(issueID: number,commitID: number, files: CommitFile[]){
        const sqlQuery = `
        INSERT INTO github_bug_files_changed(
            IssueID, 
            CommitID, 
            Filename, 
            Additions,
            Deletions,
            RawURL,
            FileSHA)
        VALUES (?,?,?,?,?,?,?);
        `
        for(const file of files){
            const sqlParams = [issueID, commitID, file.filename,file.additions,file.deletions,file.raw_url,file.sha];
            try {
                await this.query(sqlQuery, sqlParams);
            } catch (sqlErr) {
                if (sqlErr.code !== 'ER_DUP_ENTRY') {
                    console.error('Insert file Error', sqlErr);
                } 
            }
        }
    }

    async updateContentDetailsForFile(fileID: number, content: any){
        const sqlQuery = `
            UPDATE github_bug_files_changed
            SET ContentResponse = ?
            WHERE ID = ?;
        `
        const sqlParams = [nullGuard(content), fileID]
        try{
            await this.query(sqlQuery,sqlParams);
        } catch(sqlErr){
            console.error('Error updating commit file content', sqlErr);
        }
    }

    async getFilesChangedInCommit(){
        const sqlQuery = `
            SELECT ID,
            -- b.RepoID,b.Repo,
            IssueID, CommitID, Filename, Additions, Deletions, RawURL, FileSHA, ContentResponse
            FROM github_bug_files_changed a
            WHERE ContentResponse IS NULL
        `

        let commitFileList: DBCommitFile[] = [];
        try{
            commitFileList = await this.query(sqlQuery);
        } catch(sqlErr){
            console.error('Error fetching commit file list', sqlErr);
        }
        return commitFileList; 
    }

    async insertIssueComponent(issueID: number, repoID: number, component: string, fileID: number){
        const sqlQuery = `
            INSERT INTO github_bug_components(IssueID,RepoID,Component,FileChangedID)
            VALUES(?,?,?,?);
        `
        const sqlParams = [issueID, repoID, component, fileID]
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert component Error', sqlErr);
            } 
        }
    }
    
    async insertRepoRelease(repoID: number, repo: string, releaseJSON: any,creeatedDate: any,publishedDate:any, releaseNumber: number){
        const sqlQuery = `
            INSERT INTO github_bug_releases
            (RepoID,Repo, RawResponse,ReleaseCreatedDate,ReleasePublishedDate,ReleaseNumber)
            VALUES (?,?,?,?,?,?);
        `
        const sqlParams = [repoID, repo,nullGuard(releaseJSON),creeatedDate,publishedDate,releaseNumber];
        try {
            await this.query(sqlQuery, sqlParams);
        } catch (sqlErr) {
            if (sqlErr.code !== 'ER_DUP_ENTRY') {
                console.error('Insert release Error', sqlErr);
            } 
        }
    }

    async getCommitFileArraysForIssues(){
        // Don't need this, this gives fix patches code instead of intended test case
        // Only need Emscripten C/C++ files for this
        const compilerOfInterest = 'emscripten'

        const sqlQuery = `
        SELECT RawResponse ->> "$.files" FROM github_bug_commits
        WHERE IssueID IN
        (
            SELECT IssueID FROM webassembly_bugs.github_bug_components
            WHERE (RepoID, Component) IN 
            (
                SELECT RepoID, Component FROM 
                (
                    SELECT b.RepoID,Component, COUNT(DISTINCT(IssueID)) AS Totals
                    FROM webassembly_bugs.studydataset_issta2021 a
                    INNER JOIN webassembly_bugs.github_bug_components b ON a.ID = b.IssueID
                    WHERE Component <> 'miscellaneous'
                    AND Repo = '${compilerOfInterest}'
                    GROUP BY b.RepoID, Component
                    ORDER BY b.RepoID, Totals DESC, Component
                ) x
                WHERe x.Totals > 10
            )
        )
        `
    }

    async getCodeSnippetForEmscriptenComponents(){
        const sqlQuery  = `
        SELECT DISTINCT Component, IssueID, si.TestCaseCode
        FROM github_bug_components ghb
        Inner JOIN studydataset_issta2021 si On ghb.IssueID  = si.ID 
        WHERE 
        TestCaseCode  IS NOT NULL 
        AND
        (ghb.RepoID ,Component ) IN (
            SELECT b.RepoID, Component
            FROM studydataset_issta2021 a
            INNER JOIN github_bug_components b ON a.ID = b.IssueID
            WHERE Component <> 'miscellaneous'
            AND Repo = 'emscripten'
            GROUP BY b.RepoID, Component
            HAVING COUNT(DISTINCT(IssueID)) > 10
            ORDER BY  Component
        )
        ORDER BY Component 
        `
        const codeSnippetsForComponent: ComponentCodeSnippets[] = []
        try{
        const codeSnippetEntries: DBComponentCode[] = await this.query(sqlQuery);
        let currentComponent = codeSnippetEntries[0].Component;
        let componentDetails: ComponentCodeSnippets = {Component: currentComponent, CodeSnippets: []};
        for(const entry of codeSnippetEntries){
            if(entry.Component !== currentComponent){
                codeSnippetsForComponent.push(componentDetails);
                componentDetails = {Component: entry.Component, CodeSnippets: []};
            }
            const snippets: TestCaseCodeSnippet[] = JSON.parse(entry.TestCaseCode);
            const textFromSnippets: TestCaseCodeSnippet[] = snippets.map(snip => {
                let codeType = snip.Type;
                if(!codeType){
                    const filename = snip.Name;
                    if(filename != null){
                        codeType = filename.substring(filename.lastIndexOf('.') + 1);
                    } else {
                        if(snip.CodeText.includes('int') || snip.CodeText.includes('void')
                        || snip.CodeText.includes('char') || snip.CodeText.includes('*')
                        || snip.CodeText.includes('short') || snip.CodeText.includes('long')){
                            codeType = 'c';
                        }
                    }
                }
                return {CodeText: snip.CodeText, Type: codeType }
            });
            componentDetails.CodeSnippets.push(...textFromSnippets)
            currentComponent = entry.Component;
        }
        } catch(sqlErr){
            console.error('Error fetching commit file list', sqlErr);
        }
        return codeSnippetsForComponent; 
    }

    async getIssueComponentCounts(){
        let getIssueComponentCounts: DBComponentCount[] = [];
        const sqlQuery = `
            SELECT si.Repo ,ImpactCategory, gbc.Component, COUNT(* ) AS Total, x.TotalCount, COUNT(* ) / x.TotalCount * 100 As Ratio
            FROM webassembly_bugs.studydataset_issta2021 si 
            INNER JOIN webassembly_bugs.github_bug_components gbc ON si.ID = gbc.IssueID 
            INNER JOIN (
                SELECT Repo, Component, COUNT(*) AS TotalCount
                FROM webassembly_bugs.studydataset_issta2021 xi
                INNER JOIN webassembly_bugs.github_bug_components xbc ON xi.ID = xbc.IssueID 
                GROUP BY Repo, Component
            ) x On si.Repo = x.Repo AND gbc.Component  = x.Component
            WHERE ImpactCategory NOT IN (
                'Fixing other issues'
            )
            AND gbc.Component NOT IN (
                'Miscellaneous'
            )
            GROUP BY si.Repo, ImpactCategory, gbc.Component
            ORDER BY Repo, Ratio DESC,  gbc.Component, ImpactCategory;
        `;
        try{
            getIssueComponentCounts = await this.query(sqlQuery);
        } catch(err){
            console.error('Get issue Component Counts', err);
        }
        return getIssueComponentCounts;
    }

    async getGitHubCommits(){
        const sqlQuery = `
            SELECT gbc.ID, gbc.SHA, gbc.IssueID, gbc.RawResponse, gbc.Title, gbc.EventDetails, gbc.EventType,gbr.Repo,gbr.Owner
            FROM github_bug_commits gbc
            INNER JOIN github_bugs gb ON gbc.IssueID = gb.ID 
            INNER JOIN github_bug_repos gbr ON gbr.ID  = gb.RepoID 
        `;
        let results: GitHubCommit[] = [];
        try{
            results = await this.query(sqlQuery);
            for(const res of results){
                if(typeof res.RawResponse == 'string'){
                    res.RawResponse = JSON.parse(res.RawResponse);
                }
            }
        } catch(sqlError){
            console.error(sqlError);
        }
        return results;
    }

    async getVersionInstructionCounts(){
        const sqlQuery = `
            SELECT ID, RawCommitSHA, RawCommitID, Filename, InstructionCounts
            FROM github_bug_test_case_file_versions
        `
        let rawCommitList: DBRawCommitFileVersion[] = [];
        try{
            rawCommitList = await this.query(sqlQuery);
            for(const row of rawCommitList){

                if(typeof row.InstructionCounts === 'string' && row.InstructionCounts != null ){
                    row.InstructionCounts = JSON.parse(row.InstructionCounts);
                }
            }

        } catch(sqlError){
            console.error('Get versions with instruction counts:', sqlError)
        }

        return rawCommitList;
    }

    async updateInstructionCounts(versionID: number, updatedInstructionCount: any){
        const sqlQuery = `
            UPDATE github_bug_test_case_file_versions
            SET InstructionCounts = ? 
            WHERE ID = ?;
        `

        const sqlParams = [nullGuard(updatedInstructionCount), versionID];
        try{
            await this.query(sqlQuery, sqlParams);
        }
        catch(updateInstructionCountsError){
            console.error('Updated instruction counts: ', updateInstructionCountsError)
        }
    }


}
module.exports.MySQLConnector = MySQLConnector;