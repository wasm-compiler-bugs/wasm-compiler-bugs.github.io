import { CommitFile, CommitResponse, DBRawCommit, GitHubCommit } from "../types";

export default class ChangeDetails {
    Wasm: boolean;
    TestWasm:boolean;
    Handwritten: boolean;
    Source:boolean;
    Test: boolean;
    Files: CommitFile[];
    URL: string;
    Owner: string;
    Repo: string;
    Commit?: DBRawCommit | GitHubCommit;

    constructor(wasm: boolean, testWasm: boolean, handwritten: boolean, source: boolean, test: boolean, files: CommitFile[], htmlUrl:string, owner: string, repo: string, commit?: DBRawCommit | GitHubCommit){
        this.Wasm = wasm;
        this.TestWasm = testWasm;
        this.Handwritten = handwritten;
        this.Source = source;
        this.Test = test;
        this.Files = files;
        this.URL = htmlUrl;
        this.Owner = owner;
        this.Repo = repo;
        this.Commit = commit;
    }

    toJSON(){
        return {
            Wasm: this.Wasm,
            TestWasm: this.TestWasm,
            Handwritten: this.Handwritten,
            Source: this.Source,
            Test: this.Test,
            Files: this.Files,
            URL: this.URL,
            Owner: this.Owner,
            Repo: this.Repo
        }
    }

    isTargetChange(){
        return this.Wasm || this.TestWasm;
    }

    changesWasmAndSourceCode(){
        return this.Wasm && this.Source
    }

    changesWasmAndTestCase(){
        return this.Wasm && this.Test
    }
    changesTestCaseWasmAndSourceCode(){
        return this.TestWasm && this.Source
    }

    changesTestCaseWasmAndTestCase(){
        return this.TestWasm && this.Test
    }

    changesTestWasmOrHandwritten(){
        return this.Wasm || this.TestWasm || this.Handwritten
    }
} 