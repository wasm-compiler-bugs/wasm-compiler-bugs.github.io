export default class GitPatch{
    LineNumberString: string;
    LineNumbers: number[] = [];
    CodeText: string;
    constructor(lineNumbers: string, codeText:string){
        this.LineNumberString = lineNumbers;
        this.CodeText = codeText;
    }

    toString(){
        return `[${this.LineNumberString}]: ${this.CodeText}`
    }

    parseNumbers(){
        try{
            const [firstGroup,secondGroup] = this.LineNumberString.split(' ');
            const [firstFirst, firstSecond] = firstGroup.split(',');
            const [secondFirst, secondSecond] = secondGroup.split(',');
            const segmentedLineNumbers = [firstFirst, firstSecond, secondFirst,secondSecond];
            this.LineNumbers = segmentedLineNumbers.map(str=>str.trim().replace('-', '').replace('+','')).map(str => parseInt(str));
        } catch(parseNumberError){
        }

    }
}