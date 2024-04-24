export const stepName = 'StructuredDiagnostics';

import * as ts from 'typescript';
import { mkTransform, addSourceUpdate } from '../sourceUpdate';

addSourceUpdate(stepName, {
   fileName: 'src/compiler/types.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         if (ts.isTypeAliasDeclaration(node)) {
            if (node.name.escapedText === 'DiagnosticArguments') {
               replacer.node(node, diagArgsSrc);
            }
         }
      };
   }),
});

addSourceUpdate(stepName, {
   fileName: 'src/compiler/checker.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'createDiagnosticCollection'
         ) {
            replacer.node(
               node,
               'createDiagnosticArgument, createDiagnosticCollection'
            );
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
               replacer.node(
                  node.arguments[1],
                  `createDiagnosticArgument(generalizedSourceType, generalizedSource, "Type")`
               );
               replacer.node(
                  node.arguments[2],
                  `createDiagnosticArgument(targetType, target, "Type")`
               );
            }
         }
         // return undefined;
      };
   }),
});

addSourceUpdate(stepName, {
   fileName: 'src/compiler/utilities.ts',
   transformer: mkTransform((replacer) => {
      return (node: ts.Node) => {
         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'SuperCall'
         ) {
            replacer.node(node, 'StructuredDiagnosticArgument, SuperCall ');
         }

         if (
            ts.isImportSpecifier(node) &&
            node.name.escapedText === 'DiagnosticArguments'
         ) {
            replacer.node(node, 'DiagnosticArgument, DiagnosticArguments ');
         }

         if (
            ts.isFunctionDeclaration(node) &&
            node?.name?.escapedText === 'formatStringFromArgs'
         ) {
            replacer.node(node, formatStringSrc);
         }
      };
   }),
});

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
