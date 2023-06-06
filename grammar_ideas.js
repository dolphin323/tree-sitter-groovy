const { expression } = require("mathjs");

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

  conflicts: ($) => [
    [$.comma_sep_args], // what does this single-element arrag specify?
    [$.argument, $.function_call], // what does this single-element arrag specify?
    [$.argument, $.field_access], // what does this single-element arrag specify?
    [$.function_call],
    [$.field_access],
    [$.function_call, $.field_access],
  ],

  rules: {
    /* 
    Generally, the order of the rules is used to resolve conflicts.
    Define more rigid structures first. 
    Example: if_statements are more unforgiving... 
    TODO:
      1. rename field_access to chain and simplify
      2. clear up function related rules (only call and definition must exist)
    */
    module: ($) => repeat($._statement),

    chain: ($) => seq(repeat1(seq($.identifier, ".")), $.identifier), // only used in import_statement

    import_statement: ($) =>
      seq($.import, choice($.identifier, $.chain), optional(".*")),

    argument: (
      $ // This should mean a single value, through any means (variable, field_access, expressions, anything that returns a value)
    ) =>
      choice(
        $.identifier, // define variable as similar to identifier primary
        $.field_access, // a.b.d.c((1,2,4)).
        // $.function_call,
        $.string, // primary
        $.array, // p
        $.number // p
        // $.closure,
        // $.unary_expression,
        // $.binary_expression,
        // $.spread_expression,
        // $.ternary_expression,
        // $.elvis_expression, // x ? x : y => x ?: y ::: either binary or ternery
        // $.closure,
        // $.property_access,
        // $.as_expression
        // $.method_definition,
        // $.new_expression,
      ),

    // argument: ($) => choice($._argument, $._parenthesized_argument),

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

    array: ($) =>
      choice(seq("[", optional($.comma_sep_args), optional(","), "]"), "[:]"),

    number: ($) =>
      token(
        choice(
          /\d+(\.\d+)?/, // Integer or decimal numbers
          /\.\d+/ // Decimal numbers without leading digit
        )
      ),

    property_access: ($) => seq($.identifier, "[", $.argument, "]"), // TODO: define key

    field_access: ($) =>
      seq(
        choice($.identifier, $.function_call),
        repeat1(
          seq(
            choice(".", "?.", ".&", "*."),
            choice(
              $.identifier,
              $.function_call,
              $.string
              // seq($.identifier, "[", repeat1($._statement), "]")
            )
          )
        )
      ),

    comma_sep_args: ($) => seq(commaSep($.argument), optional(",")),

    closure: ($) =>
      seq(
        "{",
        optional(
          choice(
            seq(optional($.def), choice($.identifier, $.field_access), "->"),
            seq("->")
          )
        ),
        choice(repeat1($._statement), $.string, $.elvis_expression), //
        "}"
      ),

    function_definition: ($) =>
      // TODO: fix DOESN'T work with the new body
      seq(
        optional($.static),
        $.def,
        $.identifier,
        "{",
        repeat1($._statement),
        "}"
      ),

    task_definition: ($) =>
      seq($.task, choice($.block_operations, $.function_call)),

    new_expression: ($) => seq($.new, choice($.function_call, $.field_access)),

    throw_statement: ($) => seq($.throw, $.new_expression),

    type: ($) => choice($.String, $.Integer, $.Boolean, $.Object), // CLEAERED

    function_call: (
      $ // CLEARED for now
    ) =>
      seq(
        $.identifier,
        choice(
          seq("(", optional($.comma_sep_args), ")"),
          $.comma_sep_args,
          seq("(", optional($.comma_sep_args), ")", $.argument) // for closure as the last argument
        )
      ),

    variable_definition: (
      $ // CLEARED
    ) => seq(choice($.def, $.var, $.type), $.identifier),

    assignment_statement: (
      $ // TODO: multiple assignments at a time
    ) =>
      seq(
        choice($.variable_definition, $.identifier, $.field_access),
        choice(...ASSIGNMENT_OPERATORS),
        $.assignee
      ),
    assignee: ($) => choice(seq("(", $.expression, ")"), $.argument),

    unary_expression: ($) =>
      choice(
        ...UNARY_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(field("operator", operator), field("operand", $.argument))
          )
        )
      ),

    binary_expression: ($) =>
      choice(
        ...BINARY_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $.argument),
              field("operator", operator),
              field("right", $.argument)
            )
          )
        )
      ),

    ternary_variants: ($) =>
      choice(
        seq(
          choice(
            $.identifier,
            $.field_access,
            $.string,
            $.function_call,
            $.array,
            $.new_expression,
            $.ternary_expression,
            $.closure
          )
        )
      ),

    ternary_expression: ($) =>
      prec.right(
        seq(
          $.ternary_variants,
          "?",
          $.ternary_variants,
          ":",
          $.ternary_variants
        )
      ),

    elvis_expression: ($) =>
      prec.right(seq($.ternary_variants, "?:", $.ternary_variants)),

    spread_expression: ($) => seq($.type, "...", $.identifier),

    block_operations: ($) => prec(1, seq($.identifier, $.body)), // TODO: check with new  body (new body allows one invocation)

    method_definition: ($) =>
      seq(choice($.identifier, $.string), ":", choice($.argument)),

    return_statement: ($) => prec.right(seq($.return, optional($.argument))),

    as_expression: ($) => seq($.ternary_variants, $.as, $.identifier),

    _parenthesized_expression: ($) => seq("(", $.expression, ")"),
    expression: ($) =>
      choice(
        $.argument, // TODO: DEFINE primary_expression BASED ON JS
        $.unary_expression,
        $.binary_expression,
        $.ternary_expression,
        $._parenthesized_expression,
        $.spread_expression
      ),

    condition: ($) => seq("(", choice($.expression), ")"), // TODO: operators?
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

    _definition: ($) =>
      choice($.function_definition, $.task_definition, $.variable_definition),

    _invocation: ($) =>
      choice(
        $.import_statement,
        $.function_call,
        $.block_operations,
        $.return_statement,
        $.throw_statement,
        $.assignment_statement
      ),

    _statement: ($) =>
      seq(
        choice(
          $.if_statement,
          // $.while_statement,
          $._invocation,
          $._definition
          // $.function_expression, // TODO: Merge this rule into function call, see here: https://groovy-lang.org/style-guide.html#_omitting_parentheses
          // $.spread_expression // Isn't this an argument-level thing?
        ),
        // optional($.end_of_line)
        optional(";")
      ),

    ...ruleNames(...keywords),
    ...ruleNames(...types),

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,
    shebang_line: ($) => token(seq(/#!.*/)),
    line_comment: (_) => token(seq("//", optional(/[^\n]+/g))),
    multiline_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
    // end_of_line: ($) => ";",
  },
});

function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function iregex(s) {
  return new RegExp(
    Array.from(s).reduce(
      (acc, value) => acc + `[${value.toLowerCase()}${value.toUpperCase()}]`
    )
  );
}

function ruleName(name) {
  return { [name.replaceAll(/ /g, "_")]: (_) => iregex(name) };
}

function ruleNames(...names) {
  return Object.assign({}, ...names.map(ruleName));
}
