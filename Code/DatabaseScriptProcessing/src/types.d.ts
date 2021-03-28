declare module 'untar-to-memory';

interface GitHubCommit {
    ID: number,
    SHA: string,
    IssueID: number,
    Title: string,
    RawResponse: CommitResponse | string,
    EventDetails: string,
    EventType: string,
    Repo: string,
    Owner: string
}

interface DBCommitFile {
    ID: number,
    IssueID: number,
    CommitID: number,
    RepoID: number,
    Repo: string,
    Filename: string,
    Additions: number,
    Deletions: number,
    RawURL: string,
    FileSHA: string
    ContentResponse: ContentResponse
}

export interface ContentResponse {
    name:         string;
    path:         string;
    sha:          string;
    size:         number;
    url:          string;
    html_url:     string;
    git_url:      string;
    download_url: string;
    type:         string;
    content:      string;
    encoding:     string;
    _links:       Links;
}

export interface Links {
    self: string;
    git:  string;
    html: string;
}


interface DBComponentCode {
    Component: string;
    IssueID: number;
    TestCaseCode:string;
}

interface DBComponentCount {
    Repo: string,
    ImpactCategory: string,
    Component: string,
    Total: number,
    TotalCount: number,
    Ratio: number
}


interface ComponentCodeSnippets {
    Component: string;
    CodeSnippets: TestCaseCodeSnippet[];
}

interface DBCommit {
    ID: number,
    SHA: string,
    IssueID: number,
    RawResponse: string,
    EventDetails: string
}



interface DBIssue {
    ID: number,
    Body: string,
    TimelineResponse: EventData[] ,
    Owner:string,
    Repo:string,
    IssueNumber:number,
    RawResponse: Issue 
}

interface DBRawCommit {
    ID: number,
    SHA: string,
    Owner:string,
    Repo:string,
    Title:string,
    RawResponse: FileVersionResponse | string;
    CommitInfo: CommitResponse | string;
}


interface TestCaseCodeSnippet {
    CodeText: string;
    Type?:string;
    Name?:string;
}

interface CommitListResponse {
    sha:          string;
    node_id:      string;
    commit:       CommitMetadata;
    url:          string;
    html_url:     string;
    comments_url: string;
    author:       Author;
    committer:    Author;
    parents:      Parent[];
}

interface DBRepoFileList {
    ID: number;
    Owner: string;
    Repo: string;
    FileListResponse: string | Tree[]; 
}


interface DBRawCommitFileVersion {
    ID: number;
    RawCommitSHA: string;
    RawCommitID: number;
    Filename: string;
    Version: number;
    CommitDate: string;
    VersionDetails: FileVersionResponse;
    FileDetails: CommitFile;
    RawURL: string;
    Owner: string;
    Repo:string;
    InstructionCounts: any | string;
    ContentDetails: any | string;
    ContentURL: string;
    WatLinesOfCode: number;
}

interface CommitFile {
    additions:    number;
    blob_url:     string;
    changes:      number;
    contents_url: string;
    deletions:    number;
    filename:     string;
    patch:        string;
    raw_url:      string;
    sha:          string;
    status:       string;
}

interface EventData {
    actor:               Actor;
    author_association?: string;
    body?:               string;
    created_at:          string;
    event:               string;
    html_url?:           string;
    id?:                 number;
    issue_url?:          string;
    node_id?:            string;
    updated_at?:         string;
    url?:                string;
    user?:               Actor;
    source?:             Source;
    commit_id?:          string;
    commit_url?:         string;
    author?:       Author;
    committer?:    Author;
    message?:      string;
    parents?:      Parent[];
    sha?:          string;
    tree?:         Tree;
    verification?: Verification;
}

interface Author {
    date:  string;
    email: string;
    name:  string;
}

interface Parent {
    html_url: string;
    sha:      string;
    url:      string;
}

interface Tree {
    sha: string;
    url: string;
}

interface Verification {
    payload:   null;
    reason:    string;
    signature: null;
    verified:  boolean;
}

interface CommitResponse {
    author:       SampleCommitResponseAuthor;
    comments_url: string;
    commit:       CommitMetadata;
    committer:    SampleCommitResponseAuthor;
    files:        CommitFile[];
    html_url:     string;
    node_id:      string;
    parents:      Parent[];
    sha:          string;
    stats:        Stats;
    url:          string;
}


