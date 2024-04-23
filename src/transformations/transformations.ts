import { SemanticDiagnosticsBuilderProgram } from 'typescript';

export const transformations: Record<
   string,
   (program: SemanticDiagnosticsBuilderProgram) => void
> = {};
