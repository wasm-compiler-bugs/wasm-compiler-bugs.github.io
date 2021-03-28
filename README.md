# An Empirical Analysis on WebAssembly Compiler Bugs

This repo contains the figures and data presented in the ISSTA 2021 submission "An Empirical Analysis of WebAssembly Compiler Bugs".

## Findings
|                             |Findings                                                                                                                                                                                               |Implications                                                                                                                                                                                                                                                                           |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
||                                                      From Qualitative Study (Section 3)                                                                                                                                                  |                                                                                                                                                                                                                                                                                       |
|1                                  |Data type incompatibilities are a distinct challenge posed to WebAssembly compilers and account for 14.1% of the bugs investigated.                                                                    |Testing the interfaces that pass values among WebAssembly, JavaScript, and C/C++ contexts should be done exhaustively as these interfaces are used to implement other compiler-provided runtime libraries (e.g., Filesystem, Exception Handling, Indirect Calls).                      |
|2                                  |Porting synchronous C/C++ paradigm to asynchronous event-loop paradigm is a unique challenge.                                                                                                          |Automated tools supporting this conversion, such as Asyncify and Emterpreter, should be more thoroughly tested. In addition, libraries that rely on these should perform additional testing as Asyncify and Emterpreter may expose buggy behavior when changing the execution paradigm.|
|3                                  |Handling the differences in memory management models is a unique challenge to WebAssembly compilers.                                                                                                   |For the libraries that utilize the linear memory, such as the Filesystem API, the compiler developers should test the functionalities more rigorously under different memory conditions, such as after memory growth and shrinkage.                                                    |
|4                                  |Bugs or benign changes that occur within external infrastructures used in WebAssembly compilers can lead to bugs in the compiler.                                                                      |Compiler developers should stay on top of developments that occur in the existing infrastructure used within the compiler. Although they are more mature, new bugs can occur when used to support WebAssembly.                                                                         |
|5                                  |Despite WebAssembly being platform-independent, platform differences in browsers and operating systems can cause bugs in the emitted modules.                                                          |By default, when testing emitted WebAssembly modules for tests in the test suite, they should be run against multiple browsers and runtimes, rather than just the V8 browser or Node.js runtime, which are the current default settings.                                               |
|6                                  |WebAssembly limitations, such as the lack of support for the C keyword sigsetjmp and function type bitcasting, can lead to bugs being reported in the compiler.                                        |WebAssembly compiler developers should be sure to document these limitations to avoid wasting effort to look into issues that run against these limitations.                                                                                                                           |
||                                                           From Quantitative Study (Section 4)                                                                                                                                            |                                                                                                                                                                                                                                                                                       |
|7                                  |Bugs that are slow to fix are either complex issues, caused by external projects, or are difficult to reproduce due to lack of information (e.g., compilation options) in the bug report.              |The compiler developers can improve bug reporting techniques (e.g., automatically including the relevant compilation options into a log file for issue reports) to ease the bug reproduction process.                                                                                  |
|8                                  |Bugs that manifest during runtime made up a significant portion (37.8%) of the bugs inspected, including bugs that cause incorrect functionality (10.1%), crashes (9.60%), and data corruption (6.94%).|Runtime bugs are more difficult to detect and fix than bugs that occur during compile time. In order to mitigate these bugs, compiler developers should be sure to test the emitted modules in the test suites more exhaustively.                                                      |
|9                                  |Over 50% of bugs for five compilers affect only 1 file.                                                                                                                                                |Bugs are localized within a few core files, that are covered by the existing test-suites. However, the test-suites failed to expose errors due to the insufficient input and scenario coverage. Developers could improve the test-suites’ quality. The existing test suites achieve sufficient code coverage while failed to cover diverse inputs and scenarios. Developers could spend more effort on covering more input space and diverse scenarios.                                                                                  |
|10                                 |The majority of bug-inducing inputs (76.1%) have 10 or fewer lines of code. We observe cases where initial bug-inducing inputs were large and further reduced by developers.                           |In many cases, bug-inducing inputs do not need to be very large. This can help guide techniques for test-case generation and motivate bug-inducing input reduction techniques (e.g., delta-debugging).                                                                                 |
|11                                 |Over 88% of all bug fixes are 100 lines or fewer, and 51% of all bugs fixes are 10 lines or fewer. Over 78% of bugs are fixed by changing 10 functions or less.                                        |Bug fixes are usually not very large/complex to resolve the issue (i.e., fixes did not require significant refactoring effort).                                                                                                                                                        |


