commands = ["if", "else", "import", "return", "def", "as"];

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

const UNARY_EXPRESSION_OPERATORS = [
  ["+", PREC.UNARY],
  ["-", PREC.UNARY],
  ["!", PREC.UNARY],
  ["~", PREC.UNARY],
  ["*", PREC.UNARY],
];

const BINARY_EXPRESSION_OPERATORS = [
  [">", PREC.REL],
  ["<", PREC.REL],
  [">=", PREC.REL],
  ["<=", PREC.REL],
  ["=~", PREC.REL],
  ["->", PREC.REL], // TODO CHECK THE
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

const ASSIGNMENT_EXPRESSION = [
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
  extras: ($) => [$.shebang_line, $.line_comment, $.multiline_comment, /\s/],

  precedences: ($) => [PRECEDENCES],

  conflicts: ($) => [
    [$.comma_sep_args],
    [$.arguments],
    [$.parentless_function_call, $.variable_definition],
    [$.block_expression, $.parentless_function_call],
  ],

  rules: {
    module: ($) => repeat($._statement),

    _statement: ($) =>
      seq(
        choice(
          $.import_statement,
          $.if_statement,
          $.assignment_expression,
          $.block_expression,
          $.task_definition,
          $.function_call,
          $.function_expression,
          $.function_definition,
          $.spread_expression,
          $.return_statement,
          $.throw_error_expression,
          $.variable_definition,
          $.parentless_function_call
        ),
        optional($.end_of_line)
      ),

    _arguments: ($) =>
      seq(
        choice(
          $.identifier,
          $.field_access,
          $.string,
          $.function_call,
          $.array,
          $.method_definition,
          $.new_expression,
          $.number,
          $.unary_expression,
          $.binary_expression,
          $.spread_expression,
          $.ternary_expression,
          $.elvis_expression,
          $.closure,
          $.closure_call,
          $.text_block,
          $.property_access,
          $.as_expression
        )
      ),

    arguments: ($) => choice($._arguments, seq("(", $._arguments, ")")),

    end_of_line: ($) => ";",

    string: ($) => choice($.single_quoted_string, $.double_quoted_string),

    single_quoted_string: ($) =>
      token(seq("'", repeat(choice(/[^\\'\n]/, /\\(.|\n)/)), "'")),

    double_quoted_string: ($) =>
      token(seq('"', repeat(choice(/[^\\"\n]/, /\\(.|\n)/)), '"')),

    text_block: ($) =>
      token(
        seq("'''", /\s*\n/, optional(repeat(choice(/[^\\"]/, /\\(.)/))), "'''")
      ),

    array: ($) =>
      choice(seq("[", optional($.comma_sep_args), optional(","), "]"), "[:]"),

    number: ($) =>
      token(
        choice(
          /\d+(\.\d+)?/, // Integer or decimal numbers
          /\.\d+/ // Decimal numbers without leading digit
        )
      ),

    property_access: ($) => seq($.identifier, "[", $.body, "]"),

    field_access: ($) =>
      seq(
        choice($.identifier, $.function_call),
        repeat1(
          seq(
            choice(".", "?."),
            choice(
              $.identifier,
              $.function_call,
              $.string,
              seq($.identifier, "[", $.body, "]"),
              $.closure_call
            )
          )
        )
      ),

    import_statement: ($) =>
      seq($.import, choice($.identifier, $.field_access), optional(".*")),

    comma_sep_args: ($) => seq(commaSep($.arguments), optional(",")),

    condition: ($) => seq("(", choice($.arguments), ")"),
    body: ($) => repeat1($._statement),

    if_clause: ($) =>
      seq(
        $.if,
        $.condition,
        choice(
          seq("{", optional($.body), "}"),
          $.return_statement,
          $.assignment_expression,
          $.field_access
        )
      ),
    else_if_clause: ($) =>
      seq($.else_if, $.condition, "{", optional($.body), "}"),
    else_clause: ($) => seq($.else, "{", optional($.body), "}"),
    if_statement: ($) =>
      seq($.if_clause, repeat($.else_if_clause), optional($.else_clause)),

    closure: ($) =>
      seq(
        "{",
        optional(
          choice(
            seq(optional($.def), choice($.identifier, $.field_access), "->"),
            seq("->")
          )
        ),
        choice($.body, $.string, $.elvis_expression),
        "}"
      ),
    closure_call: ($) => seq(choice($.identifier, $.function_call), $.closure),

    function_call: ($) =>
      seq($.identifier, "(", optional($.comma_sep_args), ")"),
    parentless_function_call: ($) =>
      seq($.identifier, optional($.comma_sep_args)),
    function_expression: ($) =>
      seq($.function_call, optional("<<"), "{", optional($.body), "}"),
    function_definition: ($) =>
      seq(optional("static"), $.def, $.function_expression),

    task_definition: ($) =>
      seq("task", choice($.block_expression, $.function_expression)),

    new_expression: ($) => seq("new", choice($.function_call, $.field_access)),

    throw_error_expression: ($) => seq("throw", $.new_expression),

    type: ($) => choice("String", "Integer", "Boolean", "Object"),

    variable_definition: ($) =>
      seq(optional($.def), choice($.identifier, $.field_access)),

    assignment_expression: ($) =>
      seq($.variable_definition, choice(...ASSIGNMENT_EXPRESSION), $.assignee),
    // assigned_to: ($) =>
    //   seq(optional($.def), choice($.identifier, $.field_access)),
    assignee: ($) => choice(seq("(", $.arguments, ")"), $.arguments),

    unary_expression: ($) =>
      choice(
        ...UNARY_EXPRESSION_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(field("operator", operator), field("operand", $.arguments))
          )
        )
      ),

    binary_expression: ($) =>
      choice(
        ...BINARY_EXPRESSION_OPERATORS.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $.arguments),
              field("operator", operator),
              field("right", $.arguments)
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

    block_expression: ($) =>
      prec(1, seq($.identifier, "{", optional($.body), "}")),

    method_definition: ($) =>
      seq(choice($.identifier, $.string), ":", choice($.arguments)),

    return_statement: ($) => prec.right(seq($.return, optional($.arguments))),

    as_expression: ($) => seq($.ternary_variants, $.as, $.identifier),

    else_if: ($) => "else if",
    ...commandNames(...commands),

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    shebang_line: ($) => token(seq(/#!.*/)),
    line_comment: (_) => token(seq("//", optional(/[^\n]+/g))),
    multiline_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function iregex(s) {
  return new RegExp(
    Array.from(s).reduce(
      (acc, value) => acc + `[${value.toLowerCase()}${value.toUpperCase()}]`,
      ""
    )
  );
}

function commandName(name) {
  return { [name]: (_) => iregex(name) };
}

function commandNames(...names) {
  return Object.assign({}, ...names.map(commandName));
}
