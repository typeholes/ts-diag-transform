import * as ts from 'typescript';
import { Replacer } from './sourceUpdate';

function after(replacer: Replacer, node: ts.Node, newText: string) {
   const lastToken = node.getLastToken()!;
   replacer.node(lastToken, lastToken.getFullText() + newText);
}

function beforeEnd(
   replacer: Replacer,
   node: ts.Node | ts.NodeArray<ts.Node>,
   newText: string
) {
   // node arrays ends seems to be off by 1
   const end = node.end - ('kind' in node ? 1 : 0);

   replacer.range(end, end, newText);
}

export function addInterfaceMember(
   node: ts.Node,
   replacer: Replacer,
   interfaceName: string,
   memberText: string
) {
   if (
      ts.isInterfaceDeclaration(node) &&
      node.name.escapedText === interfaceName
   ) {
      beforeEnd(replacer, node, memberText);
   }
}

export function addImport(
   node: ts.Node,
   replacer: Replacer,
   name: string,
   beforeName: string
) {
   if (ts.isImportSpecifier(node) && node.name.escapedText === beforeName) {
      replacer.node(node, `${name}, ${beforeName}`);
   }
}

export function inside(
   predicate: (node: ts.Node) => boolean,
   action: (replacer: Replacer) => (node: ts.Node) => void
) {
   return (_replacer: Replacer) => (node: ts.Node) =>
      predicate(node) ? action : undefined;
}

export function afterFunctionDeclaration(
   node: ts.Node,
   replacer: Replacer,
   functionName: string,
   newText: string
) {
   if (
      ts.isFunctionDeclaration(node) &&
      node.name?.escapedText === functionName
   ) {
      after(replacer, node, newText);
   }
}
export function addParameter(
   node: ts.Node,
   replacer: Replacer,
   functionName: string,
   parameterText: string
) {
   if (
      ts.isFunctionDeclaration(node) &&
      node.name?.escapedText === functionName
   ) {
      const params = node.parameters;
      const newText = (params.length > 0 ? ', ' : '') + parameterText;
      beforeEnd(replacer, params, newText);
   }
}

export function addShorthandProperty(
   node: ts.Node,
   replacer: Replacer,
   propertyName: string
) {
   if (ts.isObjectLiteralExpression(node)) {
      const properties = node.properties;
      if (properties.length == 0) {
         replacer.range(node.end - 1, node.end - 1, propertyName + ',');
      } else {
         replacer.range(
            properties[properties.length - 1].end,
            node.end - 1,
            ',' + propertyName + ','
         );
      }
   }
}