interface DBIssueWithBugFix {
    ID: number;
    Repo: string;
    Title: string;
    URL: string;
    CreatedDate: string;
    BugFIxCommitSHA: string;
    BugFixCommitID: number;
    RawResponse: string | CommitResponse; 
}

interface SampleCommitResponseAuthor {
    avatar_url:          string;
    events_url:          string;
    followers_url:       string;
    following_url:       string;
    gists_url:           string;
    gravatar_id:         string;
    html_url:            string;
    id:                  number;
    login:               string;
    node_id:             string;
    organizations_url:   string;
    received_events_url: string;
    repos_url:           string;
    site_admin:          boolean;
    starred_url:         string;
    subscriptions_url:   string;
    type:                string;
    url:                 string;
}

export interface FileVersionResponse {
    sha:          string;
    node_id:      string;
    commit:       CommitMetadata;
    url:          string;
    html_url:     string;
    comments_url: string;
    author:       SampleCommitResponseAuthor | null;
    committer:    SampleCommitResponseAuthor;
    parents:      Parent[];
}

interface CommitMetadata {
    author:        CommitAuthor;
    comment_count: number;
    committer:     CommitAuthor;
    message:       string;
    tree:          Tree;
    url:           string;
    verification:  Verification;
}

interface CommitAuthor {
    date:  string;
    email: string;
    name:  string;
}


export interface TreeResponse {
    sha:       string;
    url:       string;
    tree:      Tree[];
    truncated: boolean;
}

export interface Tree {
    path:  string;
    mode:  string;
    type:  string;
    size?: number;
    sha:   string;
    url:   string;
}


interface Verification {
    payload:   null;
    reason:    string;
    signature: null;
    verified:  boolean;
}

interface Parent {
    html_url: string;
    sha:      string;
    url:      string;
}

interface Stats {
    additions: number;
    deletions: number;
    total:     number;
}

interface Actor {
    avatar_url:          string;
    events_url:          string;
    followers_url:       string;
    following_url:       string;
    gists_url:           string;
    gravatar_id:         string;
    html_url:            string;
    id:                  number;
    login:               string;
    node_id:             string;
    organizations_url:   string;
    received_events_url: string;
    repos_url:           string;
    site_admin:          boolean;
    starred_url:         string;
    subscriptions_url:   string;
    type:                string;
    url:                 string;
}

interface Source {
    issue: Issue;
    type:  string;
}

interface Label {
    id:          number;
    url:         string;
    name:        string;
    color:       string;
    default:     boolean;
    node_id:     string;
    description: null | string;
}

interface Issue {
    assignee:           null;
    assignees:          any[];
    author_association: string;
    body:               string;
    closed_at:          string;
    comments:           number;
    comments_url:       string;
    created_at:         string;
    events_url:         string;
    html_url:           string;
    id:                 number;
    labels:             Label[];
    labels_url:         string;
    locked:             boolean;
    milestone:          null;
    node_id:            string;
    number:             number;
    pull_request:       PullRequest;
    repository:         Repository;
    repository_url:     string;
    state:              string;
    title:              string;
    updated_at:         string;
    url:                string;
    user:               Actor;
}

interface PullRequest {
    diff_url:  string;
    html_url:  string;
    patch_url: string;
    url:       string;
}