### [Figures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Figures)
All of the figures used in the paper can be found in the [Figures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Figures)
directory. The figures are provided as high-resolution .png and .pdf files.

### [Tables](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Tables)
All of the tables used in the paper can be found in the [Tables](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Tables) directory with the table numbers matching those found in the paper. There are also tables that were ommitted from the paper for space. The tables are provided as high-resolution .png files.

### [Compiler Signatures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/CompilerSignatures)
This folder contains some of the signatures collected for the compilers in our study on WebAssembly samples in the wild. The compiler signatures are presented for Emscripten, Binaryen, and Wasm-Bindgen, as well as for samples whose compiler could not be determined.

### [Data](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Data)
This folder contains a sample of the manually inspected Emscripten bugs. We provide a sample of 10 bugs in the file [sample_dataset.csv](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Data/sample_dataset.csv).

## Qualitative Study
We perform a qualitative analysis on 142 bugs.

### Sample [Emscripten Bug #9562](https://github.com/emscripten-core/emscripten/issues/9562)
```
#include <cstdio>

int main() {
    FILE* file_ = std::fopen("input.txt","rb");
    printf("file pointer %p\n",(void*)file_);
    if (file_) {
        std::fseek(file_, 0l, SEEK_END);
        std::fclose(file_);
    }
    return 0;
}
```
We find that a bug occurs when using a file
pointer and compiling the module
with option -s MAIN_MODULE=1. Emscripten provides a filesystem
library, FS, implemented in JavaScript that emulates filesystem functionality, and it is accessed
in WebAssembly through imports. Since JavaScript does not natively support 64-bit integers, this
is usually handled by adding a legalization step that converts the
value into a type JavaScript can support. Within the execution path
to fseek(), an indirect call attempts to pass a WebAssembly i64
value to exported WebAssembly function of a side module. The
issue is that this other module’s export function has been wrapped
in JavaScript code to support value legalization.
The issue is fixed by exporting legalized and non-legalized versions of WebAssembly functions so that function calls made through
the indirect calls used here can pass i64 values to the appropriate
function when legalization is not required.

## Quantitative Study
![Table 4: Bug Dataset](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/raw/master/Tables/Table4.PNG)

In the second study, we perform a quantitative study on 1,400 bugs among six WebAssembly compilers, namely AssemblyScript, Asterius, Binaryen, Emscripten, TinyGo, and Wasm-Bindgen. This study focuses on four dimensions: (a) We study the lifecycle of the bugs and find that the average duration of the bugs is 118 days, with 26.4% of all bugs being fixed within 1 day.(b) We categorize these bugs based on their impacts and observe many runtime errors (37.8%), including crash (9.6%), instantiation failure (1.2%), and performance drop (0.8%). (c) We study the locations of the bugs and find that most bugs are concentrated to a few files in the projects. 47 bugs are found in the component sof existing compiler infrastructures. (d) We compute the lines of code (LOC) of the bug-inducing inputs and bug fixes. We find that majority of bug-inducing inputs (76.1%) have 10 LOC or less. 51.4% of the bugs have bug fixes with less than 10 LOC, and 78% are fixedby changing at most 10 functions.

## Real-World WebAssembly Adoption Study

![Figure 15: Distribution of WebAssembly Compilers](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/raw/master/Figures/compiler_dist.png)

Our analysis shows that Emscripten is the most widely-used compiler for creating real-world WebAssembly samples. Besides, Binaryen and Wasm-Bindgen have also been observed in the wild. Fig. 15 shows the distribution of identified compilers, where the left Fig. 15(a) counts all individual samples and the right Fig. 15(b) only counts unique samples. There are duplicated samples because multiple websites used the same WebAssembly binary. As shown in Fig. 15(a), Emscripten accounts for 68% (2,434 samples) of all samples, Binaryen takes 31% (1,133 samples), and Wasm-Bindgen accounts for 1% (38 samples). When considering distinct samples, Emscripten accounts for 95% (752 samples) of the unique samples, followed by Wasm-bindgen (4%, 32 samples), and Binaryen (1%, 7 samples).
