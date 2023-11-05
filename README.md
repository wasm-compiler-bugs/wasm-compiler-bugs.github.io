# An Empirical Study of Bugs in WebAssembly Compilers

This repository contains the figures and data presented in the ASE 2021 submission, "[An Empirical Study of Bugs in WebAssembly Compilers](https://alan-romano.github.io/An_Empirical_Study_of_Bugs_in_WebAssembly_Compilers.pdf)."

## Findings


|                             |Findings                                                                                                                                                                                               |Implications                                                                                                                                                                                                                                                                           |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|1                                  |Data type incompatibility bugs account for 15.75% of the 146 bugs.                                                                    |Interfaces (e.g., APIs) passing values between WebAssembly and JavaScript caused type incompatibility bugs, when their data types are mishandled in one of the languages. Such interfaces (e.g., ftell, fseek, atoll, llabs, and printf) require more attention.                       |
|2                                  |Porting synchronous C/C++ paradigm to event-loop paradigm causes a unique challenge                                                                                                         |While automated tools support the synchronous to event-loop conversion (e.g., Asyncify), bugs in them may cause concurrency issues (e.g., race condition, out-of-order events). Programs that went through this conversation require extensive testing.|
|3                                  |Supporting (or emulating) linear memory management models is challenging                                                                                                    |WebAssembly emulates the linear memory model (of the native execution environment). Many bugs reported in this regard require a particular condition (e.g., allocation of a large memory to trigger heap memory size growth), calling for more comprehensive testing.                                                    |
|4                                  |Changes of external infrastructures used in WebAssembly compilers lead to unexpected bugs                                                                      |Compiler developers should stay on top of developments that occur in the existing infrastructure used within the compiler. In particular, valid changes (in one context) of existing infrastructure can introduce unexpected bugs in WebAssembly. Rigourous testing is needed.                                                                  |
|5                                  |Despite WebAssembly being platform independent, platform differences cause bugs                                                          |The default Emscripten Test Suite focuses on testing V8 browser and Node.js, while there are bugs reported due to the platform differences (e.g., caused by other browsers and OSes). The test suite should pay attention to cover broader aspects of the platform differences.                                               |
|6                                  |Unsupported primitives not properly documented lead to bugs being reported in the compiler                                        |WebAssembly compiler developers shall pay attention to keeping the document consistent with the implementation (e.g., mentioning sigsetjmp and function type bitcasting are not supported).                                           
|7    |Some bug reports failed to include critical information, leading to a prolonged time of debugging                                                                                  | We observe that the current bug reporting practice can be improved. In particular, an automated tool that collects critical information (e.g., inputs, compilation options, and runtime environments) would significantly help in the bug reproduction process
|8                                  |Bugs that manifest during runtime made up a significant portion (37.8%) of the bugs inspected |Many bugs in the compilers cause runtime bugs in the compiled programs, which are more difficult to detect and fix. To mitigate these bugs, compiler developers may need to provide should be sure to test the emitted   modules in the test suites more exhaustively.                                            |
|9                                  |76.7% of bug-inducing inputs were less than 20 line and developers manually reduce the size of inputs                                                                                                                                                 |In many cases, bugs can be successfully reproduced by relatively small inputs, that are less than 20 lines. Currently, developers often manually reduce large inputs. Automated bug-inducing input reduction (e.g., delta debugging) would be beneficial.                                                                                 |

