import { command, run, positional, option, oneOf } from 'cmd-ts';
import { Directory, File } from 'cmd-ts/batteries/fs';

import { watchProject } from './project';
import {
   SemanticDiagnosticsBuilderProgram,
   WatchOfConfigFile,
} from 'typescript';
import { exit as exitProcess } from 'process';
import { doSourceUpdates } from './sourceUpdate';
import { writeFiles } from './replacements';

function exit(
   watcher: WatchOfConfigFile<SemanticDiagnosticsBuilderProgram> | undefined
) {
   if (watcher) watcher.close();
   exitProcess();
}

async function main() {
   const steps = [
      (await import('./transformations/StructuredDiagnostics.js')).stepName,
      (await import('./transformations/PropagateArguments.js')).stepName,
   ];

   const cmd = command({
      name: 'patch-ts',
      description: 'patch ts for diagnostic arguments',
      version: '1.0.0',
      args: {
         projectPath: positional({
            type: Directory,
            displayName: 'projectPath',
         }),
         configFile: option({
            type: File,
            long: 'configFile',
            defaultValue: () => '',
         }),
         fromStep: option({
            type: oneOf(steps),
            long: 'fromStep',
            defaultValue: () => steps[0],
         }),
         toStep: option({
            type: oneOf(steps),
            long: 'toStep',
            defaultValue: () => steps[steps.length - 1],
         }),
      },
      handler: (args) => {
         const startIdx = steps.indexOf(args.fromStep);
         if (startIdx < 0)
            throw new Error('invalid start step ${args.fromStep');

         const endIdx =
            args.toStep === '' ? steps.length - 1 : steps.indexOf(args.toStep);
         if (endIdx < 0) throw new Error('invalid start step ${args.toStep');

         if (endIdx < startIdx) throw new Error('toStep is before fromStep');

         let watcher:
            | WatchOfConfigFile<SemanticDiagnosticsBuilderProgram>
            | undefined;
         try {
            args.configFile ||= args.projectPath + '/tsconfig.json';
            console.log(args);

            watcher = watchProject(
               args.projectPath,
               args.configFile,
               (program) => {
                  steps.slice(startIdx, endIdx + 1).forEach((step) => {
                     doSourceUpdates(step, program);
                  });
                  writeFiles();
                  exit(watcher);
               },
               (diagnostic) => console.log(diagnostic.messageText)
            );
         } catch (e) {
            if (e instanceof Error) {
               console.error(e.message);
               exit(watcher);
               throw e;
            } else {
               console.error(`${e}`);
               exit(watcher);
            }
         } finally {
            exit(watcher);
         }
      },
   });

   run(cmd, process.argv.slice(2));
}

main();
