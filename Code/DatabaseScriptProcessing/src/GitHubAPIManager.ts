import axios from 'axios';
import { timeStamp } from 'console';
const listContent = require('list-github-dir-content');
const fetch = require('node-fetch'); // Automatically excluded in browser bundles

export class GitHubAPIManager {
    BASE_URL: string;
    apiLimit: null | number = null;
    firstRequestTime: null | number = null;
    resetTime: null | number = null;
    currentTokenIndex: number = 1;
    static standardTokens: string[] = [
        //<Add_GitHub_Tokens_Here>
        // 'fnkr:*****'

    ];
    tokens: string[];
    GitHubToken: string;

    constructor(tokensToUse?:string[]) {
        if(tokensToUse){
            this.tokens = tokensToUse;
            this.GitHubToken = tokensToUse[0]
        } else {
            this.tokens = GitHubAPIManager.standardTokens;
            this.GitHubToken = this.tokens[Math.floor(Math.random() * this.tokens.length)];
        }
        this.BASE_URL = `https://${this.GitHubToken}@api.github.com`
    }

    async getAPILimit() : Promise<[number, number]>{
        let currentStats = await axios({
            method: 'get',
            url: this.BASE_URL + '/rate_limit',
            headers: {
                'Authorization': this.GitHubToken
            }
        });;
        let remaining: number = currentStats.data.resources.core.remaining;
        let reset: number = currentStats.data.resources.core.reset;
        return [remaining, reset];
    }



    waitForSeconds(timeoutInSeconds: number) {
        console.log(`Starting wait for ${timeoutInSeconds} seconds!`)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, timeoutInSeconds * 1000)
        })
    }

    async switchToken() {
        let lastTokenIndex = this.currentTokenIndex;

        while (true) {
            this.currentTokenIndex = (this.currentTokenIndex + 1) % this.tokens.length;
            this.GitHubToken = this.tokens[this.currentTokenIndex];
            let apiLimitLeft = 0;

            try {
                const remainingCalls = await this.getAPILimit();
                apiLimitLeft = remainingCalls[0];
                this.apiLimit = apiLimitLeft;
                this.resetTime = remainingCalls[1];

                if (apiLimitLeft == 0) {
                    if (this.currentTokenIndex == lastTokenIndex) {
                        //If limit is reached
                        console.log('\n API Limit Reached !!! \n')
                        const currentTime = Date.now();
                        if (currentTime < this.resetTime) {
                            //If still need to wait for api
                            const timeDifference = this.resetTime - currentTime;
                            await this.waitForSeconds(timeDifference);
                        }
                        const remainingCalls = await this.getAPILimit();
                        this.apiLimit = remainingCalls[0];
                        this.resetTime = remainingCalls[1];
                        break
                    }
                }
            } catch (err) {
                console.error('Switch Token Error', err)
                continue
            }

            

        }

        this.BASE_URL = `https://${this.GitHubToken}@api.github.com`;
    }

    async ensureAPILimitAllowed() {
        if (this.apiLimit == null) {
            const remainingCalls = await this.getAPILimit();
            this.apiLimit = remainingCalls[0];
            this.resetTime = remainingCalls[1];
            console.log('REMAINING API CALLS:', this.apiLimit);
        }

        if (this.apiLimit === 0) {
            await this.switchToken();
        }

        this.apiLimit -= 1;
    }

    async makeGitHubCall(endpoint: string){
        await this.ensureAPILimitAllowed();
        const fullEndpoint: string = this.BASE_URL + endpoint;
        console.log(fullEndpoint);
        let response
        try{
            const results =  await axios({
                method: 'get',
                url: fullEndpoint,
                headers: {
                    'Authorization': this.GitHubToken,
                    'Accept': 'application/vnd.github.mockingbird-preview'
                }
            });
            response = results.data;
        }
        catch(networkCallError){
            const erroredResponse = networkCallError.response;
            if(erroredResponse){
                if(erroredResponse.status == 403){
                    this.switchToken();
                    const results =  await axios({
                        method: 'get',
                        url: fullEndpoint,
                        headers: {
                            'Authorization': this.GitHubToken,
                            'Accept': 'application/vnd.github.mockingbird-preview'
                        }
                    });
                    response = results.data;
                } else {
                    throw erroredResponse
                }
            } else {
                throw erroredResponse

            }

        }

        
        return response;
    }

    async makePaginatedCall(endpoint:string, callback?: (val: any) => Promise<any>){
        const jsonResponses = [];
        
        try {
            let page = 1;
            while (true) {
                const queryStringSeparator = (!/\?.+/.test(endpoint)) ? '?' : '&';
                let paginatedEndpoint = `${endpoint}${queryStringSeparator}page=${page}&per_page=100`;
                const currentPageItems = await this.makeGitHubCall(paginatedEndpoint);
                for (const pageItem of currentPageItems) {
                    if(callback){
                        callback(pageItem)
                    }
                    jsonResponses.push(pageItem);
                }
                if (currentPageItems.length == 0) {
                    break;
                }
                page += 1;
            }
        } catch (searchError) {
            console.error('Search Error',searchError)
            throw searchError;
        }
        finally{
            return jsonResponses;
        }
    }


    async viaContentsApi(
        owner:string,
        repository: string,
        directory:string = ''
    ): Promise<any> {
        const files = [];
        const requests = [];
        const enpoint = `/repos/${owner}/${repository}/contents/${directory}?ref=HEAD`;
        const contents = await this.makeGitHubCall(enpoint);

        if (contents.message === 'Not Found') {
            return [];
        }
    
        if (contents.message) {
            throw new Error(contents.message);
        }
    
        for (const item of contents) {
            if (item.type === 'file') {
                files.push(item);
            } else if (item.type === 'dir') {
                requests.push(() => this.viaContentsApi(owner, repository,item.path));
            }
        }
    
        for(const request of requests){
            const subfiles = await request();
            files.concat(subfiles)
        }
        return files
    }

    async viaTreesApi(
        owner:string,
        repository: string,
    ) {
        await this.ensureAPILimitAllowed();
    
        let files = [];
        const endpoint = `/repos/${owner}/${repository}/git/trees/HEAD?recursive=1`;
        const contents = await this.makeGitHubCall(endpoint)
        for (const item of contents.tree) {
            if (item.type === 'blob') {
                files.push(item);
            }
        }
        const truncated = contents.truncated;
        if(truncated){
            files = await this.viaContentsApi(owner,repository)
        }
        return files;
    }

    async getFilesThroughTreesAPI(owner: string,repo:string){
        let filesArray = [];
        try{
            filesArray = await this.viaTreesApi(owner, repo);
        } catch(err){
            console.error('Get Trees Error', err)
        }
        return filesArray;
    }

}

