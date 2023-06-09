keywords = [
  "if",
  "else if",
  "else",
  "import",
  "as",
  "return",
  "throw",
  "new",
  "static",
  "def",
  "var",
  "task",
  "true",
  "false",
  "null",
  "final",
];

types = ["String", "Integer", "Boolean", "Object"];

const PREC = {
  // https://introcs.cs.princeton.edu/java/11precedence/
  COMMENT: 0, // //  /*  */
  ASSIGN: 1, // =  += -=  *=  /=  %=  &=  ^=  |=  <<=  >>=  >>>=
  DECL: 2,
  ELEMENT_VAL: 2,
  TERNARY: 3, // ?:
  OR: 4, // ||
  AND: 5, // &&
  BIT_OR: 6, // |
  BIT_XOR: 7, // ^
  BIT_AND: 8, // &
  EQUALITY: 9, // ==  !=
  GENERIC: 10,
  REL: 10, // <  <=  >  >=  instanceof
  SHIFT: 11, // <<  >>  >>>
  ADD: 12, // +  -
  MULT: 13, // *  /  %
  CAST: 14, // (Type)
  OBJ_INST: 14, // new
  UNARY: 15, // ++a  --a  a++  a--  +  -  !  ~
  ARRAY: 16, // [Index]
  OBJ_ACCESS: 16, // .
  PARENS: 16, // (Expression)
  CLASS_LITERAL: 17, // .
};

const UNARY_OPERATORS = [
  ["+", PREC.UNARY],
  ["-", PREC.UNARY],
  ["!", PREC.UNARY],
  ["~", PREC.UNARY],
  ["*", PREC.UNARY],
];

const BINARY_OPERATORS = [
  [">", PREC.REL],
  ["<", PREC.REL],
  [">=", PREC.REL],
  ["<=", PREC.REL],
  ["=~", PREC.REL],
  ["->", PREC.REL], // TODO: CHECK THE
  ["==", PREC.EQUALITY],
  ["!=", PREC.EQUALITY],
  ["&&", PREC.AND],
  ["||", PREC.OR],
  ["+", PREC.ADD],
  ["-", PREC.ADD],
  ["*", PREC.MULT],
  ["/", PREC.MULT],
  ["&", PREC.BIT_AND],
  ["|", PREC.BIT_OR],
  ["^", PREC.BIT_XOR],
  ["%", PREC.MULT],
  ["<<", PREC.SHIFT],
  [">>", PREC.SHIFT],
  [">>>", PREC.SHIFT],
];

const ASSIGNMENT_OPERATORS = [
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "&=",
  "|=",
  "^=",
  "%=",
  "?=",
  "<<=",
  ">>=",
  ">>>=",
];

const PRECEDENCES = [
  "unary_void",
  "binary_exp",
  "binary_times",
  "binary_plus",
  "binary_shift",
  "binary_compare",
  "binary_relation",
  "binary_equality",
  "bitwise_and",
  "bitwise_xor",
  "bitwise_or",
  "logical_and",
  "logical_or",
  "ternary",
];

