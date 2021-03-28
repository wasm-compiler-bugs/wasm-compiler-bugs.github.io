enum Language{
    C = 'C',
    TS = 'TS',
    RUST ='RUST',
    PYTHON = 'PYTHON',
    GO = 'GO',
    HASKELL = 'HASKELL'
}

export class FunctionDeclaration {
    Language: Language;
    Code: string;
    Name: string = '';
    FoundInFirstLine: boolean = false;

    constructor(language: Language, code: string){
        this.Language = language;
        this.Code = code;
    }

    wasFoundInFirstLine(){
        this.FoundInFirstLine = true;
    }

    private handleStandardParen(){
        const {Code} = this;
        let indexOfOpeningParen = Code.indexOf('(');
        if(Code.charAt(indexOfOpeningParen - 1) == '>'){
            this.handleTypeGeneric();
            return;
        } 
        else if(Code.charAt(indexOfOpeningParen - 1) == ' '){
            indexOfOpeningParen -= 1;
        }

        const indexofPreviousSpace = Code.lastIndexOf(' ', indexOfOpeningParen);
        const functionName = Code.substring(indexofPreviousSpace + 1, indexOfOpeningParen)
        
        if(functionName == 'function'){
            if(Code.includes(':')){
                this.handleFuncInObject()
            }
        } else {
            this.Name = functionName;
        }
    }

    private handleTypeGeneric(){
        const {Code} = this;
        const indexOfOpeningParen = Code.indexOf('(');
        const indexOfOpeningAngleBracket= Code.lastIndexOf('<', indexOfOpeningParen);
        const indexofPreviousSpace = Code.lastIndexOf(' ', indexOfOpeningAngleBracket);
        const functionName = Code.substring(indexofPreviousSpace + 1, indexOfOpeningAngleBracket)
        this.Name = functionName;
    }

    private handleFuncInVariable(){
        const {Code} = this;
        const equalSignIndex = Code.indexOf('=') - 2
        const indexofPreviousSpace = Code.lastIndexOf(' ', equalSignIndex)
        const functionName = Code.substring(indexofPreviousSpace + 1, equalSignIndex +1);
        this.Name = functionName;
    }

    private handleFuncInObject(){
        //contains function and :
        const {Code} = this;
        const colonIndex = Code.indexOf(':')
        const indexofPreviousSpace = Code.lastIndexOf(' ', colonIndex)
        let functionName;
        if( indexofPreviousSpace === -1){
            functionName = Code.substring(0, colonIndex);
        } else {
            functionName = Code.substring(indexofPreviousSpace + 1, colonIndex);
        }
        this.Name = functionName;

    }

    private handleGo(){
        const {Code} = this;
        const allParenIndices = this.getAllIndices('(', Code);
        for(const idx of allParenIndices){
            const charBeforeParen = Code.charAt(idx - 1);
            if(charBeforeParen !== ' '){
                const indexOfOpeningParen = idx; //second opening parenethesis
                const indexofPreviousSpace = Code.lastIndexOf(' ', indexOfOpeningParen);
                const functionName = Code.substring(indexofPreviousSpace + 1, indexOfOpeningParen)
                this.Name = functionName;
            }
        }
    }

    private handleHaskell(){
        const {Code} = this;
        const indexOfDoubleColon = Code.indexOf('::') - 2;
        const indexofPreviousSpace = Code.lastIndexOf(' ', indexOfDoubleColon);
        const functionName = Code.substring(indexofPreviousSpace + 1, indexOfDoubleColon + 1)
        this.Name = functionName;
    }
    private getAllIndices(substring:string,string:string){
        var a=[],i=-1;
        while((i=string.indexOf(substring,i+1)) >= 0) a.push(i);
        return a;
    }

    parseLineForName(){
        const {Code} = this;
        if(this.Language == Language.TS){
            if(Code.includes('=') && !Code.includes('=>')
                && Code.indexOf('=') < Code.indexOf('{')
            ){
                this.handleFuncInVariable();
            } else {
                this.handleStandardParen()
            }
        }
        else if(this.Language == Language.C){
            if(Code.includes('=')
                && Code.indexOf('=') < Code.indexOf('{')
            ){
                this.handleFuncInVariable();

            } else {
                this.handleStandardParen()

            }
        }
        else if(this.Language == Language.PYTHON){
            this.handleStandardParen()
        }
        else if(this.Language == Language.HASKELL){
            this.handleHaskell()
        }
        else if(this.Language == Language.GO){
            this.handleGo()
        }
        else if(this.Language == Language.RUST){
            this.handleStandardParen()
            
        }
    }
}