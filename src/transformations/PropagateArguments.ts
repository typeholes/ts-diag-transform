export const stepName = 'PropagateArguments';

import * as ts from 'typescript';
import { mkTransform, addSourceUpdate } from '../sourceUpdate';
import {
   addImport,
   addInterfaceMember,
   addParameter,
   addShorthandProperty,
   afterFunctionDeclaration,
   inside,
} from '../transformations';

addSourceUpdate(stepName, {
   fileName: 'src/compiler/builder.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         addImport(node, replacer, 'DiagnosticArguments', 'DiagnosticCategory');

         addInterfaceMember(
            node,
            replacer,
            'ReusableDiagnosticRelatedInformation',
            'arguments: DiagnosticArguments;'
         );
      };
   }),
});

addSourceUpdate(stepName, {
   fileName: 'src/compiler/types.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         addInterfaceMember(
            node,
            replacer,
            'DiagnosticMessageChain',
            'arguments: DiagnosticArguments;'
         );
         addInterfaceMember(
            node,
            replacer,
            'DiagnosticRelatedInformation',
            'arguments: DiagnosticArguments;'
         );
      };
   }),
});

addSourceUpdate(stepName, {
   fileName: 'src/compiler/types.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         afterFunctionDeclaration(
            node,
            replacer,
            'flattenDiagnosticMessageText',
            flattenDiagnosticMessageArgumentsSrc
         );
      };
   }),
});

const fixCreateDiagnosticForRangeReturn = inside(
   (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.escapedText === 'createDiagnosticForRange',
   inside(
      ts.isReturnStatement,
      (replacer) => (node) => addShorthandProperty(node, replacer, 'args')
   )
);

addSourceUpdate(stepName, {
   fileName: 'src/compiler/utilities.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         addParameter(
            node,
            replacer,
            'createDiagnosticForRange',
            'args: DiagnosticArguments'
         );

         fixCreateDiagnosticForRangeReturn(replacer)(node);
      };
   }),
});

const flattenDiagnosticMessageArgumentsSrc = `
export function flattenDiagnosticMessageArguments(chain: DiagnosticMessageChain | string | undefined, args: DiagnosticArguments = []): DiagnosticArguments {
    if (chain === undefined || typeof chain === "string") {
        return args;
    }

    if (!chain.next) {
        return [...args, ...chain.arguments];
    }

    return [...args, ...chain.arguments, ...chain.next.flatMap(x => flattenDiagnosticMessageArguments(x))];
}
`;

/*
* src/compiler/builder.ts
src/compiler/checker.ts
- src/compiler/program.ts
* src/compiler/types.ts
src/compiler/utilities.ts
src/harness/client.ts
src/harness/harnessLanguageService.ts
src/server/protocol.ts
src/server/session.ts
src/testRunner/unittests/tscWatch/incremental.ts
src/testRunner/unittests/tsserver/externalProjects.ts

*/