module.exports = grammar({
  name: "groovy",

  extras: ($) => [$.shebang_line, $.line_comment, $.multiline_comment, /\s/], // I think it's

  precedences: ($) => [PRECEDENCES], // Can only be used with parse precedence, not lexical precedence.

  supertypes: ($) => [$._definition, $.primary_expression, $._invocation],

  conflicts: ($) => [
    [$._comma_sep_args], // what does this single-element specify?
    [$.property_access],
    [$.if_statement],
    [$.closure, $.body],
    [$._comma_sep_args, $._expression],
    [$.property_access, $._paren_less_function_call],
    [$.closure, $.block_operations],
  ],

  rules: {
    module: ($) => repeat($._statement),

    _statement: ($) =>
      choice(
        $._expression,
        $._definition,
        $._invocation,
        $._paren_less_function_call
      ),

    _invocation: ($) =>
      choice(
        $.import_statement,
        $.if_statement,
        $.return_statement,
        $.throw_statement,
        $.block_operations,
        $.assignment_statement
      ),

    _definition: ($) =>
      choice($.function_definition, $.task_definition, $.variable_definition),

    _nestable_expression: ($) =>
      choice(
        $.primary_expression,
        $.unary_expression,
        $.binary_expression,
        $.ternary_expression,
        $.new_expression,
        $.as_expression,
        // $.method_definition,
        $.chain_expression,
        $.array
        // $.parenthesized_expression
      ),

    _invocable_expression: ($) =>
      choice($._normal_function_call, $._closure_last_function_call),

    _expression: ($) => choice($._nestable_expression, $._invocable_expression),

    primary_expression: ($) =>
      choice(
        // $.variable, // change with variable
        $.number,
        $.string,
        $.true,
        $.false,
        $.null
      ),

    // parenthesized_expression: ($) => seq("(", $._expression, ")"),

    chain: ($) => seq(repeat1(seq($.identifier, ".")), $.identifier), // only used in import_statement

    import_statement: ($) =>
      seq($.import, choice($.identifier, $.chain), optional(".*")),

    single_quoted_string: ($) =>
      token(seq("'", repeat(choice(/[^\\'\n]/, /\\(.|\n)/)), "'")),
    double_quoted_string: ($) =>
      token(
        seq('"', repeat(choice(/[^\\"\n]/, /\\(.|\n)/, /\$\{[^}]*\}/)), '"')
      ),
    text_block: ($) =>
      token(
        seq("'''", /\s*\n/, optional(repeat(choice(/[^\\"]/, /\\(.)/))), "'''")
      ),
    string: ($) =>
      choice($.single_quoted_string, $.double_quoted_string, $.text_block),

    array: ($) => choice(seq("[", optional($._comma_sep_args), "]"), "[:]"),

    number: ($) =>
      token(
        choice(
          /\d+(\.\d+)?/, // Integer or decimal numbers
          /\.\d+/ // Decimal numbers without leading digit
        )
      ),

    // EXAMPLE object[index1][index2]
    property_access: ($) =>
      seq($.variable, repeat1(seq("[", $.primary_expression, "]"))), // TODO: define key

    _chain_item: ($) =>
      choice(
        $.identifier,
        $.property_access,
        $._normal_function_call,
        $._closure_last_function_call
      ),
    chain_expression: ($) =>
      seq(
        choice($._chain_item, $.new_expression), //  new File(buildDir, "generated/source/codegen/jni/").absolutePath
        repeat1(
          seq(choice(".", "?.", ".&", "*."), choice($._chain_item, $.string))
        )
      ),

    _comma_sep_args: ($) =>
      choice(
        $._nestable_expression,
        seq($._nestable_expression, repeat1(seq(",", $._nestable_expression)))
      ),

    closure: ($) =>
      seq(
        "{",
        optional(choice(seq($._comma_sep_args, "->"), seq("->"))),
        repeat1($._statement), //
        "}"
      ),

    _general_function_call: ($) =>
      choice(
        $._paren_less_function_call,
        $._closure_last_function_call,
        $._normal_function_call
      ),
    _paren_less_function_call: ($) =>
      alias(
        seq($.identifier, alias($._comma_sep_args, "arguments")),
        "paren_function_call"
      ), // if does not show in tree, define alias($._paren_less_function_call_args, "arguments") and use it

    _closure_last_function_call: ($) =>
      alias(
        seq(
          $.identifier,
          alias($._closure_last_function_call_args, "arguments")
        ),
        "closure_function_call"
      ),
    _closure_last_function_call_args: ($) =>
      choice(
        seq(
          "(",
          optional($._normal_function_call_comma_sep_args),
          ")",
          $.closure
        ),
        $.closure
      ),

    _normal_function_call: ($) =>
      alias(
        seq($.identifier, alias($._normal_function_call_args, "arguments")),
        "normal_function_call"
      ),

    _normal_function_call_comma_sep_args: ($) =>
      choice(
        choice($._expression, $.identifier),
        seq(
          choice($._expression, $.identifier),
          repeat1(seq(",", choice($._expression, $.identifier)))
        )
      ),
    _normal_function_call_args: ($) =>
      seq("(", optional($._normal_function_call_comma_sep_args), ")"),

    parameters: ($) => seq($._comma_sep_args),
    function_definition_body: ($) => repeat1($._statement),
    function_definition: ($) =>
      // TODO: fix DOESN'T work with the new body
      seq(
        optional($.static),
        $.def,
        $.identifier,
        "(",
        optional($.parameters),
        ")",
        "{",
        alias($.function_definition_body, "body"),
        "}"
      ),

    task_definition: ($) =>
      seq(
        $.task,
        choice(
          $.block_operations,
          $._normal_function_call,
          $._closure_last_function_call
        )
      ),

    new_expression: ($) =>
      seq(
        $.new,
        choice(
          $._normal_function_call,
          $._closure_last_function_call
          // $.chain_expression
        )
      ),

    throw_statement: ($) => seq($.throw, $.new_expression),

    type: ($) => choice($.String, $.Integer, $.Boolean, $.Object), // CLEAERED

    variable_definition: ($) =>
      seq(optional($.final), choice($.def, $.var, $.type), $.identifier), //TODO add for multi

    assignment_statement: (
      $ // TODO: multiple assignments at a time
    ) =>
      seq(
        choice($.variable_definition, $.identifier, $.chain_expression),
        choice(...ASSIGNMENT_OPERATORS),
        $.assignee
      ),
    assignee: ($) => choice($._expression, $.identifier),

    unary_expression: ($) =>
      choice(
        ...UNARY_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(field("operator", operator), field("operand", $._expression))
          )
        )
      ),

    binary_expression: ($) =>
      choice(
        ...BINARY_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $._expression),
              field("operator", operator),
              field("right", $._expression)
            )
          )
        )
      ),

    ternary_expression: ($) =>
      prec.left(
        seq(
          choice($._expression, $.identifier),
          "?",
          $._expression,
          ":",
          $._expression
        )
      ),
    elvis_expression: ($) => seq($._expression, "?:", $._expression),

    spread_expression: ($) => seq($.type, "...", $.identifier),

    block_operations: ($) =>
      seq($.identifier, seq("{", repeat1($._statement), "}")), // TODO: check with new  body (new body allows one invocation)

    // method_definition: ($) =>
    //   seq(choice($.identifier, $.string), ":", choice($._expression)),

    return_statement: ($) => prec.right(seq($.return, optional($._expression))),

    as_expression: ($) => seq($._expression, $.as, $.type),

    condition: ($) => seq("(", $._expression, ")"), // TODO: operators?
    body: ($) => choice(seq("{", repeat1($._statement), "}"), $._invocation),

    if_clause: ($) => seq($.if, $.condition, $.body),
    else_if_clause: ($) => seq($.else_if, $.condition, $.body),
    else_clause: ($) => seq($.else, $.body),
    if_statement: ($) =>
      seq(
        $.if_clause,
        optional(repeat($.else_if_clause)),
        optional($.else_clause)
      ),

    ...ruleNames(...keywords),
    ...ruleNames(...types),

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,
    variable: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    shebang_line: ($) => token(seq(/#!.*/)),
    line_comment: (_) => token(seq("//", optional(/[^\n]+/g))),
    multiline_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

function iregex(s) {
  return new RegExp(
    Array.from(s).reduce(
      (acc, value) => acc + `[${value.toLowerCase()}${value.toUpperCase()}]`,
      ""
    )
  );
}

function ruleName(name) {
  return { [name.replaceAll(/ /g, "_")]: (_) => iregex(name) };
}

function ruleNames(...names) {
  return Object.assign({}, ...names.map(ruleName));
}
