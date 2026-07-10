import Parser from 'web-tree-sitter';

const DECISION_NODE_TYPES: Record<string, string[]> = {
  typescript: ['if_statement', 'for_statement', 'while_statement', 'do_statement', 'case_clause', 'catch_clause', 'ternary_expression'],
  tsx:        ['if_statement', 'for_statement', 'while_statement', 'do_statement', 'case_clause', 'catch_clause', 'ternary_expression'],
  javascript: ['if_statement', 'for_statement', 'while_statement', 'do_statement', 'switch_case', 'catch_clause', 'ternary_expression'],
  python:     ['if_statement', 'for_statement', 'while_statement', 'elif_clause', 'except_clause', 'conditional_expression'],
};

const LOGICAL_OPERATORS = new Set(['&&', '||', 'and', 'or']);

export function calculateComplexity(
  ast: Parser.Tree,
  language: string,
  startLine: number,
  endLine: number
): number {
  const decisionTypes = new Set(DECISION_NODE_TYPES[language] || DECISION_NODE_TYPES.typescript);
  let count = 0;
  const cursor = ast.walk();

  function isLogicalBinary(node: Parser.SyntaxNode): boolean {
    if (node.type === 'boolean_operator') return true;
    if (node.type === 'binary_expression') {
      const opText = node.childForFieldName('operator')?.text ?? '';
      return LOGICAL_OPERATORS.has(opText);
    }
    return false;
  }

  function visit() {
    const node = cursor.currentNode;
    if (node.startPosition.row >= startLine && node.endPosition.row <= endLine) {
      if (decisionTypes.has(node.type) || isLogicalBinary(node)) count++;
    }
    if (cursor.gotoFirstChild()) {
      do { visit(); } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  visit();
  return 1 + count;
}
