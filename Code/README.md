## GitHub Crawling Code and Visualization Script

## Code
The `DatabaseScriptProcessing` folder contains the code to crawl GitHub for the WebAssembly-related repos as well as the code to crawl the issues, commits, bug fixes, test cases, and releases. 
#### Dependencies
- MySQL
- Node.js

In order to run this code, first setup a MySQL database called `webassembly_bugs` using the files provided in the `Schema` folder. Then modify the [DatabaseScriptProcessing/src/MySQLConnector.ts](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Code/DatabaseScriptProcessing/src/MySQLConnector.ts)  file to match with your database credentials and settings. Next,
install the dependencies by running `npm install`. Then, build the project by running `npm run build`. Finally, run the code by running `node build/index.js -m <mode>`. The `<mode>` options can be found by running `node build/index.js --help` or in the [DatabaseScriptProcessing/src/index.ts](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Code/DatabaseScriptProcessing/src/index.ts) file.

## Visualizations
The Jupyter Notebook file [Visualizations.ipynb](https://github.com/wasm-compiler-bugs/wasm-compiler-bugs.github.io/tree/master/Code/Visualizations/Visualizations.ipynb) can be used to reproduce the figures in the paper. The database settings within the file will need to be changed to match your database credentials.
