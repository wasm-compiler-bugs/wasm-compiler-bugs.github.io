import {GitHubCrawler} from './GithubCrawler';
import {GitHubInfoProcessor} from './GitHubInfoProcessor';
import yargs from 'yargs';
import { GitHubAPIManager } from './GitHubAPIManager';
const {argv} = 
yargs
.options({
    'mode': {
        alias: 'm',
        type: 'string',
        describe: 'The script functionality to use',
        demandOption: true,
        choices: [
            'crawl-wasm-repos',
            'crawl-topic','crawl-timeline', 'bug-fix',
            'crawl-commits', 'test-case',
            'releases',
            'crawl-issues', 'add-repo','get-file-content','count_functions'
        ]
    }
})
.help();
const PROD: boolean = process.env.NODE_ENV ? process.env.NODE_ENV == 'production' : false;

async function performInParallel(mode: string, functionNameToUse: string){
    let tokensToUse = GitHubAPIManager.standardTokens.map(token=> [token]);
    return GitHubCrawler.initCrawlerForSwarm(mode)
    .then(() => {
        const arrayToUse = GitHubCrawler.valueList;
        if(arrayToUse.length < tokensToUse.length){
            tokensToUse = tokensToUse.slice(0, arrayToUse.length)
        }
        const crawlers = tokensToUse.map( tokensList =>  new GitHubCrawler(argv, tokensList));
        const pickUpNextTask = function (crawler: GitHubCrawler) {
            if (arrayToUse.length) {
                const nextValue = arrayToUse.shift()
                if(nextValue){
                    //@ts-ignore
                    return crawler[functionNameToUse](nextValue);
                } else{
                    return Promise.resolve();
                }
            }
            else {
                return Promise.resolve();
            }
        };

        const startChain = function (crawler: GitHubCrawler) {
            return Promise.resolve().then(function next(): Promise<void> {
                return pickUpNextTask(crawler).then(next);
            });
        }
        const crawlerTasks = crawlers.map( (crawler) =>  startChain(crawler));

        return Promise.allSettled(crawlerTasks)
    })
}

const {mode} = argv;
let mainPromise:Promise<any> = Promise.resolve();
console.log(`EXECUTING CODE IN ${PROD ? 'PROD' : "DEV"} WITH MODE '${mode}'`)

if(mode === 'crawl-topic'){
    //Crawls a GiitHub Topic using the search API
    const crawler = new GitHubCrawler(argv);
    const QUERY = 'WebAssembly'
    mainPromise = crawler.searchTopGitHubRepos(QUERY).then(() => {
        crawler.close();
    });
}  
if(mode === 'crawl-wasm-repos'){
    //Crawls repositories that contain WebAssembly
    const crawler = new GitHubCrawler(argv);
    mainPromise = crawler.searchGitHubReposForWebAssembly().then(() => {
        crawler.close();
    });
}  
else if(mode === 'add-repo'){
    //Adds a repository to the database
    const crawler = new GitHubCrawler(argv);
    if( argv._.length < 2){
        console.log('Need to give as arguments: owner repo')
        process.exit(-1)
    }
    const owner = argv._[0]
    const repo = argv._[1]
    mainPromise = crawler.searchRepo(owner, repo).then(() => {
        crawler.close();
    });
}  
else if(mode === 'crawl-timeline'){
    //Crawls the timeline/issue conversation of issues using the Timeline API
    const crawler = new GitHubCrawler(argv);
    mainPromise = crawler.getIssuesTimelineInfo().then(() => {
        crawler.close();
    });
}  
else if(mode === 'crawl-commits'){
    //Crawls all the commits for all the repos in the database
    const crawler = new GitHubCrawler(argv);
    mainPromise = crawler.getAllCommitsForAllRepos().then(() => {
        crawler.close();
    });
}
else if(mode === 'crawl-commits-for-repo'){
    //Crawls all the commits for a single repo
    const crawler = new GitHubCrawler(argv);
    const owner = argv._[0]
    const repo = argv._[1]
    mainPromise = crawler.getAllCommitsForSingleRepo(owner, repo).then(() => {
        crawler.close();
    });
}
else if(mode === 'crawl-issues'){
    //Crawls all the issues for a single repo
    const crawler = new GitHubCrawler(argv);
    if( argv._.length < 3){
        console.log('Need to give as arguments: owner repo repoID')
        process.exit(-1)
    }
    const owner = argv._[0]
    const repo = argv._[1]
    const repoId = parseInt(argv._[2])
    mainPromise = crawler.searchRepoIssues(owner,repo,repoId).then(() => {
        crawler.close();
    });
}
else if (mode === 'bug-fix'){
    //Search the issue conversation/timeline to find the last commit made before closing the issue
    const processor = new GitHubInfoProcessor(argv);
    mainPromise = processor.findAllLastCommits().then(() => {
        processor.close();
    });
} else if(mode === 'test-case'){
    //Search the issue initial post for links or code snippets
    const processor = new GitHubInfoProcessor(argv);
    mainPromise = processor.scanIssuesForTestCase().then(() => {
        processor.close();
    });
}  else if(mode === 'releases'){
    //Get the release information for the repos in the database
    const crawler = new GitHubCrawler(argv);
    mainPromise = crawler.getReleaseDates().then(() => {
        crawler.close();
    });
} 
else if( mode === 'get-file-content'){
    //Gets the content of all the bug fix files

    const processor = new GitHubInfoProcessor(argv);
    mainPromise = processor.handleFileChangedContent().then(() => {
        processor.close();
    });
} else if( mode === 'count_functions'){
    //Searches the bug fix content for function names
    const processor = new GitHubInfoProcessor(argv);
    mainPromise = processor.scanIssuesForBugFixFunctionNames().then(() => {
        processor.close();
    });
} 

mainPromise.then(()=> {
    console.log(`\nAll done!\nLAST ENTRYPOINT: ${(new Date()).toLocaleString()}`);
});

