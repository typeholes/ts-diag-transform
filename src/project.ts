import * as ts from 'typescript';
import * as path from 'path';
import { chdir } from 'process';

let formatHost: ts.FormatDiagnosticsHost;
export function watchProject(
   projectPath: string,
   configPath: string,
   afterProgramCreate: (program: ts.SemanticDiagnosticsBuilderProgram) => void,
   onDiagnostic: (diagnostic: ts.Diagnostic) => void
) {
   const resolvedProjectPath = path.resolve(projectPath);
   chdir(resolvedProjectPath);

   formatHost = {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => resolvedProjectPath,
      getNewLine: () => ts.sys.newLine,
   };

   const host = ts.createWatchCompilerHost(
      configPath,
      {},
      { ...ts.sys, getCurrentDirectory: () => path.resolve(projectPath) },
      ts.createSemanticDiagnosticsBuilderProgram,
      onDiagnostic,
      reportWatchStatusChanged
   );

   const origCreateProgram = host.createProgram;
   host.createProgram = (
      rootNames: ReadonlyArray<string> | undefined,
      options,
      host,
      oldProgram
   ) => {
      console.log('--- opening project ---');
      return origCreateProgram(rootNames, options, host, oldProgram);
   };
   const origPostProgramCreate = host.afterProgramCreate;

   host.afterProgramCreate = (program) => {
      afterProgramCreate(program);
      origPostProgramCreate!(program);
   };

   // `createWatchProgram` creates an initial program, watches files, and updates
   // the program over time.
   return ts.createWatchProgram(host);
}

/**
 * Prints a diagnostic every time the watch status changes.
 * This is mainly for messages like "Starting compilation" or "Compilation completed".
 */
function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
   //    console.info(ts.formatDiagnostic(diagnostic, formatHost));
}
