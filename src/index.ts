import { command, run, positional, option, flag } from 'cmd-ts';
import { Directory, File } from 'cmd-ts/batteries/fs';
import { transformations } from './transformations/transformations';
import * as CheckFiles from './transformations/CheckFiles';
import * as StructuredDiagnostics from './transformations/StructuredDiagnostics';
import { watchProject } from './project';
import {
   SemanticDiagnosticsBuilderProgram,
   WatchOfConfigFile,
} from 'typescript';
import { exit as exitProcess } from 'process';

function exit(
   watcher: WatchOfConfigFile<SemanticDiagnosticsBuilderProgram> | undefined
) {
   if (watcher) watcher.close();
   exitProcess();
}

const transformationNames = [
   CheckFiles.name,
   StructuredDiagnostics.name,
] as const;

const _transformationArgs = Object.fromEntries(
   transformationNames.map((name, idx) => [
      name,
      flag({
         long: name,
         short: idx.toString(),
         defaultValueIsSerializable: true,
         defaultValue: () => idx === 0,
      }),
   ])
);
const transformationArgs = _transformationArgs as Record<
   (typeof transformationNames)[number],
   (typeof _transformationArgs)[any]
>;

const cmd = command({
   name: 'patch-ts',
   description: 'patch ts for diagnostic arguments',
   version: '1.0.0',
   args: {
      projectPath: positional({ type: Directory, displayName: 'projectPath' }),
      configFile: option({
         type: File,
         long: 'configFile',
         defaultValue: () => '',
      }),
      ...transformationArgs,
   },
   handler: (args) => {
      let watcher:
         | WatchOfConfigFile<SemanticDiagnosticsBuilderProgram>
         | undefined;
      try {
         args.configFile ||= args.projectPath + '/tsconfig.json';
         args.CheckFiles = true;
         console.log(args);

         watcher = watchProject(
            args.projectPath,
            args.configFile,
            (program) => {
               transformationNames.forEach((name) => {
                  if (name in args && args[name as never]) {
                     transformations[name](program);
                  }
               });
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