interface Repository {
    archive_url:       string;
    archived:          boolean;
    assignees_url:     string;
    blobs_url:         string;
    branches_url:      string;
    clone_url:         string;
    collaborators_url: string;
    comments_url:      string;
    commits_url:       string;
    compare_url:       string;
    contents_url:      string;
    contributors_url:  string;
    created_at:        string;
    default_branch:    string;
    deployments_url:   string;
    description:       string;
    disabled:          boolean;
    downloads_url:     string;
    events_url:        string;
    fork:              boolean;
    forks:             number;
    forks_count:       number;
    forks_url:         string;
    full_name:         string;
    git_commits_url:   string;
    git_refs_url:      string;
    git_tags_url:      string;
    git_url:           string;
    has_downloads:     boolean;
    has_issues:        boolean;
    has_pages:         boolean;
    has_projects:      boolean;
    has_wiki:          boolean;
    homepage:          string;
    hooks_url:         string;
    html_url:          string;
    id:                number;
    issue_comment_url: string;
    issue_events_url:  string;
    issues_url:        string;
    keys_url:          string;
    labels_url:        string;
    language:          string;
    languages_url:     string;
    license:           License;
    merges_url:        string;
    milestones_url:    string;
    mirror_url:        null;
    name:              string;
    node_id:           string;
    notifications_url: string;
    open_issues:       number;
    open_issues_count: number;
    owner:             Actor;
    private:           boolean;
    pulls_url:         string;
    pushed_at:         string;
    releases_url:      string;
    size:              number;
    ssh_url:           string;
    stargazers_count:  number;
    stargazers_url:    string;
    statuses_url:      string;
    subscribers_url:   string;
    subscription_url:  string;
    svn_url:           string;
    tags_url:          string;
    teams_url:         string;
    trees_url:         string;
    updated_at:        string;
    url:               string;
    watchers:          number;
    watchers_count:    number;
}


interface Args {
    [x: string]: unknown;
    mode: string;
    _: string[];
    $0: string;
}

export interface SearchResults {
    total_count:        number;
    incomplete_results: boolean;
    items:              Item[];
}

export interface Item {
    id:                number;
    node_id:           string;
    name:              string;
    full_name:         string;
    private:           boolean;
    owner:             Owner;
    html_url:          string;
    description:       null | string;
    fork:              boolean;
    url:               string;
    forks_url:         string;
    keys_url:          string;
    collaborators_url: string;
    teams_url:         string;
    hooks_url:         string;
    issue_events_url:  string;
    events_url:        string;
    assignees_url:     string;
    branches_url:      string;
    tags_url:          string;
    blobs_url:         string;
    git_tags_url:      string;
    git_refs_url:      string;
    trees_url:         string;
    statuses_url:      string;
    languages_url:     string;
    stargazers_url:    string;
    contributors_url:  string;
    subscribers_url:   string;
    subscription_url:  string;
    commits_url:       string;
    git_commits_url:   string;
    comments_url:      string;
    issue_comment_url: string;
    contents_url:      string;
    compare_url:       string;
    merges_url:        string;
    archive_url:       string;
    downloads_url:     string;
    issues_url:        string;
    pulls_url:         string;
    milestones_url:    string;
    notifications_url: string;
    labels_url:        string;
    releases_url:      string;
    deployments_url:   string;
    created_at:        string;
    updated_at:        string;
    pushed_at:         string;
    git_url:           string;
    ssh_url:           string;
    clone_url:         string;
    svn_url:           string;
    homepage:          null | string;
    size:              number;
    stargazers_count:  number;
    watchers_count:    number;
    language:          Language;
    has_issues:        boolean;
    has_projects:      boolean;
    has_downloads:     boolean;
    has_wiki:          boolean;
    has_pages:         boolean;
    forks_count:       number;
    mirror_url:        null;
    archived:          boolean;
    disabled:          boolean;
    open_issues_count: number;
    license:           License | null;
    forks:             number;
    open_issues:       number;
    watchers:          number;
    default_branch:    DefaultBranch;
    permissions:       Permissions;
    score:             number;
}

export enum DefaultBranch {
    Master = "master",
}

export enum Language {
    WebAssembly = "WebAssembly",
}

export interface License {
    key:     string;
    name:    string;
    spdx_id: string;
    url:     null | string;
    node_id: string;
}

export interface Owner {
    login:               string;
    id:                  number;
    node_id:             string;
    avatar_url:          string;
    gravatar_id:         string;
    url:                 string;
    html_url:            string;
    followers_url:       string;
    following_url:       string;
    gists_url:           string;
    starred_url:         string;
    subscriptions_url:   string;
    organizations_url:   string;
    repos_url:           string;
    events_url:          string;
    received_events_url: string;
    type:                Type;
    site_admin:          boolean;
}

export enum Type {
    Organization = "Organization",
    User = "User",
}

export interface Permissions {
    admin: boolean;
    push:  boolean;
    pull:  boolean;
}
