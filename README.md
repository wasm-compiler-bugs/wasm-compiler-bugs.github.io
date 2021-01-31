# An Empirical Analysis on WebAssembly Compiler Bugs

This repo contains the figures and data presented in the ISSTA 2021 submission "An Empirical Analysis of WebAssembly Compiler Bugs".

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
