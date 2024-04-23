import {
   SourceFile,
   TextChangeRange,
   textChangeRangeNewSpan,
   type TextChange,
} from 'typescript';

import { writeFileSync } from 'fs';

/***** Do not use SourceFile.update
 * keep the new text here and write it to the file when done with replacements
 * that way the watcher can deal with all the low level stuff
 */

type Change = { start: number; end: number; newText: string };

const replacements: Map<string, Change[]> = new Map();
const sources: Map<string, string> = new Map();

export function mkReplacement(sourceFile: SourceFile) {
   const fileName = sourceFile.fileName;
   return (start: number, end: number, newText: string) => {
      const length = 1 + end - start;
      const replacement: Change = { start, end, newText };
      if (!replacements.has(fileName)) {
         replacements.set(fileName, [replacement]);
      } else {
         replacements.get(fileName)!.push(replacement);
      }
   };
}

export function doReplacements(sourceFile: SourceFile): void {
   const fileName = sourceFile.fileName;
   const changes = replacements.get(fileName);
   if (!changes) return;

   if (!sources.has(fileName)) {
      sources.set(fileName, sourceFile.getFullText());
   }
   let source = sources.get(fileName)!;

   changes.sort((a, b) => b.start - a.start); // process bottom up to avoid changing span locations
   for (let i = 1; i < changes.length; i++) {
      if (changes[i].end > changes[i - 1].start) {
         const { start, end } = changes[i - 1];
         const nextStart = changes[i].start;
         console.log(start, end, nextStart);
         throw new Error(
            `Overlapping changes to ${fileName} ${{ start, nextStart, end }} `
         );
      }
   }

   changes.forEach((change) => {
      source =
         source.slice(0, change.start) +
         change.newText +
         source.slice(change.end);
   });

   replacements.delete(fileName);
   sources.set(fileName, source);
}

export function writeFiles() {
   if (replacements.size > 0) {
      throw new Error('attempt to write files with pending replacements');
   }

   for (let [fileName, source] of sources.entries()) {
      writeFileSync(fileName, source);
      sources.delete(fileName);
   }
}
