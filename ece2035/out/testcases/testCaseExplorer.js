"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCasesManager = void 0;
const vscode = require("vscode");
const testCase_1 = require("./testCase");
const path = require("path");
const testCaseExecution_1 = require("./testCaseExecution");
class TestCasesManager {
    constructor(context, useLocalEmulator, localEmulatorPath) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.testCases = [];
        this.context = context;
        this.useLocalEmulator = useLocalEmulator;
        this.localEmulatorPath = localEmulatorPath;
        // loading test cases from the disk
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }
        let workspaceRoot = workspaceFolders[0].uri.fsPath;
        let testCasesFolder = path.join(workspaceRoot, ".vscode", "testcases");
        let fs = require('fs');
        if (!fs.existsSync(testCasesFolder)) {
            return;
        }
        let files = fs.readdirSync(testCasesFolder);
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            if (file.endsWith(".png")) {
                let parts = file.split("_");
                // destructively pop off the last string and split by '.' to separate the seed from '.png' 
                let seed = parts.pop().split(".")[0];
                // reconstruct the original title of the test case
                let title = ((parts.length > 1) ? parts.join("_") : parts[0]);
                this.testCases.push(new testCase_1.TestCase(title, seed, "unknown"));
            }
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return [];
        }
        else if (this.testCases.length === 0) {
            return [new testCase_1.TestCase("No test cases found", "", ""), new testCase_1.TestCase("", "Add a new test case while or after debugging your assembly.", "")];
        }
        else {
            return this.testCases;
        }
    }
    addNewTestCase(title, seed, status, b64Img) {
        // adding the new test case to the disk under the folder {workspaceRoot}/.vscode/testcases
        // checking if the folder exists
        // if not, create the folder
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace is opened. Please open a workspace to add test cases.");
            return;
        }
        let workspaceRoot = workspaceFolders[0].uri.fsPath;
        let testCasesFolder = path.join(workspaceRoot, ".vscode", "testcases");
        let fs = require('fs');
        if (!fs.existsSync(testCasesFolder)) {
            fs.mkdirSync(testCasesFolder);
        }
        let testCasePath = path.join(testCasesFolder, title + "_" + seed + ".png");
        let buffer = Buffer.from(b64Img, 'base64');
        fs.writeFileSync(testCasePath, buffer);
        this.testCases.push(new testCase_1.TestCase(title, seed, status));
        this._onDidChangeTreeData.fire(undefined); // the root node has changed
    }
    async runTestCaseHandler(item) {
        // item should be a TestCase
        item.updateIcon("running");
        this._onDidChangeTreeData.fire(item);
        let title = item.label;
        let seed = item.description;
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0 || !workspaceFolders[0]) {
            vscode.window.showErrorMessage("No workspace is opened. Please open a workspace to run test cases.");
            return;
        }
        // accessing launch.json parameters
        let launchConfig = getResolvedLaunchConfig()[0];
        let assemblyCode = launchConfig["program"];
        let assignmentCode = launchConfig["assignment"];
        // converting both to absolute paths
        if (!assemblyCode || !assignmentCode) {
            vscode.window.showErrorMessage("Please set the program and assignment in launch.json to run test cases.");
            return;
        }
        let binPath;
        if (!this.useLocalEmulator) {
            binPath = this.context.globalState.get("riscvemulator");
        }
        else {
            binPath = this.localEmulatorPath;
        }
        const executor = new testCaseExecution_1.TestCaseExecutor(binPath, (result) => {
            // updating the status of the test case
            for (let i = 0; i < this.testCases.length; i++) {
                let testCase = this.testCases[i];
                if (testCase.description === seed) {
                    testCase.updateIcon(result.status);
                    testCase.stats = {
                        di: result.di,
                        si: result.si,
                        reg: result.regUsed,
                        mem: result.memUsed,
                        numErrors: result.numErrors
                    };
                    this._onDidChangeTreeData.fire(testCase);
                    if (this.updatedResultCallback) {
                        this.updatedResultCallback(testCase);
                    }
                }
            }
        });
        executor.execute(assignmentCode, assemblyCode, [seed]);
    }
    async handleRunAllTestCases() {
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0 || !workspaceFolders[0]) {
            vscode.window.showErrorMessage("No workspace is opened. Please open a workspace to run test cases.");
            return;
        }
        // accessing launch.json parameters
        let launchConfig = getResolvedLaunchConfig()[0];
        let assemblyCode = launchConfig["program"];
        let assignmentCode = launchConfig["assignment"];
        // converting both to absolute paths
        if (!assemblyCode || !assignmentCode) {
            vscode.window.showErrorMessage("Please set the program and assignment in launch.json to run test cases.");
            return;
        }
        let binPath;
        if (!this.useLocalEmulator) {
            binPath = this.context.globalState.get("riscvemulator");
        }
        else {
            binPath = this.localEmulatorPath;
        }
        const executor = new testCaseExecution_1.TestCaseExecutor(binPath, (result) => {
            // updating the status of the test case
            for (let i = 0; i < this.testCases.length; i++) {
                let testCase = this.testCases[i];
                if (testCase.description === result.seed.toString()) {
                    testCase.updateIcon(result.status);
                    testCase.stats = {
                        di: result.di,
                        si: result.si,
                        reg: result.regUsed,
                        mem: result.memUsed,
                        numErrors: result.numErrors
                    };
                    this._onDidChangeTreeData.fire(testCase);
                    if (this.updatedResultCallback) {
                        this.updatedResultCallback(testCase);
                    }
                }
            }
        });
        let seeds = [];
        for (let i = 0; i < this.testCases.length; i++) {
            seeds.push(this.testCases[i].description);
            // updating the status of the test case
            this.testCases[i].updateIcon("running");
        }
        executor.execute(assignmentCode, assemblyCode, seeds);
    }
    async debugTestCaseHandler(item) {
        // item should be a TestCase
        let title = item.label;
        let seed = item.description;
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0 || !workspaceFolders[0]) {
            vscode.window.showErrorMessage("No workspace is opened. Please open a workspace to debug test cases.");
            return;
        }
        const workspaceConfig = vscode.workspace.getConfiguration('launch', vscode.workspace.workspaceFolders[0]);
        const launchConfig = workspaceConfig["configurations"][0];
        // starting debug session
        launchConfig["seed"] = parseInt(seed);
        vscode.debug.startDebugging(workspaceFolders[0], launchConfig);
    }
    deleteTestCase(item) {
        // item should be a TestCase
        let title = item.label;
        let seed = item.description;
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0 || !workspaceFolders[0]) {
            vscode.window.showErrorMessage("No workspace is opened. Please open a workspace to delete test cases.");
            return;
        }
        let workspaceRoot = workspaceFolders[0].uri.fsPath;
        let testCasesFolder = path.join(workspaceRoot, ".vscode", "testcases");
        let testCasePath = path.join(testCasesFolder, title + "_" + seed + ".png");
        let fs = require('fs');
        fs.unlinkSync(testCasePath);
        // removing the test case from the list
        for (let i = 0; i < this.testCases.length; i++) {
            let testCase = this.testCases[i];
            if (testCase.label === title && testCase.description === seed) {
                this.testCases.splice(i, 1);
                this._onDidChangeTreeData.fire(undefined); // the root node has changed
                return;
            }
        }
    }
    reportUpdatedStatus(seed, status, stats) {
        for (let i = 0; i < this.testCases.length; i++) {
            let testCase = this.testCases[i];
            if (testCase.description === seed) {
                testCase.updateIcon(status);
                testCase.stats = stats;
                this._onDidChangeTreeData.fire(testCase);
            }
        }
    }
}
exports.TestCasesManager = TestCasesManager;
// Function to manually resolve workspace folder variables
function resolveVariables(config, folder, file) {
    // Regex to find VS Code variables e.g., ${workspaceFolder}
    const variablePatternWS = /\$\{workspaceFolder\}/g;
    const variablePatternFile = /\$\{file\}/g;
    // escaping the folder and file path strings
    const escapedFolder = folder.uri.fsPath.replace(/\\/g, '\\\\');
    const escapedFile = file.fsPath.replace(/\\/g, '\\\\');
    // Serialize the configuration object to a string
    let configString = JSON.stringify(config);
    // Replace all occurrences of ${workspaceFolder}
    configString = configString.replace(variablePatternWS, escapedFolder);
    configString = configString.replace(variablePatternFile, escapedFile);
    // Parse it back to an object
    return JSON.parse(configString);
}
// Function to get and resolve launch configurations
function getResolvedLaunchConfig() {
    // Access the workspace configuration for 'launch'
    const launchConfig = vscode.workspace.getConfiguration('launch', vscode.workspace.workspaceFolders[0]);
    // Get the configurations array from the 'launch' configuration
    const configs = launchConfig['configurations'];
    const currFile = vscode.window.activeTextEditor?.document.uri;
    if (configs && Array.isArray(configs)) {
        // Iterate through configurations
        return configs.map(config => resolveVariables(config, vscode.workspace.workspaceFolders[0], currFile));
    }
    return [];
}
//# sourceMappingURL=testCaseExplorer.js.map