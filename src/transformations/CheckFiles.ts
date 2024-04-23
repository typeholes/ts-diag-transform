import * as ts from 'typescript';
import { transformations } from './transformations';
import * as path from 'path';

export const name = 'CheckFiles';

const fileNames = [
   'src/compiler/checker.ts',
   'src/compiler/types.ts',
   'src/compiler/utilities.ts',
];

transformations['CheckFiles'] = (
   program: ts.SemanticDiagnosticsBuilderProgram
) => {
   for (const relativeName of fileNames) {
      const fileName = path.resolve(relativeName);
      const sf = program.getSourceFile(fileName);
      if (!sf) throw new Error(`${fileName} not found`);
   }
};
