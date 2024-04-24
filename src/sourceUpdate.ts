import * as ts from 'typescript';
import { doReplacements, writeFiles, mkReplacement } from './replacements';

export type Replacer = {
   range: (start: number, end: number, newText: string) => void;
   node: (node: ts.Node, newText: string) => void;
};

function subNode(node: ts.Node, newText: string): [number, number, string] {
   return [node.pos, node.end, newText];
}

export type SourceUpdate = {
   fileName: string;
   transformer: ReturnType<typeof mkTransform>;
};

const sourceUpdates: Map<string, SourceUpdate[]> = new Map();

function doFileUpdate(
   program: ts.SemanticDiagnosticsBuilderProgram,
   fileName: string,
   transformer: ReturnType<typeof mkTransform>
) {
   const sourceFile = program.getSourceFile(fileName);
   if (!sourceFile) throw new Error(`could not find ${fileName}`);
   const range = mkReplacement(sourceFile);
   const node = (node: ts.Node, newText: string) =>
      range(...subNode(node, newText));
   transformer({ range, node })(sourceFile);
   doReplacements(sourceFile);
}

type TransformArg = Parameters<typeof mkTransform>[0];
export function mkTransform(
   fn: (
      replacer: Replacer
   ) => (node: ts.Node) => void | undefined | 'stop' | TransformArg
): (replacer: Replacer) => (sourceFile: ts.Node) => undefined | 'stop' {
   const visit = (replacer: Replacer) => (startNode: ts.Node) => {
      const apply = fn(replacer);
      const result = apply(startNode);
      if (result === 'stop') {
         return 'stop';
      } else {
         const newVisit = (result === undefined ? visit : mkTransform(result))(
            replacer
         );
         for (const child of startNode.getChildren()) {
            newVisit(child);
         }
      }
   };
   return visit;
}

export function addSourceUpdate(step: string, sourceUpdate: SourceUpdate) {
   console.log(`step: ${step} file: ${sourceUpdate.fileName}`);
   if (!sourceUpdates.has(step)) {
      sourceUpdates.set(step, []);
   }
   sourceUpdates.get(step)!.push(sourceUpdate);
}

export function doSourceUpdates(
   step: string,
   program: ts.SemanticDiagnosticsBuilderProgram
) {
   const stepSourceUpdates = sourceUpdates.get(step) ?? [];
   for (const sourceUpdate of stepSourceUpdates) {
      console.info(`updating ${sourceUpdate.fileName}`);
      doFileUpdate(program, sourceUpdate.fileName, sourceUpdate.transformer);
   }

   sourceUpdates.set(step, []);
}