Our findings can be used to help guide testing improvements in WebAssembly compilers. For example, Implication 9 states that the current Emscripten test suite is comprehensive enough to cover relevant APIs but not deep enough to find complex bugs. In [Emscripten Issue #9562](https://github.com/emscripten-core/emscripten/issues/9562), the report describes a bug where using the `-s MAIN_MODULE=1 ` compiler flag with a code snippet utilizing the Filesystem API causes a type error that passes an illegal value between WebAssembly and JavaScript. This bug should be covered by the test cases for dynamic linking [test_dynamic_link,  test_dylink_dso_needed, ...](https://github.com/emscripten-core/emscripten/blob/635c4608fbcc34b025267e0b626f3f245296f4e6/tests/test_browser.py#L3425) or the test cases for the filesystem [test_asmfs_hello_file, test_asmfs_read_file_twice, etc...](https://github.com/emscripten-core/emscripten/blob/635c4608fbcc34b025267e0b626f3f245296f4e6/tests/test_browser.py#L4501). However, the bug-inducing input manages to avoid hitting these test cases as the two APIs were not tested in combination with each other.

### [Dataset](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Dataset)
This folder contains the samples collected from the qualitative study,  [qualitative_dataset.csv](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/blob/master/Dataset/qualitative_dataset.csv), and the quantitative dataset, [quantitative_dataset.csv](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/blob/master/Dataset/quantitative_dataset.csv).

The bug dataset is constructed by scanning the repositories of four compilers, AssemblyScript,  Binaryen, Emscripten,  and Wasm-Bindgen (obtained from <a href="https://github.com/mbasso/awesome-wasm">this list</a>), to identify issues that contained bug reports. We do this using two approaches.
In the first approach, we use the GitHub Search API to collect all the closed issues that had a label indiciating the issue was a bug, including &quot;bug&quot;, &quot;good first bug&quot;, &quot;breaking change&quot;, etc... This produced a total of 243 issues. 
In the second approach, we use the GitHub REST API to collect all the issues from the six compilers, ariving at a total of 96,186 issuess.  We limit these bugs to closed issues in order to reliably obtain information on the bug fix and root cause, which reduces the number to 88,037 issues. We restrict the bugs to those after the year 2015 as this is when the initial versions of WebAssembly were introduced, bringing the number to 64,673. Next we search for keywords in the title and body of the issue to include, such as &quot;bug&quot;, &quot;error&quot;, &quot;defect&quot;, and &quot;fault&quot;, and to excude, such as &quot;feature&quot; and &quot;install&quot;. This filter reduces the number of issues to 19,335. We apply more keywords to search for issues that are particularly relevant to WebAsembly using &quot;wasm&quot;, &quot;wat&quot;, and &quot;WebAssembly&quot;. This brings the number down to 1,752 issues. These issues are combined with the 243 issues obtained using the bug labels, and finally the issues are manually inspected to verify that they are closed issues related to WebAssembly with a bug fix. This manual inspection brings the number of issues to the final number of 1,316.


### [Figures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Figures)
Some of the figures used in the paper can be found in the [Figures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Figures)
directory. The figures are provided as high-resolution .png and .pdf files.


### [Compiler Signatures](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/CompilerSignatures)
This folder contains some of the signatures collected for the compilers in our study on WebAssembly samples in the wild. The compiler signatures are presented for Emscripten, Binaryen, and Wasm-Bindgen, as well as for samples whose compiler could not be determined.


### [Code](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Code)
This folder contains the source code used to crawl GitHub for the bug samples and the script used to build the visualizations for it. 

## Qualitative Study
We perform a qualitative analysis on 146 bugs. We obtain these bugs by filtering the dataset used in the quanititative study (1,316 samples) to those that belong to Emsscripten (430 samples) and are relevant to WebAssembly-specific challenges (146 samples). We collect the information in the qualitative study through the following steps: 
1. Beginning with the Columns *ID* and *URL*, we first visit the issue page through the link in *URL*.
2. We identify bug-inducing code snippet in the page by reading the initial post and, if need, a few of the following posts. We record the source code language of the bug-inducing input in the *Language* column and the link to the post containing the bug-inducing input in the *Bug Inducing Input Location* column.
3. We identify the intended functionality that the code snippet is trying to trigger and record in the column *Purpose*. We list the indicative API/keyword that helps us identify the purpose of the code snippet in the *Tested API* column.
4. We read through all the posts in the issue conversation to find what the compiler developers and/or reporting user found the root cause to be. We summarize the root cause and record it in the *Root Cause* column. 
5. We read through all the posts to find out how the bug was fixed or resolved. We summarize the bug fix and record it in the *Bug Fix* column.
6. After performing Steps 1-5 on all the samples, we look at the root cause summaries in the *Root Cause* column to group similar ones together. We distinguish the causes by where they occur in the compiler infrastructure (e.g. frontend, linker, lirbaries, etc.. ) or by differences in the languages, platforms, or infrastructures involved (e.g C-to-WebAssembly, WebAssembly-to-JS,...). We record the final categories created in the *Root Cause Category* column.



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
<img src="https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/raw/master/Tables/Table3.PNG" alt="Table 3: Bug Dataset" width="550">

In the second study, we perform a quantitative study on 1,316 bugs among six WebAssembly compilers, namely AssemblyScript, Binaryen, Emscripten, and Wasm-Bindgen. These bugs are obtained by scanning the repositories of the six compilers listed above, which where obtained form [this list](https://github.com/mbasso/awesome-wasm). We first use the GitHub Search API to collect all the closed issues that had a label indiciating the issue was a bug, including "bug", "good first bug", "breaking change", etc... This produced a total of 243 issues. 

In order to find more samples, we also used the GitHub REST API to collect all the issues from the six compilers, ariving at a total of 96,186 issues.  We limit these bugs to closed issues in order to reliably obtain information on the bug fix and root cause, which reduces the number to 88,037 issues. We restrict the bugs to those after the year 2015 as this is when the initial versions of WebAssembly were introduced, bringing the number to 64,673. Next we search for keywords in the title and body of the issue to include, such as "bug", "error", "defect", and "fault", and to excude, such as "feature" and "install". This reduces the number of issues to 19,335. We apply more keywords to search for issues that are particularly relevant to WebAsembly using "wasm", "wat", and "WebAssembly". This brings the number down to 1,752 issues. These issues are combined with the 243 issues obtained using the bug labels, and finally the issues are manually inspected to verify that they are closed issues related to WebAssembly with a bug fix. This brings the number of issues to the final number of 1,316.


This study focuses on four dimensions: (a) We study the lifecycle of the bugs and find that the average duration of the bugs is 118 days, with 26.4% of all bugs being fixed within 1 day.(b) We categorize these bugs based on their impacts and observe many runtime errors (37.8%), including crash (9.6%), instantiation failure (1.2%), and performance drop (0.8%). (c) We study the locations of the bugs and find that most bugs are concentrated to a few files in the projects. 47 bugs are found in the component sof existing compiler infrastructures. (d) We compute the lines of code (LOC) of the bug-inducing inputs and bug fixes. We find that majority of bug-inducing inputs (76.7%) have 20 LOC or less. 51.4% of the bugs have bug fixes with less than 10 LOC, and 78% are fixedby changing at most 10 functions.

## Real-World WebAssembly Adoption Study

<img src="https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/raw/master/Figures/compiler_dist.png" alt="Distribution of WebAssembly Compilers" width="550">

Our analysis shows that Emscripten is the most widely-used compiler for creating real-world WebAssembly samples. Besides, Binaryen and Wasm-Bindgen have also been observed in the wild. There are duplicated samples because multiple websites used the same WebAssembly binary. Emscripten accounts for 68% (2,434 samples) of all samples, Binaryen takes 31% (1,133 samples), and Wasm-Bindgen accounts for 1% (38 samples). When considering distinct samples, Emscripten accounts for 95% (752 samples) of the unique samples, followed by Wasm-bindgen (4%, 32 samples), and Binaryen (1%, 7 samples).
