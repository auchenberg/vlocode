import { exec } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ExecpResult {
    stdout: Buffer;
    stderr: Buffer;
    err: Error;
}

/**
 * Start child process and capture output; returns a promise that is resolved once the child process exits
 * @param {String} cmd 
 * @param {child_process::ExecOptions} opts 
 */
export async function execp(cmd: string, opts : any) : Promise<ExecpResult> {
    opts || (opts = {});
    return new Promise<ExecpResult>((resolve, reject) => {
        const child = exec(cmd, opts,
            (err, stdout, stderr) => resolve({
                stdout: stdout,
                stderr: stderr,
                err: err
            }));

        if (opts.stdout) {
            child.stdout.pipe(opts.stdout);
        }
        if (opts.stderr) {
            child.stderr.pipe(opts.stderr);
        }
    });
} 

export async function getDocumentBodyAsString(file: vscode.Uri) : Promise<string> {
    let doc = vscode.workspace.textDocuments.find(doc => doc.fileName == file.fsPath);
    if (doc) return doc.getText();
    return await readFileAsync(file.fsPath);
}

export function promisify<T1, T2, T3, T4>(func: (arg1: T2, arg2: T2, arg3: T3, cb: (err: any, result?: T1) => void) => void, thisArg?: any) : (arg1: T2, arg2: T2) => Promise<T1>;
export function promisify<T1, T2, T3>(func: (arg1: T2, arg2: T2, cb: (err: any, result?: T1) => void) => void, thisArg?: any) : (arg1: T2, arg2: T2) => Promise<T1>;
export function promisify<T1, T2>(func: (arg1: T2, cb: (err: any, result?: T1) => void) => void, thisArg?: any) : (arg1: T2) => Promise<T1>;
export function promisify<T1>(func: (...args: any[]) => void, thisArg: any = null) : (...args: any[]) => Promise<T1> {
    return (...args: any[]) : Promise<T1> => {
        return new Promise<T1>((resolve, reject) => { 
            var callbackFunc = (err, ...args: any[]) => {
                if(err) { reject(err); }
                else { resolve.apply(null, args); }
            };
            func.apply(thisArg, args.concat(callbackFunc));
        });
    };
}

const _readFileAsync = promisify(fs.readFile);
export function readFileAsync(file: fs.PathLike) : Promise<string> {
    return _readFileAsync(file).then(buffer => buffer.toString());
}

const _fstatAsync = promisify(fs.stat);
export function fstatAsync(file: vscode.Uri) : Promise<fs.Stats> {
    return _fstatAsync(file.fsPath);
}

const _readdirAsync = promisify(fs.readdir);
export function readdirAsync(path: fs.PathLike) : Promise<string[]> {
    return _readdirAsync(path);
}

export function writeFileAsync(path: fs.PathLike, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; }) : Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, options, (err) => {
            if(err) { reject(err); }
            else { resolve(); }
        });
    });
}

export function existsAsync(path: fs.PathLike) : Promise<boolean> {
    return new Promise(resolve => {
        fs.exists(path, result => resolve(result));
    });
}

export function unique<T>(arr: T[], uniqueKeyFunc: (T) => any) : T[] {
    let unqiueSet = new Set();
    return arr.filter(item => {
        let k = uniqueKeyFunc(item);
        return unqiueSet.has(k) ? false : unqiueSet.add(k);
    });
}

/**
 * Removes any double or trailing slashes from the path
 * @param pathStr path string
 */
export function senatizePath(pathStr: string) {
    if (!pathStr) {
        return pathStr;
    }
    pathStr = pathStr.replace(/^[\/\\]*(.*?)[\/\\]*$/g, '$1');
    pathStr = pathStr.replace(/[\/\\]+/g,path.sep);
    return pathStr;
}

export interface StackFrame {
    functionName: string;
    modulePath: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
}

/**
 * Gets a single stack frame from the current call stack.
 * @param stackFrame The frame number to get
 * @returns A stack frame object that describes the request stack frame or undefined when the stack frame does not exist
 */
export function getStackFrameDetails(frameNumber: number) : StackFrame | undefined {
    const stackLineCaller = new Error().stack.split('\n');
    if(stackLineCaller.length < frameNumber + 4) {
        return;
    }
    // frameNumber +2 as we want to exlcude our self and the first line of the split which is not stackframe
    const stackFrameString = stackLineCaller.slice(frameNumber+2, frameNumber+3)[0];
    const [,,callerName,path,basename,line,column] = stackFrameString.match(stackLineRegex);
    return {
        functionName: callerName,
        modulePath: path,
        fileName: basename,
        lineNumber: Number.parseInt(line),
        columnNumber: Number.parseInt(column)
    };
}
const stackLineRegex = /at\s*(module\.|exports\.|object\.)*(.*?)\s*\((.*?([^:\\/]+)):([0-9]+):([0-9]+)\)$/i;

/**
 * Loop over all own properties in an object.
 * @param obj Object who's properties to loop over.
 * @param cb for-each function called for each property of the object
 */
export function forEachProperty<T>(obj: T, cb: (key: string, value: any, obj: T) => void) : void {
    Object.keys(obj).forEach(key => {
        cb(key, obj[key], obj);
    });
}

export function getProperties(obj: any) : { readonly key: string, readonly value: any }[] {
    return Object.keys(obj).map(key => { 
        return Object.defineProperties({},{
            key: { value: key, },
            value: { get: () => obj[key] }
        });
    });
}

/**
 * Execute callback async in sequence on each of the items in the specified array
 * @param array Array to execute the callback on
 * @param callback The callback to execute for each item
 */
export function forEachAsync<T>(array: T[], callback: (item: T, index?: number, array?: T[]) => Thenable<void>) : Promise<T[]> {
    let foreachPromise = Promise.resolve();
    for (let i = 0; i < array.length; i++) {
        foreachPromise = foreachPromise.then(_r => callback(array[i], i, array));
    }
    return foreachPromise.then(_r => array);
}

/**
 * Execute callback async in parallel on each of the items in the specified array
 * @param array Array to execute the callback on
 * @param callback The callback to execute for each item
 */
export function forEachAsyncParallel<T>(array: T[], callback: (item: T, index?: number, array?: T[]) => Thenable<void>) : Promise<T[]> {
    let tasks : Thenable<void>[] = [];
    for (let i = 0; i < array.length; i++) {
        tasks.push(callback(array[i], i, array));
    }
    return Promise.all(tasks).then(_r => array);
}
