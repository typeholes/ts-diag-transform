import * as ts from 'typescript';
import { transformations } from './transformations';
import { doReplacements, writeFiles, mkReplacement } from '../replacements';

export const name = 'StructuredDiagnostics';

let typesChange: (start: number, end: number, newText: string) => void;
let checkerChange: (start: number, end: number, newText: string) => void;
let utilitiesChange: (start: number, end: number, newText: string) => void;

transformations['StructuredDiagnostics'] = (
   program: ts.SemanticDiagnosticsBuilderProgram
) => {
   const typesSourceFile = program.getSourceFile('src/compiler/types.ts');
   if (!typesSourceFile) throw new Error('could not find checker');
   typesChange = mkReplacement(typesSourceFile);
   ts.transform(typesSourceFile, [typesTransformer]);
   doReplacements(typesSourceFile);

   const checkerSourceFile = program.getSourceFile('src/compiler/checker.ts');
   if (!checkerSourceFile) throw new Error('could not find checker');
   checkerChange = mkReplacement(checkerSourceFile);
   ts.transform(checkerSourceFile, [checkerTransformer]);
   doReplacements(checkerSourceFile);

   const utilitiesSourceFile = program.getSourceFile(
      'src/compiler/utilities.ts'
   );
   if (!utilitiesSourceFile) throw new Error('could not find utilities');
   utilitiesChange = mkReplacement(utilitiesSourceFile);
   ts.transform(utilitiesSourceFile, [utilitiesTransformer]);
   doReplacements(utilitiesSourceFile);

   writeFiles();
};

const typesTransformer: ts.TransformerFactory<ts.Node> = (context) => {
   return (sourceFile) => {
      const visitor = (node: ts.Node): ts.Node => {
         if (ts.isTypeAliasDeclaration(node)) {
            if (node.name.escapedText === 'DiagnosticArguments') {
               typesChange(...subNode(node, diagArgsSrc));
            }
         }

         return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor);
   };
};

const checkerTransformer: ts.TransformerFactory<ts.Node> = (context) => {
   const sub = (node: ts.Node, newText: string) =>
      checkerChange(...subNode(node, newText));
   return (sourceFile) => {
      const visitor = (node: ts.Node): ts.Node => {
         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'createDiagnosticCollection'
         ) {
            sub(node, 'createDiagnosticArgument, createDiagnosticCollection');
         }

         if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.escapedText === 'reportError'
         ) {
            if (
               node.arguments.length === 3 &&
               ts.isIdentifier(node.arguments[0]) &&
               node.arguments[0].escapedText === 'message' &&
               ts.isIdentifier(node.arguments[1]) &&
               node.arguments[1].escapedText === 'generalizedSourceType' &&
               ts.isIdentifier(node.arguments[2]) &&
               node.arguments[2].escapedText === 'targetType'
            ) {
               sub(
                  node.arguments[1],
                  `createDiagnosticArgument(generalizedSourceType, generalizedSource, "Type")`
               );
               sub(
                  node.arguments[2],
                  `createDiagnosticArgument(targetType, target, "Type")`
               );
            }
         }

         return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor);
   };
};

const utilitiesTransformer: ts.TransformerFactory<ts.Node> = (context) => {
   const sub = (node: ts.Node, newText: string) =>
      utilitiesChange(...subNode(node, newText));
   return (sourceFile) => {
      const visitor = (node: ts.Node): ts.Node => {
         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'SuperCall'
         ) {
            sub(node, 'StructuredDiagnosticArgument, SuperCall ');
         }

         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'DiagnosticArguments'
         ) {
            sub(node, 'DiagnosticArgument, DiagnosticArguments ');
         }

         if (
            ts.isFunctionDeclaration(node) &&
            node?.name?.escapedText === 'formatStringFromArgs'
         ) {
            sub(node, formatStringSrc);
         }

         return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor);
   };
};

const diagArgsSrc = `
export interface StructuredDiagnosticArgument {
    cacheId: number | undefined;
    type: "Type" | "Symbol" | "Node" | "Signature" | "TypePredicate" | "string";
    text: string;
}
export type DiagnosticArgument = StructuredDiagnosticArgument | string | number; // comment out | string | number to enforce structured arguments

/** @internal */
export type DiagnosticArguments = DiagnosticArgument[];
`;

// -            reportError(message, generalizedSourceType, targetType);
const reportErrorMsgSrc = `
            reportError(message,
                createDiagnosticArgument(generalizedSourceType, generalizedSource, "Type"),
                createDiagnosticArgument(targetType, target, "Type"),
                )
`;

const formatStringSrc = `
/** @internal */
export function formatStringFromArgs(text: string, args: DiagnosticArguments): string {
   return text.replace(/{(\\d+)}/g, (_match, index: string) => "" + diagnosticArgumentToText(Debug.checkDefined(args[+index])));
}

export function diagnosticArgumentToText(arg: DiagnosticArgument) {
    // eslint-disable-next-line local/no-in-operator
    return typeof arg === "object" && "text" in arg ? arg.text : arg;
}

const argCache: (Node | Symbol | Signature | Type | TypePredicate)[] = [];
const argIndexes = new Map<any, number>();

export function getDiagnosticArgValue(idx: number) {
    return argCache[idx];
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createDiagnosticArgument<T extends string>(text: string): StructuredDiagnosticArgument;
/** @internal */
export function createDiagnosticArgument<T extends Node|Symbol|Signature|Type|TypePredicate >(text: string, value: T, type: "Node"|"Symbol"|"Signature"|"Type"|"TypePredicate"): StructuredDiagnosticArgument;
/** @internal */
export function createDiagnosticArgument<T extends Node | Symbol | Signature | Type | TypePredicate | string>(
    text: string,
    value?: T,
    type?: "Node" | "Symbol" | "Signature" | "Type" | "TypePredicate",
): StructuredDiagnosticArgument {
    let idx: number | undefined;
    if (value !== undefined && typeof value !== "string") {
        if (argIndexes.has(value)) {
            idx = argIndexes.get(value)!;
        }
        else {
            idx = argCache.push(value) - 1;
            argIndexes.set(value, idx);
        }
    }
    return { cacheId: idx, type: type ?? "string", text };
}
`;

function subNode(node: ts.Node, newText: string): [number, number, string] {
   return [node.pos, node.end, newText];
}
